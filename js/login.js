import { auth, db, signInWithEmailAndPassword, doc, getDoc } from "./firebase-config.js";

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    /* Belt-and-braces: confirm a teachers/{uid} doc exists before sending
       them into the portal (auth-guard.js checks this again on every
       page too, but catching it here avoids a login->bounce flash). */
    const teacherSnap = await getDoc(doc(db, "teachers", cred.user.uid));
    if (!teacherSnap.exists()) {
      errorBox.textContent = "এই অ্যাকাউন্টের জন্য কোনো Teacher প্রোফাইল পাওয়া যায়নি।";
      errorBox.style.display = "block";
      return;
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    errorBox.textContent = "ইমেইল অথবা পাসওয়ার্ড ভুল হয়েছে।";
    errorBox.style.display = "block";
  }
});
