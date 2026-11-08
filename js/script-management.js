/* Firestore collection for this page: answerScripts/{scriptId}
   Inventory + single-script lookup, always keyed by scriptId. Phase 4
   (Exam Committee) will read this same collection for marks entry, also
   by scriptId — the identity link never has to leave scriptIdentityMap,
   which this portal cannot read (see firestore.rules). */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { requireActiveSession } from "./session.js";
import { db, doc, getDoc, collection, query, where, getDocs } from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("script-management.html", teacher);

const session = requireActiveSession();
if (session) {
  document.getElementById("sessionInfoCard").innerHTML = `
    <strong>${session.subjectTitle}</strong> — ${session.examName}
    <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
      রুম: ${session.room || "-"}
    </div>
  `;
}

const lookupBox = document.getElementById("lookupBox");
const lookupBtn = document.getElementById("lookupBtn");
const lookupResult = document.getElementById("lookupResult");
const filterBox = document.getElementById("filterBox");
const scriptsBody = document.getElementById("scriptsBody");

function statusBadge(status) {
  return status === "COLLECTED"
    ? `<span class="badge green">Collected</span>`
    : `<span class="badge amber">Issued</span>`;
}

async function lookupScript() {
  const id = lookupBox.value.trim();
  if (!id) return;
  lookupResult.innerHTML = `<div class="placeholder-note" style="margin-top:10px;">খোঁজা হচ্ছে...</div>`;
  const snap = await getDoc(doc(db, "answerScripts", id));
  if (!snap.exists()) {
    lookupResult.innerHTML = `<div class="placeholder-note" style="margin-top:10px;">এই আইডির কোনো স্ক্রিপ্ট পাওয়া যায়নি।</div>`;
    return;
  }
  const s = snap.data();
  lookupResult.innerHTML = `
    <div class="card" style="margin-top:10px;margin-bottom:0;">
      <div class="script-id">${s.scriptId}</div>
      <div style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:14px;">
        <div>সিট: <strong>${s.seatToken}</strong></div>
        <div>রুম: <strong>${s.room || "-"}</strong></div>
        <div>বিষয়: <strong>${s.subjectCode}</strong></div>
        <div>স্ট্যাটাস: ${statusBadge(s.status)}</div>
        <div>ইস্যু: <strong>${(s.issuedAt || "").slice(0, 16).replace("T", " ")}</strong></div>
        <div>জমা: <strong>${s.collectedAt ? s.collectedAt.slice(0, 16).replace("T", " ") : "-"}</strong></div>
      </div>
    </div>
  `;
}

lookupBtn.addEventListener("click", lookupScript);
lookupBox.addEventListener("keydown", (e) => { if (e.key === "Enter") lookupScript(); });

let allScripts = [];

function renderScriptRows(list) {
  scriptsBody.innerHTML = list.length
    ? list
        .sort((a, b) => (a.seatToken || "").localeCompare(b.seatToken || ""))
        .map(
          (s) => `<tr>
            <td style="font-family:monospace;">${s.scriptId}</td>
            <td>${s.seatToken}</td>
            <td>${statusBadge(s.status)}</td>
            <td>${(s.issuedAt || "").slice(0, 16).replace("T", " ")}</td>
            <td>${s.collectedAt ? s.collectedAt.slice(0, 16).replace("T", " ") : "-"}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="placeholder-note">এখনো কোনো স্ক্রিপ্ট ইস্যু হয়নি।</td></tr>`;
}

filterBox.addEventListener("input", () => {
  const term = filterBox.value.trim().toLowerCase();
  if (!term) {
    renderScriptRows(allScripts);
    return;
  }
  renderScriptRows(
    allScripts.filter((s) =>
      [s.status, s.seatToken].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
    )
  );
});

async function loadScripts() {
  if (!session) return;
  const snap = await getDocs(
    query(
      collection(db, "answerScripts"),
      where("examId", "==", session.examId),
      where("subjectCode", "==", session.subjectCode)
    )
  );
  allScripts = snap.docs.map((d) => d.data());
  renderScriptRows(allScripts);
}

loadScripts();
