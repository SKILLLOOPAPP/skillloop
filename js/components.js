/* ---------- Skill Loop — shared header & footer ---------- */
/* Include on every page:
   <div id="site-header"></div> ... <div id="site-footer"></div>
   <script src="js/components.js"></script>
   Set data-active="home|dashboard|about|login" on the <body> tag
   to highlight the matching nav link.
*/

function skillLoopHeader() {
  return `
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="index.html">
        <span class="logo-dot"></span>
        Skill Loop
      </a>

      <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation">☰</button>

      <nav class="main-nav" id="mainNav">
        <a href="index.html" data-page="home">Home</a>
        <a href="dashboard.html" data-page="dashboard">My Loops</a>
        <a href="about.html" data-page="about">About</a>
        <a href="login.html" class="btn btn-primary login-btn" data-page="login">Log in</a>
      </nav>
    </div>
  </header>`;
}

function skillLoopFooter() {
  const year = new Date().getFullYear();
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-col">
          <h5>Skill Loop</h5>
          <p style="color: var(--text-dim); font-size: 0.88rem; max-width: 260px;">
            Build tiny daily loops around any skill and watch the streaks add up.
          </p>
        </div>
        <div class="footer-col">
          <h5>Product</h5>
          <a href="index.html">Home</a>
          <a href="dashboard.html">My Loops</a>
          <a href="about.html">About</a>
        </div>
        <div class="footer-col">
          <h5>Account</h5>
          <a href="login.html">Log in</a>
          <a href="login.html">Sign up</a>
        </div>
        <div class="footer-col">
          <h5>Legal</h5>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${year} Skill Loop. All rights reserved.</span>
        <span class="socials">
          <a href="#">Twitter</a>
          <a href="#">GitHub</a>
          <a href="#">Discord</a>
        </span>
      </div>
    </div>
  </footer>`;
}

function initSkillLoopChrome() {
  const headerMount = document.getElementById("site-header");
  const footerMount = document.getElementById("site-footer");
  if (headerMount) headerMount.innerHTML = skillLoopHeader();
  if (footerMount) footerMount.innerHTML = skillLoopFooter();

  // Highlight the active nav link based on body[data-active]
  const active = document.body.getAttribute("data-active");
  if (active) {
    const link = document.querySelector(`.main-nav a[data-page="${active}"]`);
    if (link) link.classList.add("active");
  }

  // Mobile nav toggle
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }
}

document.addEventListener("DOMContentLoaded", initSkillLoopChrome);
