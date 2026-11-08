/* Firestore doc for this page: teachers/{teacherId} — read-only here, same
   as the Student Portal's own profile.html. Editing a teacher's profile is
   Exam Committee / Dashboard work, not something the teacher does here. */
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";

const teacher = await requireTeacher();
renderLayout("profile.html", teacher);

document.getElementById("profileCard").innerHTML = `
  <div class="form-group"><label>Name</label><input value="${teacher.name ?? ""}" disabled /></div>
  <div class="form-group"><label>Subject</label><input value="${teacher.subject ?? ""}" disabled /></div>
  <div class="form-group"><label>Phone</label><input value="${teacher.phone ?? ""}" disabled /></div>
  <div class="form-group"><label>Email</label><input value="${teacher.email ?? ""}" disabled /></div>
  <div class="placeholder-note">প্রোফাইল পরিবর্তনের জন্য Exam Committee-র সাথে যোগাযোগ করুন।</div>
`;
