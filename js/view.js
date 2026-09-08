/* ---------- Skill Loop — View ---------- */
/* Pure rendering: takes state in, writes DOM out. No event listeners,
   no direct calls into the model — the controller is the only thing
   that talks to both sides. */

const SkillLoopView = {
  renderLoopList(loops) {
    const list = document.getElementById("loopList");
    if (!list) return;

    if (!loops.length) {
      list.innerHTML = `<p class="form-note">No skill loops yet — add one above to get started.</p>`;
      return;
    }

    list.innerHTML = loops
      .map(
        (loop) => `
      <div class="loop-item" data-id="${loop.id}">
        <div class="loop-info">
          <h4>${escapeHtml(loop.name)}</h4>
          <span>${escapeHtml(loop.cadence)} &middot; \u{1F525} ${loop.streak}-day streak</span>
          <div class="progress-bar"><span style="width: ${loop.progress}%"></span></div>
        </div>
        <div class="loop-actions">
          <button type="button" class="btn btn-ghost" data-action="done" data-id="${loop.id}">Mark done</button>
          <button type="button" class="btn btn-ghost" data-action="remove" data-id="${loop.id}">Remove</button>
        </div>
      </div>`
      )
      .join("");
  },

  showFormMessage(text) {
    const msg = document.getElementById("formMessage");
    if (!msg) return;
    msg.style.display = "block";
    msg.textContent = text;
  },

  hideFormMessage() {
    const msg = document.getElementById("formMessage");
    if (!msg) return;
    msg.style.display = "none";
  },
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
