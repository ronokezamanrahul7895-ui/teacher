import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { getActiveSession } from "./session.js";
import { db, collection, getDocs, query, where } from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("dashboard.html", teacher);

document.getElementById("welcomeName").textContent = teacher.name ? `, ${teacher.name}` : "";

async function loadStats() {
  const statsRow = document.getElementById("statsRow");

  const [studentsSnap, examsSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "exams"))
  ]);

  const openSessionsSnap = await getDocs(
    query(collection(db, "examSessions"), where("status", "==", "OPEN"))
  );

  statsRow.innerHTML = `
    <div class="stat-tile"><div class="stat-num">${studentsSnap.size}</div><div class="stat-label">মোট স্টুডেন্ট</div></div>
    <div class="stat-tile"><div class="stat-num">${examsSnap.size}</div><div class="stat-label">মোট পরীক্ষা</div></div>
    <div class="stat-tile"><div class="stat-num">${openSessionsSnap.size}</div><div class="stat-label">খোলা সেশন</div></div>
  `;
}

function renderSessionCard() {
  const session = getActiveSession();
  const card = document.getElementById("sessionCard");
  if (!session) {
    card.innerHTML = `
      <strong>সক্রিয় সেশন</strong>
      <div class="placeholder-note" style="margin-top:8px;">
        কোনো সেশন খোলা নেই। QR Scanner / Seat Assignment / Answer Sheet Scanning ব্যবহার করতে
        <a href="subject-selection.html">Subject Selection</a> থেকে একটা সেশন খুলুন।
      </div>`;
    return;
  }
  card.innerHTML = `
    <strong>সক্রিয় সেশন</strong>
    <div style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:14px;">
      <div>পরীক্ষা: <strong>${session.examName}</strong></div>
      <div>বিষয়: <strong>${session.subjectTitle}</strong></div>
      <div>রুম: <strong>${session.room || "-"}</strong></div>
      <div>মোট সিট: <strong>${session.totalSeats || "-"}</strong></div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      <a class="btn btn-primary" href="qr-scanner.html">QR Scanner খুলুন</a>
      <a class="btn btn-secondary" href="seat-assignment.html">Seat Assignment দেখুন</a>
    </div>
  `;
}

loadStats();
renderSessionCard();
