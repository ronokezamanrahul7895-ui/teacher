/* Firestore collection for this page: answerScripts/{scriptId}
   Only ever looked up / updated by scriptId — never by student. That's
   deliberate: whoever is collecting scripts at the end of an exam has no
   business (and no way, via this page) matching a script back to a name. */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { requireActiveSession } from "./session.js";
import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("answer-sheet-scanning.html", teacher);

const session = requireActiveSession();
if (session) {
  document.getElementById("sessionInfoCard").innerHTML = `
    <strong>${session.subjectTitle}</strong> — ${session.examName}
    <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
      রুম: ${session.room || "-"}
    </div>
  `;
}

const toggleBtn = document.getElementById("toggleScanBtn");
const resultCard = document.getElementById("resultCard");
const manualForm = document.getElementById("manualForm");
const progressArea = document.getElementById("progressArea");
let html5QrCode = null;
let scanning = false;
let busy = false;

function showResult(html) {
  resultCard.style.display = "block";
  resultCard.innerHTML = html;
}

async function markCollected(scriptId) {
  if (busy || !session) return;
  busy = true;
  scriptId = scriptId.trim();

  try {
    const scriptSnap = await getDoc(doc(db, "answerScripts", scriptId));
    if (!scriptSnap.exists()) {
      showResult(`<span class="badge red">খুঁজে পাওয়া যায়নি</span><div>স্ক্রিপ্ট আইডি "${scriptId}" রেকর্ডে নেই।</div>`);
      return;
    }
    const script = scriptSnap.data();
    if (script.examId !== session.examId || script.subjectCode !== session.subjectCode) {
      showResult(`<span class="badge amber">ভুল সেশন</span><div>এই স্ক্রিপ্টটি অন্য পরীক্ষা/বিষয়ের জন্য ইস্যু করা।</div>`);
      return;
    }
    if (script.status === "COLLECTED") {
      showResult(`
        <span class="badge amber">আগেই জমা নেওয়া হয়েছে</span>
        <div class="script-id">${scriptId}</div>
        <div style="margin-top:6px;font-size:13px;color:var(--text-muted);">সিট ${script.seatToken}</div>
      `);
      return;
    }

    await updateDoc(doc(db, "answerScripts", scriptId), {
      status: "COLLECTED",
      collectedAt: new Date().toISOString(),
      collectedBy: teacher.id
    });

    showResult(`
      <span class="badge green">জমা নেওয়া হয়েছে</span>
      <div class="script-id">${scriptId}</div>
      <div style="margin-top:6px;font-size:13px;color:var(--text-muted);">সিট ${script.seatToken}</div>
    `);
    await loadProgress();
  } catch (err) {
    showResult(`<span class="badge red">Error</span><div>${err.message}</div>`);
  } finally {
    busy = false;
  }
}

manualForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = document.getElementById("manualScriptId").value;
  if (val.trim()) markCollected(val);
  manualForm.reset();
});

toggleBtn.addEventListener("click", async () => {
  if (!scanning) {
    html5QrCode = new Html5Qrcode("qrReaderRegion");
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (decodedText) => markCollected(decodedText),
        () => {}
      );
      scanning = true;
      toggleBtn.textContent = "স্ক্যানার বন্ধ করুন";
    } catch (err) {
      showResult(`<span class="badge red">ক্যামেরা চালু করা যায়নি</span><div>${err.message || err}</div>`);
    }
  } else {
    await html5QrCode.stop();
    html5QrCode.clear();
    scanning = false;
    toggleBtn.textContent = "স্ক্যানার শুরু করুন";
  }
});

async function loadProgress() {
  if (!session) return;
  const snap = await getDocs(
    query(
      collection(db, "answerScripts"),
      where("examId", "==", session.examId),
      where("subjectCode", "==", session.subjectCode)
    )
  );
  const scripts = snap.docs.map((d) => d.data());
  const collected = scripts.filter((s) => s.status === "COLLECTED").length;
  progressArea.innerHTML = `
    <div style="display:flex;gap:20px;align-items:center;">
      <div class="stat-tile" style="min-width:110px;"><div class="stat-num">${collected}</div><div class="stat-label">জমা হয়েছে</div></div>
      <div class="stat-tile" style="min-width:110px;"><div class="stat-num">${scripts.length}</div><div class="stat-label">মোট ইস্যু</div></div>
    </div>
  `;
}

loadProgress();
