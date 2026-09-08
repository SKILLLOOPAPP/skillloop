/* ---------- Skill Loop — Model ---------- */
/* Owns all app state (skill loops + login flag), persists it to
   localStorage, and notifies subscribers whenever it changes.
   No DOM access happens in here. */

const SKILL_LOOP_STORAGE_KEY = "skillLoopData";

const DEFAULT_LOOPS = [
  { id: 1, name: "Guitar practice", cadence: "Daily, 15 min", streak: 12, progress: 80 },
  { id: 2, name: "Spanish vocab", cadence: "Daily, 10 min", streak: 5, progress: 40 },
  { id: 3, name: "Public speaking", cadence: "3x/week", streak: 21, progress: 95 },
];

class SkillLoopModel {
  constructor() {
    this._listeners = [];
    this.state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(SKILL_LOOP_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* localStorage unavailable or corrupt — fall back to defaults */
    }
    return { loops: DEFAULT_LOOPS.map((l) => ({ ...l })), loggedIn: false };
  }

  _save() {
    try {
      localStorage.setItem(SKILL_LOOP_STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      /* ignore write failures (e.g. private browsing quota) */
    }
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  _notify() {
    this._save();
    this._listeners.forEach((fn) => fn(this.state));
  }

  // ---- loops ----
  getLoops() {
    return this.state.loops;
  }

  addLoop(name, cadence) {
    const clean = name.trim();
    if (!clean) return;
    this.state.loops.push({
      id: Date.now(),
      name: clean,
      cadence: cadence.trim() || "Daily",
      streak: 0,
      progress: 0,
    });
    this._notify();
  }

  markDone(id) {
    const loop = this.state.loops.find((l) => l.id === id);
    if (!loop) return;
    loop.streak += 1;
    loop.progress = Math.min(100, loop.progress + 10);
    this._notify();
  }

  removeLoop(id) {
    this.state.loops = this.state.loops.filter((l) => l.id !== id);
    this._notify();
  }

  // ---- auth (front-end only, no real backend) ----
  login() {
    this.state.loggedIn = true;
    this._notify();
  }

  logout() {
    this.state.loggedIn = false;
    this._notify();
  }

  isLoggedIn() {
    return this.state.loggedIn;
  }
}

// Single shared instance — every page's controller talks to this.
const skillLoopModel = new SkillLoopModel();
