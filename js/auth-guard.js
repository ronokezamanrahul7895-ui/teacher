/* =========================================================================
   auth-guard.js  (Teacher Portal)
   -------------------------------------------------------------------------
   Import this at the top of every protected page (everything except
   login.html). It resolves to the logged-in teacher's Firestore document
   from teachers/{teacherId}.

   Usage in a page's own JS file:
       import { requireTeacher } from "./auth-guard.js";
       const teacher = await requireTeacher();
       // teacher = { id, name, subject, phone, email, ... }
   ========================================================================= */

import { auth, db, onAuthStateChanged, doc, getDoc, signOut } from "./firebase-config.js";

export function requireTeacher() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      const teacherSnap = await getDoc(doc(db, "teachers", user.uid));
      if (!teacherSnap.exists()) {
        /* Signed in with Firebase Auth but no teachers/{uid} document yet
           means Exam Committee / Dashboard hasn't finished setting up this
           account — don't let them into the portal with blank data. */
        alert("প্রোফাইল এখনো সেটআপ হয়নি। এক্সাম কমিটির সাথে যোগাযোগ করুন।");
        await signOut(auth);
        window.location.href = "login.html";
        return;
      }
      resolve({ id: user.uid, ...teacherSnap.data() });
    });
  });
}
