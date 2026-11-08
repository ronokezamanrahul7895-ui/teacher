/* Firestore collection for this page: students/{studentId}
   Teacher Portal has read + edit + delete access per firestore.rules
   (role() in ['teacher','examCommittee','admin']). Creating brand new
   student accounts (which also needs a Firebase Auth user) stays Exam
   Committee / Dashboard work — this page only edits/deletes existing
   students, matching the plan's "Teacher -> can edit/delete students/*". */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { db, collection, getDocs, doc, updateDoc, deleteDoc } from "./firebase-config.js";

const teacher = await requireTeacher();
renderLayout("student-management.html", teacher);

const studentsBody = document.getElementById("studentsBody");
const searchBox = document.getElementById("searchBox");
const editCard = document.getElementById("editCard");
const editForm = document.getElementById("editForm");
const editMessage = document.getElementById("editMessage");

let allStudents = [];

function renderRows(list) {
  if (!list.length) {
    studentsBody.innerHTML = `<tr><td colspan="6" class="placeholder-note">কোনো স্টুডেন্ট পাওয়া যায়নি।</td></tr>`;
    return;
  }
  studentsBody.innerHTML = list
    .map(
      (s) => `
      <tr>
        <td>${s.roll ?? ""}</td>
        <td>${s.name ?? ""}</td>
        <td>${s.className ?? ""}</td>
        <td>${s.program ?? ""}</td>
        <td>${s.phone ?? ""}</td>
        <td><button class="btn btn-secondary" data-edit="${s.id}" style="padding:5px 12px;font-size:12px;">Edit</button></td>
      </tr>`
    )
    .join("");

  studentsBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEdit(btn.getAttribute("data-edit")));
  });
}

async function loadStudents() {
  const snap = await getDocs(collection(db, "students"));
  allStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderRows(allStudents);
}

searchBox.addEventListener("input", () => {
  const term = searchBox.value.trim().toLowerCase();
  if (!term) {
    renderRows(allStudents);
    return;
  }
  renderRows(
    allStudents.filter((s) =>
      [s.name, s.roll, s.className, s.program]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    )
  );
});

function openEdit(id) {
  const s = allStudents.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("e-id").value = s.id;
  document.getElementById("e-name").value = s.name ?? "";
  document.getElementById("e-roll").value = s.roll ?? "";
  document.getElementById("e-className").value = s.className ?? "";
  document.getElementById("e-program").value = s.program ?? "";
  document.getElementById("e-batch").value = s.batch ?? "";
  document.getElementById("e-phone").value = s.phone ?? "";
  document.getElementById("e-guardianPhone").value = s.guardianPhone ?? "";
  document.getElementById("e-email").value = s.email ?? "";
  editMessage.textContent = "";
  editCard.style.display = "block";
  editCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  editCard.style.display = "none";
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("e-id").value;
  const submitBtn = editForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    await updateDoc(doc(db, "students", id), {
      name: document.getElementById("e-name").value.trim(),
      roll: document.getElementById("e-roll").value.trim(),
      className: document.getElementById("e-className").value.trim(),
      program: document.getElementById("e-program").value.trim(),
      batch: document.getElementById("e-batch").value.trim(),
      phone: document.getElementById("e-phone").value.trim(),
      guardianPhone: document.getElementById("e-guardianPhone").value.trim(),
      email: document.getElementById("e-email").value.trim()
    });
    editMessage.style.color = "#1a6b2c";
    editMessage.textContent = "সংরক্ষণ হয়েছে।";
    await loadStudents();
  } catch (err) {
    editMessage.style.color = "#a3271f";
    editMessage.textContent = "সংরক্ষণ করা যায়নি: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById("deleteBtn").addEventListener("click", async () => {
  const id = document.getElementById("e-id").value;
  const s = allStudents.find((x) => x.id === id);
  if (!confirm(`${s?.name ?? "এই স্টুডেন্ট"}-কে মুছে ফেলতে চান? এই কাজটি ফেরানো যাবে না।`)) return;

  try {
    await deleteDoc(doc(db, "students", id));
    editCard.style.display = "none";
    await loadStudents();
  } catch (err) {
    editMessage.style.color = "#a3271f";
    editMessage.textContent = "মুছে ফেলা যায়নি: " + err.message;
  }
});

await loadStudents();
