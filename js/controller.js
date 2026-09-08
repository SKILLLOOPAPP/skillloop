/* ---------- Skill Loop — Controller ---------- */
/* Wires DOM events to model methods, and re-renders the view whenever
   the model notifies of a change. This is the only file that touches
   both skillLoopModel and SkillLoopView. */

document.addEventListener("DOMContentLoaded", () => {
  initLoginController();
  initDashboardController();
});

function initLoginController() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    skillLoopModel.login();
    SkillLoopView.showFormMessage("Logged in! (demo only — hook this up to your real auth)");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 900);
  });
}

function initDashboardController() {
  const loopList = document.getElementById("loopList");
  if (!loopList) return;

  // Re-render any time the model changes (add/done/remove all flow through here).
  skillLoopModel.subscribe((state) => SkillLoopView.renderLoopList(state.loops));
  SkillLoopView.renderLoopList(skillLoopModel.getLoops());

  loopList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === "done") skillLoopModel.markDone(id);
    if (btn.dataset.action === "remove") skillLoopModel.removeLoop(id);
  });

  const addForm = document.getElementById("addLoopForm");
  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("loopName");
      const cadenceInput = document.getElementById("loopCadence");
      skillLoopModel.addLoop(nameInput.value, cadenceInput.value);
      addForm.reset();
      nameInput.focus();
    });
  }
}
