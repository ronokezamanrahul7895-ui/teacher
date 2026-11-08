# Teacher Portal

Part of a 4-portal system:

1. Student Portal — separate project (already built).
2. **Teacher Portal** (this project) — can edit/delete `students/*`.
3. Exam Committee Portal — separate project, can edit/delete `students/*` and `teachers/*`.
4. Dashboard (admin) — separate project, can edit/delete everything.

All four share the **same Firebase project** (one `firebaseConfig`, one
Firestore database) so data written in one portal shows up instantly in
the others. Copy the real project keys from the Student Portal's
`js/firebase-config.js` into this portal's `js/firebase-config.js` — they
must match.

## Core architecture rule (Phase 3 exists to implement this)

> One Student + One Exam = One Admit Card QR; each Subject = New Anonymous
> Answer Script + New Random Seat; Student/Teacher/Committee cannot see
> the identity mapping; only authorized Admin can reveal it.

Concretely: when a teacher scans a student's admit card QR in the QR
Scanner for a given subject, the portal generates a brand-new random
`scriptId` and a random `seatToken` for that (student, subject) pair, and
splits the data three ways:

- `examSeatAssignments/{studentId}_{examId}_{subjectCode}` — lets the
  student see their own seat/token. Has `studentId` (they already know
  who they are), but no script-to-name info leaks from here to anyone
  else browsing the collection because reads are self-scoped.
- `answerScripts/{scriptId}` — the record graders and script-management
  actually work with. **Never contains `studentId` or a name.**
- `scriptIdentityMap/{scriptId}` — the one place the link between
  `studentId` and `scriptId` lives. Teachers can **create** this (the
  physical ID check happens at their desk) but per `firestore.rules`
  cannot read it back — only the `admin` role can.

## Folder structure

```
teacher-portal/
  index.html                 -> redirects to login.html
  login.html                 -> not protected, entry point
  dashboard.html              -> Home (stats + active-session shortcut)
  profile.html                 -> read-only own teacher profile
  password-change.html         -> fully functional (Firebase Auth)
  student-management.html      -> search/edit/delete students/*
  exam-center.html             -> browse exams + subjects + session status
  subject-selection.html       -> open/resume an examSessions/* session
  qr-scanner.html              -> core check-in: TWO scans per student —
                                   (1) admit card identifies the student,
                                   (2) the code printed on their physical
                                   script becomes scriptId -> seat + script
  seat-assignment.html         -> seat map + list for the active session
  answer-sheet-scanning.html   -> mark collected scripts by scriptId
  script-management.html       -> script inventory + single-script lookup
  manifest.json + service-worker.js   -> installable (PWA)
  firestore.rules              -> project-wide rules (superset of Student Portal's)
  css/style.css                -> same design system as Student Portal, + a
                                   few additions (seat grid, scanner box, stat tiles)
  js/
    firebase-config.js   -> single Firebase init + collection map (NEW/updated
                             collections only — read Student Portal's copy too)
    auth-guard.js         -> requireTeacher(), used by every protected page
    layout.js              -> shared header/sidebar, shows the active session
    session.js              -> sessionStorage helper for the "active session"
                                (exam + subject) that 4 of the pages share
    login.js
    <page-name>.js          -> one JS file per HTML page, same name
```

## How a new page is wired

Same pattern as the Student Portal:

```js
import { requireTeacher } from "./auth-guard.js";
import { renderLayout } from "./layout.js";

const teacher = await requireTeacher();
renderLayout("this-page.html", teacher);
```

Pages that work inside one exam-center session additionally do:

```js
import { requireActiveSession } from "./session.js";
const session = requireActiveSession(); // bounces to subject-selection.html if none open
```

## What's fully built vs. placeholder

**Fully working:** login, dashboard (stats + active session card), profile
(read-only), password change, student management (search, edit, delete —
creating brand-new student accounts is Exam Committee/Dashboard work since
it also needs a Firebase Auth user), exam center (browse exams/subjects +
session status, jump to Subject Selection), subject selection (open or
resume an `examSessions` doc, becomes the shared active session), QR
scanner (camera-based, via `html5-qrcode` — verifies the admit card
payload against `admitCards/*`, blocks duplicate check-ins, then a SECOND
scan reads the code already printed on the student's physical script as
`scriptId` — never invented by this code — checks it hasn't been used by
someone else this session, picks a random free seat, and writes all three
collections described above), seat assignment (live seat grid + list for
the active session, deliberately never shows a student name), answer
sheet scanning (camera scan or manual entry of a `scriptId`, marks it
`COLLECTED`, shows live collection progress), script management (search
any script by ID, or browse/filter the active session's full script
list).

**Still needed before this goes to production**, none of which live in
this portal's code:
- The admit card QR payload isn't cryptographically signed by default
  (Spark/free-plan setup — see Exam Committee Portal's `js/billing.js`
  and Student Portal's `js/admit-card.js`). QR Scanner only checks the
  scanned payload string against what's stored in
  `admitCards/{studentId}_{examId}`, which is enough since students
  never get write access to that collection either way — they can't
  forge their own admit card. If this project later moves to Blaze and
  switches to the optional HMAC-signed Cloud Function path (see Student
  Portal's `functions/index.js`), this page's admit-card check should be
  upgraded to verify the signature too, not just existence.
- The random-seat picker in `js/qr-scanner.js` reads then writes
  client-side — fine for a single teacher's device but not safe against
  two teachers scanning into the same session at the same instant (a
  Cloud Function with a Firestore transaction should own seat allocation
  in production).
- Real subject/exam catalogs: this portal reads `exams/{examId}.subjects`
  as already-modeled by Exam Committee — no catalog editing lives here.
- Phase 4 (Exam Committee: script scanning, marks entry, result
  preparation/confirmation) and Phase 5 (Dashboard: the only place that
  can actually read `scriptIdentityMap`) are separate portals, not part
  of this one.

## Before deploying

1. Replace the placeholder values in `js/firebase-config.js` with the
   same real Firebase project config as the Student Portal.
2. Deploy this `firestore.rules` file at the project level — it's a
   synced copy of the canonical version that ships in the Admin
   Dashboard project (that's the one to treat as source of truth; deploy
   it project-wide, it covers all four portals).
3. Make sure teacher accounts have a matching `teachers/{uid}` Firestore
   document — created via the Admin Dashboard's Accounts page
   (client-side, no Cloud Function). There's no custom claim to set:
   `firestore.rules`' `role()` resolves role by checking which
   collection has a doc at the caller's uid — `auth-guard.js` blocks
   sign-in if no `teachers/{uid}` doc exists.
4. Generate real `icons/icon-192.png` and `icons/icon-512.png` for the
   PWA manifest (placeholders not included here, same as Student Portal).
