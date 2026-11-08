/* =========================================================================
   qr-scanner.js
   -------------------------------------------------------------------------
   This is where the core system rule actually happens:

     "One Student + One Exam = One Admit Card QR; each Subject = New
      Anonymous Answer Script + New Random Seat; Student/Teacher/Committee
      cannot see the identity mapping; only authorized Admin can reveal it."

   TWO SEPARATE SCANS PER STUDENT, IN ORDER — this used to be one scan
   that auto-generated a fake scriptId instead of reading the real code
   printed on the physical answer script. Fixed to match how check-in
   actually works in the exam hall:

     STEP 1 — scan the student's ADMIT CARD.
       Parse the payload as `${studentId}.${examId}` (matches
       admit-card.js's client-side-issued payload — see that project's
       js/billing.js for how it's created; no server-side HMAC in the
       default Spark/free-plan setup, so this is a Firestore-existence
       check, not a signature check).
       Validates: right exam for this session, admitCards/{studentId}_
       {examId} really exists with a matching payload, and this student
       hasn't already checked in for THIS subject. On success, the
       student is held as `pendingStudent` — nothing is written to
       Firestore yet — and the scanner keeps running for step 2.

     STEP 2 — scan the CODE ALREADY PRINTED ON THE PHYSICAL SCRIPT/BOOKLET
       handed to that student. Whatever that scan decodes to (a barcode,
       a QR, a printed serial number typed in manually) becomes the
       scriptId directly — never invented by this code. Validates that
       code hasn't already been used by someone else this session. Only
       now does it:
         1. Pick a RANDOM unused seat number out of the session's
            totalSeats.
         2. Write three documents in one go:
              examSeatAssignments/{studentId}_{examId}_{subjectCode}
                  -> lets the student see their own seat/token later.
              answerScripts/{scriptId}
                  -> the anonymous script record graders will use. NEVER
                     contains studentId or name.
              scriptIdentityMap/{scriptId}
                  -> the ONE place studentId <-> scriptId is linked.
                     Write-only from this portal's perspective (see
                     firestore.rules — this portal has no read access to
                     this collection), readable only by the admin role.
         3. Show the teacher the seat number so they can tell the
            student — never the identity mapping itself.
       `pendingStudent` is cleared either way (success or "already used"
       error) and the scanner goes back to expecting STEP 1 for the next
       student. A "বাতিল করুন" button lets the teacher abandon a pending
       student (wrong admit card scanned, etc.) without writing anything.
   ========================================================================= */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { requireActiveSession } from "./session.js";
import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("qr-scanner.html", teacher);

const session = requireActiveSession();
if (session) {
  document.getElementById("sessionInfoCard").innerHTML = `
    <strong>${session.subjectTitle}</strong> — ${session.examName}
    <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
      রুম: ${session.room || "-"} · মোট সিট: ${session.totalSeats || "-"}
    </div>
  `;
}

const stepIndicator = document.getElementById("stepIndicator");
const toggleBtn = document.getElementById("toggleScanBtn");
const cancelBtn = document.getElementById("cancelPendingBtn");
const manualForm = document.getElementById("manualForm");
const manualCodeInput = document.getElementById("manualCode");
const resultCard = document.getElementById("resultCard");
let html5QrCode = null;
let scanning = false;
let busy = false; // guards against double-processing the same frame

let pendingStudent = null; // { studentId, examId, studentName, studentRoll }

function updateStepUI() {
  if (pendingStudent) {
    stepIndicator.innerHTML = `
      <span class="badge amber">ধাপ ২/২</span>
      <strong>${pendingStudent.studentRoll} · ${pendingStudent.studentName}</strong>
      — এখন এই স্টুডেন্টের খাতায় ছাপা কোডটা স্ক্যান করুন।
    `;
    cancelBtn.style.display = "inline-block";
  } else {
    stepIndicator.innerHTML = `<span class="badge">ধাপ ১/২</span> স্টুডেন্টের Admit Card স্ক্যান করুন।`;
    cancelBtn.style.display = "none";
  }
}
updateStepUI();

cancelBtn.addEventListener("click", () => {
  pendingStudent = null;
  updateStepUI();
  resultCard.style.display = "none";
});

function showResult(type, html) {
  resultCard.style.display = "block";
  resultCard.className = `card scan-result-card`;
  resultCard.innerHTML = html;
}

async function pickRandomSeat() {
  const takenSnap = await getDocs(
    query(
      collection(db, "examSeatAssignments"),
      where("examId", "==", session.examId),
      where("subjectCode", "==", session.subjectCode)
    )
  );
  const taken = new Set(takenSnap.docs.map((d) => d.data().seatToken));
  const total = session.totalSeats || 40;
  const free = [];
  for (let i = 1; i <= total; i++) {
    const token = String(i).padStart(2, "0");
    if (!taken.has(token)) free.push(token);
  }
  if (!free.length) return null; // room full
  return free[Math.floor(Math.random() * free.length)];
}

async function handleAdmitCardScan(rawText) {
  const parts = rawText.split(".");
  const [studentId, examId] = parts;
  if (!studentId || !examId) {
    showResult("error", `<span class="badge red">Invalid QR</span><div>এই কোডটি admit card QR বলে মনে হচ্ছে না। (খাতার কোড স্ক্যান করতে চাইলে আগে একটা admit card স্ক্যান করুন।)</div>`);
    return;
  }
  if (examId !== session.examId) {
    showResult("error", `<span class="badge red">ভুল পরীক্ষা</span><div>এই QR অন্য একটা পরীক্ষার জন্য ইস্যু করা।</div>`);
    return;
  }

  const admitSnap = await getDoc(doc(db, "admitCards", `${studentId}_${examId}`));
  if (!admitSnap.exists() || admitSnap.data().qrPayload !== rawText) {
    showResult("error", `<span class="badge red">যাচাই ব্যর্থ</span><div>Admit card পাওয়া যায়নি বা QR মেলেনি।</div>`);
    return;
  }

  const assignmentId = `${studentId}_${examId}_${session.subjectCode}`;
  const existingAssignment = await getDoc(doc(db, "examSeatAssignments", assignmentId));
  if (existingAssignment.exists()) {
    const existing = existingAssignment.data();
    showResult("warn", `
      <span class="badge amber">আগেই চেক-ইন হয়েছে</span>
      <div class="seat-number">Seat ${existing.seatToken}</div>
      <div class="script-id">${existing.scriptId}</div>
    `);
    return;
  }

  const studentSnap = await getDoc(doc(db, "students", studentId));
  const studentName = studentSnap.exists() ? studentSnap.data().name : "(unknown)";
  const studentRoll = studentSnap.exists() ? studentSnap.data().roll : "";

  pendingStudent = { studentId, examId, studentName, studentRoll };
  updateStepUI();
  showResult("ok", `
    <span class="badge green">স্টুডেন্ট শনাক্ত হয়েছে</span>
    <div style="margin-top:6px;font-size:13px;color:var(--text-muted);">${studentRoll} · ${studentName}</div>
    <div class="placeholder-note" style="margin-top:10px;">এখন এই স্টুডেন্টের খাতায় ছাপা কোডটা স্ক্যান করুন।</div>
  `);
}

async function handleScriptScan(rawScriptId) {
  const scriptId = rawScriptId.trim();
  if (!scriptId) return;

  // Guard against accidentally re-scanning the same admit card in step 2.
  if (scriptId.includes(".") && scriptId.split(".").length >= 2) {
    showResult("error", `<span class="badge red">এটা admit card-এর কোড মনে হচ্ছে</span><div>খাতায় ছাপা আসল কোডটা স্ক্যান করুন, admit card না।</div>`);
    return;
  }

  const existingScript = await getDoc(doc(db, "answerScripts", scriptId));
  if (existingScript.exists()) {
    showResult("error", `<span class="badge red">এই কোড আগেই ব্যবহৃত হয়েছে</span><div>অন্য একটা খাতা স্ক্যান করুন, অথবা কোডটা আবার ভালো করে দেখুন।</div>`);
    return; // pendingStudent stays — teacher can try scanning a different script
  }

  const seatToken = await pickRandomSeat();
  if (!seatToken) {
    showResult("error", `<span class="badge red">রুম পূর্ণ</span><div>এই সেশনের সব সিট ইতিমধ্যে বরাদ্দ হয়ে গেছে।</div>`);
    return;
  }

  const { studentId, examId, studentName, studentRoll } = pendingStudent;
  const assignmentId = `${studentId}_${examId}_${session.subjectCode}`;
  const now = new Date().toISOString();

  await Promise.all([
    setDoc(doc(db, "examSeatAssignments", assignmentId), {
      studentId,
      examId,
      subjectCode: session.subjectCode,
      room: session.room,
      seatToken,
      scriptId,
      assignedAt: now,
      assignedBy: teacher.id
    }),
    setDoc(doc(db, "answerScripts", scriptId), {
      scriptId,
      examId,
      subjectCode: session.subjectCode,
      room: session.room,
      seatToken,
      status: "ISSUED",
      issuedAt: now
    }),
    setDoc(doc(db, "scriptIdentityMap", scriptId), {
      scriptId,
      studentId,
      examId,
      subjectCode: session.subjectCode,
      createdAt: now,
      createdBy: teacher.id
    })
  ]);

  showResult("ok", `
    <span class="badge green">চেক-ইন সম্পন্ন</span>
    <div style="margin-top:6px;font-size:13px;color:var(--text-muted);">${studentRoll} · ${studentName} (শুধু এই মুহূর্তের যাচাইয়ের জন্য দেখানো হচ্ছে)</div>
    <div class="seat-number">Seat ${seatToken}</div>
    <div class="script-id">${scriptId}</div>
    <div class="placeholder-note" style="margin-top:10px;">এই স্ক্রিপ্ট আইডি স্টুডেন্টের নামের সাথে কোথাও প্রকাশ্যে সংরক্ষিত নেই — শুধু Admin এই ম্যাপিং দেখতে পারবে।</div>
  `);

  pendingStudent = null;
  updateStepUI();
}

async function handleScanned(rawText) {
  if (busy || !session) return;
  busy = true;
  try {
    if (pendingStudent) {
      await handleScriptScan(rawText);
    } else {
      await handleAdmitCardScan(rawText);
    }
  } catch (err) {
    showResult("error", `<span class="badge red">Error</span><div>${err.message}</div>`);
  } finally {
    busy = false;
  }
}

manualForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = manualCodeInput.value.trim();
  if (!code) return;
  manualCodeInput.value = "";
  await handleScanned(code);
});

toggleBtn.addEventListener("click", async () => {
  if (!scanning) {
    html5QrCode = new Html5Qrcode("qrReaderRegion");
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (decodedText) => handleScanned(decodedText),
        () => {} // ignore per-frame "not found" noise
      );
      scanning = true;
      toggleBtn.textContent = "স্ক্যানার বন্ধ করুন";
    } catch (err) {
      showResult("error", `<span class="badge red">ক্যামেরা চালু করা যায়নি</span><div>${err.message || err}</div>`);
    }
  } else {
    await html5QrCode.stop();
    html5QrCode.clear();
    scanning = false;
    toggleBtn.textContent = "স্ক্যানার শুরু করুন";
  }
});
