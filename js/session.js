/* =========================================================================
   session.js
   -------------------------------------------------------------------------
   QR Scanner, Seat Assignment, Answer Sheet Scanning and Script Management
   all operate on ONE "active session" at a time — one exam + one subject,
   opened from subject-selection.html (which writes/opens an
   examSessions/{examId}_{subjectCode} document).

   Kept in sessionStorage (tab-local, cleared on logout/close) rather than
   Firestore-fetched-on-every-page so switching between these four pages
   doesn't need a fresh query each time. subject-selection.js is the only
   place that writes it; every other page just reads it.

   Shape stored:
     { examId, examName, subjectCode, subjectTitle, room, totalSeats,
       sessionId }   // sessionId = `${examId}_${subjectCode}`
   ========================================================================= */

const KEY = "teacherPortal.activeSession";

export function getActiveSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearActiveSession() {
  sessionStorage.removeItem(KEY);
}

/* Call at the top of qr-scanner.js / seat-assignment.js /
   answer-sheet-scanning.js / script-management.js. Redirects to
   Subject Selection with a message if no session is open yet. */
export function requireActiveSession() {
  const session = getActiveSession();
  if (!session) {
    alert("আগে Subject Selection পেজ থেকে একটা সেশন খুলুন।");
    window.location.href = "subject-selection.html";
    return null;
  }
  return session;
}
