/* Firestore collection for this page: examSessions/{examId}_{subjectCode}
   Opening a session here is what QR Scanner / Seat Assignment / Answer
   Sheet Scanning / Script Management all key off of (see session.js). */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { setActiveSession } from "./session.js";
import { db, collection, getDocs, doc, getDoc, setDoc } from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("subject-selection.html", teacher);

const examSelect = document.getElementById("f-exam");
const subjectSelect = document.getElementById("f-subject");
const roomInput = document.getElementById("f-room");
const totalSeatsInput = document.getElementById("f-totalSeats");
const message = document.getElementById("selectMessage");
const form = document.getElementById("selectForm");

let exams = [];

async function loadExams() {
  const snap = await getDocs(collection(db, "exams"));
  exams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!exams.length) {
    examSelect.innerHTML = `<option value="">কোনো পরীক্ষা নেই</option>`;
    return;
  }

  examSelect.innerHTML = exams
    .map((e) => `<option value="${e.id}">${e.name} (${e.trimester || ""})</option>`)
    .join("");

  populateSubjects();

  /* Pre-fill from exam-center.html's link, if present. */
  const params = new URLSearchParams(window.location.search);
  const qExamId = params.get("examId");
  const qSubjectCode = params.get("subjectCode");
  if (qExamId) {
    examSelect.value = qExamId;
    populateSubjects();
    if (qSubjectCode) subjectSelect.value = qSubjectCode;
  }

  await prefillFromExistingSession();
}

function populateSubjects() {
  const exam = exams.find((e) => e.id === examSelect.value);
  const subjects = exam?.subjects || [];
  subjectSelect.innerHTML = subjects.length
    ? subjects.map((s) => `<option value="${s.code}">${s.code} — ${s.title}</option>`).join("")
    : `<option value="">এই পরীক্ষায় কোনো বিষয় নেই</option>`;
}

async function prefillFromExistingSession() {
  const examId = examSelect.value;
  const subjectCode = subjectSelect.value;
  if (!examId || !subjectCode) return;
  const snap = await getDoc(doc(db, "examSessions", `${examId}_${subjectCode}`));
  if (snap.exists()) {
    const s = snap.data();
    roomInput.value = s.room || "";
    totalSeatsInput.value = s.totalSeats || 40;
  }
}

examSelect.addEventListener("change", () => {
  populateSubjects();
  prefillFromExistingSession();
});
subjectSelect.addEventListener("change", prefillFromExistingSession);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const exam = exams.find((ex) => ex.id === examSelect.value);
  const subject = (exam?.subjects || []).find((s) => s.code === subjectSelect.value);
  if (!exam || !subject) {
    message.style.color = "#a3271f";
    message.textContent = "পরীক্ষা বা বিষয় নির্বাচন করা যায়নি।";
    return;
  }

  const sessionId = `${exam.id}_${subject.code}`;
  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    const existingSnap = await getDoc(doc(db, "examSessions", sessionId));
    const sessionDoc = {
      examId: exam.id,
      examName: exam.name,
      subjectCode: subject.code,
      subjectTitle: subject.title,
      room: roomInput.value.trim(),
      totalSeats: Number(totalSeatsInput.value) || 40,
      status: "OPEN",
      openedBy: teacher.id,
      openedAt: existingSnap.exists() ? existingSnap.data().openedAt : new Date().toISOString()
    };
    await setDoc(doc(db, "examSessions", sessionId), sessionDoc, { merge: true });

    setActiveSession({
      sessionId,
      examId: exam.id,
      examName: exam.name,
      subjectCode: subject.code,
      subjectTitle: subject.title,
      room: sessionDoc.room,
      totalSeats: sessionDoc.totalSeats
    });

    message.style.color = "#1a6b2c";
    message.textContent = "সেশন সক্রিয় হয়েছে। QR Scanner পেজে যাচ্ছি...";
    window.location.href = "qr-scanner.html";
  } catch (err) {
    message.style.color = "#a3271f";
    message.textContent = "সেশন খোলা যায়নি: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

await loadExams();
