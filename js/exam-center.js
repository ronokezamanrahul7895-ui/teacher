/* Firestore collections for this page:
     exams/{examId}                         — read, for the subject list
     examSessions/{examId}_{subjectCode}     — read, to show session status
   This page is a read-only overview. Opening/closing a session actually
   happens on subject-selection.html. */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { setActiveSession } from "./session.js";
import { db, collection, getDocs, doc, getDoc } from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("exam-center.html", teacher);

const examsArea = document.getElementById("examsArea");

async function loadExams() {
  const examsSnap = await getDocs(collection(db, "exams"));
  if (examsSnap.empty) {
    examsArea.innerHTML = `<div class="card"><div class="placeholder-note">এখনো কোনো পরীক্ষা যোগ হয়নি।</div></div>`;
    return;
  }

  const exams = examsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const cards = await Promise.all(
    exams.map(async (exam) => {
      const subjects = exam.subjects || [];
      const rows = await Promise.all(
        subjects.map(async (subj) => {
          const sessionSnap = await getDoc(doc(db, "examSessions", `${exam.id}_${subj.code}`));
          const session = sessionSnap.exists() ? sessionSnap.data() : null;
          const statusBadge = !session
            ? `<span class="badge amber">খোলা হয়নি</span>`
            : session.status === "OPEN"
            ? `<span class="badge green">চলমান — ${session.room || ""}</span>`
            : `<span class="badge red">বন্ধ</span>`;
          return `
            <tr>
              <td>${subj.code}</td>
              <td>${subj.title}</td>
              <td>${subj.date || ""} ${subj.room ? "· " + subj.room : ""}</td>
              <td>${statusBadge}</td>
              <td>
                <button class="btn btn-secondary" data-open="${exam.id}|${subj.code}|${exam.name}|${subj.title}" style="padding:5px 12px;font-size:12px;">
                  ${session && session.status === "OPEN" ? "এই সেশনে যান" : "সেশন খুলুন"}
                </button>
              </td>
            </tr>`;
        })
      );

      return `
        <div class="card">
          <strong>${exam.name}</strong> <span style="color:var(--text-muted);font-size:13px;">(${exam.trimester || ""} · ${exam.date || ""})</span>
          <div style="overflow-x:auto;margin-top:10px;">
            <table>
              <thead><tr><th>কোড</th><th>বিষয়</th><th>তারিখ/রুম</th><th>স্ট্যাটাস</th><th></th></tr></thead>
              <tbody>${rows.join("") || `<tr><td colspan="5" class="placeholder-note">কোনো বিষয় যোগ নেই।</td></tr>`}</tbody>
            </table>
          </div>
        </div>`;
    })
  );

  examsArea.innerHTML = cards.join("");

  examsArea.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [examId, subjectCode, examName, subjectTitle] = btn.getAttribute("data-open").split("|");
      window.location.href = `subject-selection.html?examId=${encodeURIComponent(examId)}&subjectCode=${encodeURIComponent(subjectCode)}`;
    });
  });
}

loadExams();
