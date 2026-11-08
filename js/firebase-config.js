/* =========================================================================
   firebase-config.js  (Teacher Portal)
   -------------------------------------------------------------------------
   Same Firebase project as the Student Portal — one firebaseConfig, one
   Firestore database. This file only re-documents the collections that
   are NEW or that the Teacher Portal touches; see the Student Portal's
   js/firebase-config.js for the full original map (students, billing,
   exams, results, classRoutine, teamsCredentials, request collections...).

   NEW COLLECTIONS INTRODUCED BY THIS PORTAL (core anonymity architecture)
   -------------------------------------------------------------------------
   One Student + One Exam  = One Admit Card QR (Student Portal, unchanged).
   Each Subject             = a NEW anonymous Answer Script + a NEW random
                               seat, created the moment the teacher scans
                               that student's admit card QR at the exam
                               center for that specific subject.

   examSessions/{examId}_{subjectCode}
       Source: written BY the Teacher Portal (Subject Selection page) when
               a teacher opens a scanning session for one subject of one
               exam.
       Fields: examId, examName, subjectCode, subjectTitle, room,
               totalSeats, status ("OPEN"|"CLOSED"), openedBy, openedAt,
               closedAt
       Read/write by: Teacher Portal (QR Scanner, Seat Assignment, Answer
               Sheet Scanning, Script Management all key off the *active*
               session, kept in sessionStorage — see js/session.js).

   examSeatAssignments/{studentId}_{examId}_{subjectCode}
       Source: written BY the Teacher Portal QR Scanner at check-in time.
       Fields: studentId, examId, subjectCode, room, seatToken, scriptId,
               assignedAt, assignedBy
       Read by: Student Portal -> seat-token.html (their own seat/token
               for that subject, never anyone else's).
       NOTE: this doc intentionally does NOT carry the student's name —
             only the Student Portal, reading its own studentId-prefixed
             doc, ever connects a seatToken back to a name.

   answerScripts/{scriptId}
       Source: created BY the Teacher Portal QR Scanner at check-in
               (scriptId is a fresh random ID, never derived from the
               student's roll/name/uid so it can't be reverse-engineered).
       Fields: scriptId, examId, subjectCode, room, seatToken,
               status ("ISSUED"|"COLLECTED"), issuedAt,
               collectedAt, collectedBy
       Read/write by: Teacher Portal (Script Management, Answer Sheet
               Scanning). Exam Committee / Dashboard also read this for
               Phase 4 marks entry — but ALWAYS by scriptId, never by
               student name, which is the whole point.
       This collection NEVER stores studentId or the student's name.

   scriptIdentityMap/{scriptId}
       Source: written BY the Teacher Portal QR Scanner in the same
               check-in step that creates the answerScript (write-only
               from this portal's point of view — it is never read back
               here).
       Fields: scriptId, studentId, examId, subjectCode, createdAt,
               createdBy
       Read by: NOBODY in this portal. Per firestore.rules, only the
               `admin` role can read this collection — it is the single
               place the student <-> script identity link lives, exactly
               as required by the Phase 5 "secret student <-> script
               mapping, only Admin can reveal it" rule.

   Also touched (see Student Portal's firebase-config.js for full shape):
     students/{studentId}   — Teacher Portal can read/write/delete (per
                               firestore.rules role hierarchy).
     teachers/{teacherId}   — this portal's own login reads its own doc.
     exams/{examId}         — read, to list subjects for Subject Selection.
     classRoutine, teamsCredentials — written by this portal (read-only
                               on the Student Portal side).
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* Active Firebase project: annsms. Must match the other portals' config exactly. */
const firebaseConfig = {
  apiKey: "AIzaSyDNFcGBqeTCgMFFwHP7Em6NHym8SAxKTjg",
  authDomain: "annsms.firebaseapp.com",
  projectId: "annsms",
  storageBucket: "annsms.firebasestorage.app",
  messagingSenderId: "536095253963",
  appId: "1:536095253963:web:4480afca40aea36935824e",
  measurementId: "G-F1MHT5GCJ6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
};
