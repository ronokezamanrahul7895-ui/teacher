/* Firestore collection for this page: examSeatAssignments/{studentId}_{examId}_{subjectCode}
   Read-only view of the active session's seating. Deliberately never
   fetches or displays studentId/name here — the whole point of the
   architecture is that after check-in, seat/script data stands on its
   own without a visible identity link. */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { requireActiveSession } from "./session.js";
import { db, collection, query, where, getDocs } from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("seat-assignment.html", teacher);

const session = requireActiveSession();
const seatGrid = document.getElementById("seatGrid");
const assignmentsBody = document.getElementById("assignmentsBody");

if (session) {
  document.getElementById("sessionInfoCard").innerHTML = `
    <strong>${session.subjectTitle}</strong> — ${session.examName}
    <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
      রুম: ${session.room || "-"} · মোট সিট: ${session.totalSeats || "-"}
    </div>
  `;
}

async function load() {
  if (!session) return;
  const snap = await getDocs(
    query(
      collection(db, "examSeatAssignments"),
      where("examId", "==", session.examId),
      where("subjectCode", "==", session.subjectCode)
    )
  );
  const assignments = snap.docs.map((d) => d.data());
  const bySeat = new Map(assignments.map((a) => [a.seatToken, a]));

  const total = session.totalSeats || 40;
  let gridHtml = "";
  for (let i = 1; i <= total; i++) {
    const token = String(i).padStart(2, "0");
    const taken = bySeat.has(token);
    gridHtml += `<div class="seat-cell ${taken ? "taken" : "empty"}" title="${taken ? bySeat.get(token).scriptId : "খালি"}">${token}</div>`;
  }
  seatGrid.innerHTML = gridHtml;

  assignmentsBody.innerHTML = assignments.length
    ? assignments
        .sort((a, b) => a.seatToken.localeCompare(b.seatToken))
        .map(
          (a) => `<tr><td>${a.seatToken}</td><td class="script-id" style="font-family:monospace;">${a.scriptId}</td><td>${(a.assignedAt || "").slice(0, 16).replace("T", " ")}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="placeholder-note">এখনো কোনো সিট বরাদ্দ হয়নি। QR Scanner দিয়ে চেক-ইন শুরু করুন।</td></tr>`;
}

load();
