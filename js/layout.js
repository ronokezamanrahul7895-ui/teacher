/* =========================================================================
   layout.js  (Teacher Portal)
   -------------------------------------------------------------------------
   Renders the header + sidebar that every page shares. Each HTML page only
   needs:
     <div id="header-root"></div>
     <div id="sidebar-backdrop-root"></div>
     <div class="app-shell">
       <div id="sidebar-root"></div>
       <main class="main-content">...page content...</main>
     </div>

   Then calls renderLayout("dashboard.html", teacher) once the teacher
   object comes back from auth-guard.js.
   ========================================================================= */

import { auth, signOut } from "./firebase-config.js";
import { getActiveSession } from "./session.js";

const NAV_ITEMS = [
  { href: "dashboard.html", label: "Home" },
  { href: "profile.html", label: "Profile" },
  { href: "password-change.html", label: "Password Change" },
  { href: "student-management.html", label: "Student Management" },
  { href: "exam-center.html", label: "Exam Center" },
  { href: "subject-selection.html", label: "Subject Selection" },
  { href: "qr-scanner.html", label: "QR Scanner" },
  { href: "seat-assignment.html", label: "Seat Assignment" },
  { href: "answer-sheet-scanning.html", label: "Answer Sheet Scanning" },
  { href: "script-management.html", label: "Script Management" }
];

export function renderLayout(activeHref, teacher) {
  const initials = (teacher.name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  document.getElementById("header-root").innerHTML = `
    <header class="app-header">
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="menu-toggle" id="menuToggleBtn" aria-label="Menu">&#9776;</button>
        <div class="brand">
          <div class="logo">TP</div>
          <span class="full-name">Teacher Portal</span>
        </div>
      </div>
      <div class="user">
        <div class="avatar">${initials}</div>
        <div>
          <div>${teacher.name || ""}${teacher.subject ? " | " + teacher.subject : ""}</div>
          <a href="#" class="logout-link" id="logoutBtn">Logout</a>
        </div>
      </div>
    </header>
  `;

  document.getElementById("sidebar-backdrop-root").innerHTML =
    `<div class="sidebar-backdrop" id="sidebarBackdrop"></div>`;

  const session = getActiveSession();
  const sessionBannerHtml = session
    ? `<li class="sidebar-session-badge">সক্রিয় সেশন: <strong>${session.subjectTitle}</strong><br/>(${session.examName})</li>`
    : `<li class="sidebar-session-badge muted">কোনো সেশন খোলা নেই</li>`;

  const navHtml = NAV_ITEMS.map((item) => {
    const isActive = item.href === activeHref;
    return `<li><a class="nav-link${isActive ? " active" : ""}" href="${item.href}">${item.label}</a></li>`;
  }).join("");

  document.getElementById("sidebar-root").innerHTML = `
    <nav class="sidebar" id="sidebarNav">
      <ul>${sessionBannerHtml}${navHtml}</ul>
    </nav>
  `;

  const sidebar = document.getElementById("sidebarNav");
  const backdrop = document.getElementById("sidebarBackdrop");
  document.getElementById("menuToggleBtn").addEventListener("click", () => {
    sidebar.classList.toggle("open");
    backdrop.classList.toggle("open");
  });
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
  });

  document.getElementById("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = "login.html";
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
