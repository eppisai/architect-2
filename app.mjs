import {
  STORE,
  clone,
  createProject,
  answer,
  publish,
  recordSource,
  ARCHETYPES,
  archetypeOf,
  interpret,
  describe,
  slug,
  recordRun,
  envVars,
  frameworkSetup,
  generateFiles,
  rollback,
  addAgent,
  removeAgent,
  TOOLS,
  addEnv,
  detectOps,
  describeOp,
  applyOps,
  restoreVersion,
  runChecks,
  normalize,
  THEMES,
  switchArchetype,
  committedFiles,
  diffFiles,
  checkpoint,
  pageKind,
} from "./model.mjs";
import { zipBytes } from "./zip.mjs";

// ---------- Small helpers ----------
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => Math.random().toString(36).slice(2, 10);
const plural = (n, w, many = w + "s") => `${n} ${n === 1 ? w : many}`;
const A = (x = p) => archetypeOf(x);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 50) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return plural(Math.round(s / 3600), "hour") + " ago";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const ICONS = {
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  up: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  clip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  bot: '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4"/><path d="M8.5 14h.01"/><path d="M15.5 14h.01"/>',
  github:
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 18h.01"/>',
  pointer: '<path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  settings: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="m16 3-2 18"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v.01"/><path d="M20 20v.01"/><path d="M17 20h.01"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
};
const icon = (n, s = 16, cls = "") =>
  `<svg class="i ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const spinner = (s = 14) => icon("spinner", s, "spin");
const logo = (s = 24) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="7" fill="#1F2420"/><path d="M6.5 16.5 12 7l5.5 9.5M8.8 13h6.4" stroke="#FBFAF7" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const googleLogo = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
const btn = (label, action, cls = "btn", extra = "") => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const arrowBtn = (label, action, cls = "", extra = "") =>
  `<button type="button" class="btn primary arrow ${cls}" data-action="${action}" ${extra}>${label}<span class="disc">${icon("arrow", 13)}</span></button>`;
const sw = (change, checked, label, extra = "") =>
  `<span class="switch"><input type="checkbox" role="switch" data-change="${change}" ${checked ? "checked" : ""} aria-label="${esc(label)}" ${extra}><span></span></span>`;
const horizon = (band = false, h = 470) => `<svg viewBox="${band ? "0 150 1440 290" : `0 0 1440 ${h}`}" preserveAspectRatio="${band ? "xMidYMid slice" : "xMidYMax slice"}"><rect width="1440" height="${h}" fill="#F4E7D3"/><path d="M0 60 C300 40 700 70 1000 50 C1200 38 1340 52 1440 46" stroke="#F7EEDF" stroke-width="22" fill="none" stroke-linecap="round" opacity=".8"/><path d="M80 120 C380 104 640 128 980 112" stroke="#F0DDC2" stroke-width="14" fill="none" stroke-linecap="round" opacity=".7"/><circle cx="1268" cy="214" r="40" fill="#F6D39E" opacity=".95"/><path d="M0 300 C160 262 300 272 460 288 C620 304 760 256 920 262 C1080 268 1260 292 1440 276 L1440 ${h} L0 ${h}Z" fill="#CFC9DA"/><path d="M140 300 C260 290 380 294 500 302" stroke="#DCD6E6" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M860 276 C960 268 1060 272 1160 282" stroke="#DCD6E6" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M0 350 C200 322 380 334 580 350 C760 364 960 326 1160 334 C1300 340 1380 350 1440 346 L1440 ${h} L0 ${h}Z" fill="#D3D5BA"/><path d="M620 352 C760 344 900 340 1040 342" stroke="#DFE0CA" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M0 392 C240 372 520 384 780 396 C1000 406 1240 388 1440 392 L1440 ${h} L0 ${h}Z" fill="#EADFC8"/><path d="M0 432 C360 418 900 424 1440 432 L1440 ${h} L0 ${h}Z" fill="#FBFAF7"/></svg>`;

// ---------- State ----------
let db;
try {
  db = JSON.parse(localStorage.getItem(STORE));
} catch {}
if (!db?.projects) db = { projects: [], signedIn: false };
if (db.signedIn && !db.account) db.account = { name: "Aman", email: "aman@demo.architect", method: "Demo" };
for (const x of db.projects) {
  normalize(x);
  if (x.stage === "plan" && !x.chat.some((m) => m.kind === "plan" && m.awaiting)) x.stage = "built";
}
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(db));
  } catch {
    toast("Browser storage is full. Download your project before continuing.");
  }
};
const byId = (id) => db.projects.find((x) => x.id === id);
const params = new URLSearchParams(location.search);
const releaseId = params.get("release"),
  previewId = params.get("preview");

let p = null;
const ui = {
  view: "home",
  tab: "preview",
  pop: null,
  device: "desktop",
  selecting: false,
  sel: "",
  page: "home",
  console: false,
  mode: "build",
  mobile: "chat",
  mention: false,
  codeFile: "",
  agentSel: "main",
  agentTab: "behavior",
  testInput: "",
  testResult: null,
  q: "",
  result: null,
  showSource: false,
  fb: "",
  homeTab: "mine",
  planFirst: false,
  attachments: [],
  homeAgents: [],
  model: "Auto",
  pubStep: null,
  lastRelease: null,
  gitStep: null,
  domainDraft: false,
  stick: true,
};
let build = null,
  pubTimer = null,
  auth = { step: "choose", email: "", busy: "" },
  pending = null,
  importFlow = null;
let brief = sessionStorage.getItem("architect-draft-brief") ?? "";

const TEMPLATES = [
  ["Policy assistant", "Answers from your handbook, with the source.", "A help desk where employees ask HR policy questions, get answers with sources, and anything unclear goes to HR on Slack."],
  ["Support inbox", "Sorts requests to the right team with a first reply.", "A support inbox where customers describe a problem, it gets routed to billing, access or engineering with a priority, and they can track it."],
  ["Sales insights", "Ask which region grew and see the rows behind it.", "A sales dashboard where my team asks which region grew the most and sees the numbers behind it."],
  ["Gym member CRM", "Member requests reach billing, classes or facilities.", "A CRM for my gym where members send requests and they reach billing, classes or facilities."],
  ["Clinic patient desk", "Patients ask about appointments and prescriptions.", "An assistant that answers questions for our dental clinic patients about appointments and prescriptions."],
  ["Restaurant dashboard", "Which dishes are growing, and by how much.", "A dashboard for my restaurant showing which dishes are growing."],
  ["Student handbook", "Assignments, exams and extensions, answered.", "A student help desk for our university that answers questions about assignments, exams and extensions."],
  ["Expense tracker", "Team spend by category, with the rows behind it.", "An expense tracker for my team that shows spend by category."],
];
const STUDIO_AGENTS = [
  ["Policy summarizer", "Summarize the answer", "Ops"],
  ["Escalation router", "Escalate to a person", "Support"],
  ["Translator", "Translate the answer", "Localization"],
];
const EL_LABELS = { brand: "App name", nav: "Navigation", hero: "Headline", form: "Question form", chips: "Sample questions", answer: "Answer card", source: "Source" };

// ---------- Rendering ----------
function toast(t) {
  const el = document.querySelector("#toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.style.display = "none"), 3600);
}
function dialog(title, sub, body, actions = "", opts = {}) {
  modal.className = opts.wide ? "wide" : "";
  modal.dataset.kind = opts.kind || "";
  modal.innerHTML = `<div class="dlg"><div class="dlg-head"><div>${opts.logo ? `<div style="margin-bottom:14px">${logo(30)}</div>` : ""}<h2 id="dlg-title">${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div><button type="button" class="dlg-close" data-action="close" aria-label="Close">${icon("x")}</button></div>${body}${actions ? `<div class="dlg-actions">${actions}</div>` : ""}</div>`;
  modal.setAttribute("aria-labelledby", "dlg-title");
  if (!modal.open) modal.showModal();
}
const closeModal = () => modal.open && modal.close();

function render() {
  if (releaseId || previewId) return sharedView();
  const active = document.activeElement;
  const focusId = active?.id;
  const selStart = active?.selectionStart,
    selEnd = active?.selectionEnd;
  const keep = {};
  for (const s of ["#viewport", ".code", ".main-panel", ".tree", ".drawer", ".pop"]) {
    const el = document.querySelector(s);
    if (el) keep[s] = el.scrollTop;
  }
  const msgs = document.querySelector("#msgs");
  const msgTop = msgs?.scrollTop;
  const winY = window.scrollY;
  document.body.classList.toggle("in-ws", ui.view === "workspace");
  app.innerHTML = ui.view === "workspace" && p ? workspace() : home();
  for (const [s, top] of Object.entries(keep)) {
    const el = document.querySelector(s);
    if (el) el.scrollTop = top;
  }
  const m2 = document.querySelector("#msgs");
  if (m2) m2.scrollTop = ui.stick ? m2.scrollHeight : msgTop ?? m2.scrollHeight;
  if (ui.view === "home") window.scrollTo({ top: winY });
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el && el !== document.activeElement) {
      el.focus({ preventScroll: true });
      try {
        if (selStart != null) el.setSelectionRange(selStart, selEnd);
      } catch {}
    }
  }
  bind();
  placeInspector();
}

// ---------- Home ----------
function thumbVars(themeId) {
  const t = THEMES[themeId] || THEMES.forest;
  return `--t-bg:${t.bg};--t-accent:${t.accent};--t-ink:${t.dark ? t.ink : "#2e332e"};--t-line:${t.line};--t-surface:${t.surface}`;
}
const thumb = (themeId) =>
  `<span class="thumb" style="${thumbVars(themeId)}" aria-hidden="true"><span class="t-top"><span class="t-logo"></span><span class="t-nav"><i></i><i></i><i></i></span></span><span class="t-h"></span><span class="t-p"></span><span class="t-in"><i></i></span><span class="t-cards"><i></i><i></i></span></span>`;
const TPL_THEMES = ["forest", "ocean", "amber", "plum", "ocean", "amber", "forest", "plum"];
function projectStatus(x) {
  if (build?.pid === x.id) return { kind: "ember", dot: "ember", text: "Building…" };
  const latest = x.releases.at(-1);
  if (!latest) return { kind: "", dot: "", text: x.imported ? "Imported · draft" : "Draft" };
  if (latest.revision === x.revision) return { kind: "live", dot: "live", text: "Live" };
  return { kind: "live", dot: "live", text: "Live · unpublished changes" };
}
function home() {
  const signed = db.signedIn;
  const projects = db.projects.filter((x) => !x.archived);
  const list = ui.homeTab === "published" ? projects.filter((x) => x.releases.length) : ui.homeTab === "shared" ? [] : projects;
  const showProjects = signed && projects.length;
  const cards = showProjects
    ? list.length
      ? list
          .map((x) => {
            const st = projectStatus(x);
            return `<button type="button" class="proj" data-action="open" data-id="${x.id}">${thumb(x.settings.theme)}<span><span class="name">${esc(x.name)}</span><span class="meta"><span class="dot ${st.dot}"></span>${st.text} · edited ${ago(x.changes.at(-1)?.at || x.createdAt)}</span></span></button>`;
          })
          .join("")
      : `<div class="empty" style="grid-column:1/-1"><div class="display">${ui.homeTab === "shared" ? "Nothing shared with you yet" : "Nothing published yet"}</div><p>${ui.homeTab === "shared" ? "Projects other people invite you to appear here." : "Publish a project and it shows up here with its live link."}</p></div>`
    : TEMPLATES.slice(0, 4)
        .map(([n, d, b], i) => `<button type="button" class="proj" data-action="use-template" data-i="${i}">${thumb(TPL_THEMES[i])}<span><span class="name">${n}</span><span class="meta">${d}</span></span></button>`)
        .join("");
  const agentsPicked = ui.homeAgents.length;
  return `<div class="home">
<div class="horizon" aria-hidden="true">${horizon()}</div>
<header class="home-nav"><div class="row"><button type="button" class="brand" data-action="home" aria-label="Architect home">${logo(26)}<span class="word">architect</span></button><nav aria-label="Main">${btn("Templates", "templates", "")}${btn("Agents", "studio", "")}${btn("How it works", "about", "")}</nav></div>
<div class="row" style="gap:16px">${signed ? `<span class="credits">${icon("bolt", 14)}1,240 credits</span>${btn(esc(initials()), "pop-account", "avatar", 'aria-label="Account menu"')}` : `${btn("Log in", "signin", "btn quiet")}${btn("Get started", "signin", "btn primary")}`}</div></header>
${ui.pop === "account" ? accountPop("home") : ""}
<section class="hero"><h1>What should we build today?</h1><p>Describe it. Architect builds the screens, the agents and the backend, then puts it online.</p></section>
<form class="composer" id="home-form"><label for="brief" class="sr">Describe what you want to build</label><textarea id="brief" rows="2" placeholder="Describe an app, a workflow or an agent. For example: a help desk that answers HR questions and hands anything unclear to a person.">${esc(brief)}</textarea>
${ui.attachments.length ? `<div class="attachments">${ui.attachments.map((a, i) => `<span class="attachment">${icon(a.kind === "link" ? "link" : "file", 13)}${esc(a.name)}<button type="button" data-action="remove-attachment" data-i="${i}" aria-label="Remove ${esc(a.name)}">${icon("x", 12)}</button></span>`).join("")}</div>` : ""}
<div class="composer-tools"><div class="row"><button type="button" class="tool round" data-action="attach" aria-label="Attach a file, screenshot or link">${icon("plus", 17)}</button><button type="button" class="tool ${agentsPicked ? "on" : ""}" data-action="studio">${icon("bot")}${agentsPicked ? plural(agentsPicked, "agent") + " attached" : "Use my agents"}</button><button type="button" class="tool ${ui.planFirst ? "on" : ""} hide-sm" data-action="toggle-plan" aria-pressed="${ui.planFirst}"><span class="mini-switch"></span>Plan first</button></div>
<div class="row"><label for="builder-model" class="sr">Model</label><select id="builder-model" class="hide-sm model-select" data-change="builder-model">${["Auto", "Claude Sonnet 5", "GPT-5", "Gemini 2.5 Pro"].map((m) => `<option ${ui.model === m ? "selected" : ""}>${m}</option>`).join("")}</select><button type="submit" class="btn primary big arrow">Build it<span class="disc">${icon("arrow", 15)}</span></button></div></div></form>
<div class="quick">${btn(`${icon("github")}Import from GitHub`, "import", "")}${btn(`${icon("upload")}Upload a ZIP`, "import-zip", "")}${btn(`${icon("grid")}Browse templates`, "templates", "")}${btn(`${icon("compass")}Not sure? Ask the consultant`, "consult", "")}</div>
<section class="home-section"><div class="head"><div class="row wrap" style="gap:10px 26px;align-items:baseline"><h2>${showProjects ? "Your projects" : "Start from a template"}</h2>${showProjects ? `<div class="tabs-line">${[["mine", "Mine"], ["shared", "Shared with me"], ["published", "Published"]].map(([k, l]) => `<button type="button" data-action="home-tab" data-tab="${k}" class="${ui.homeTab === k ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}</div>${btn(showProjects ? "Start from a template →" : "All templates →", "templates", "link")}</div><div class="proj-grid">${cards}</div></section>
<footer class="home-footer">Architect 2.0 prototype · ${btn("What’s real in this prototype", "about", "link")}</footer></div>`;
}
const initials = () => (db.account?.name || "You").slice(0, 2).toUpperCase();

// ---------- Workspace ----------
function workspace() {
  return `<div class="ws" style="position:relative">${topBar()}<div class="ws-body m-${ui.mobile}">${chatPanel()}<main class="canvas" id="canvas">${canvasBody()}</main></div>${workspacePop()}<div class="mobile-switch"><div class="seg">${["chat", "app"].map((k) => `<button type="button" data-action="mobile" data-k="${k}" class="${ui.mobile === k ? "on" : ""}">${k === "chat" ? "Chat" : "App"}</button>`).join("")}</div></div></div>`;
}
function topBar() {
  const st = projectStatus(p);
  const tabs = [
    ["preview", "Preview"],
    ["code", "Code"],
    ["agents", "Agents"],
    ["data", "Data"],
  ];
  const gitBehind = p.git.connected && p.git.committedRevision < p.revision;
  const members = (p.members || []).filter((m) => m.role !== "Owner");
  return `<header class="bar"><div class="bar-left">${btn(logo(24), "home", "brand", 'aria-label="All projects"')}<span class="slash">/</span><button type="button" class="proj-name" data-action="pop" data-pop="project" aria-haspopup="dialog"><span>${esc(p.name)}</span>${icon("chevron", 14)}</button><span class="status ${st.kind} hide-sm">${st.kind === "ember" ? spinner(12) : `<span class="dot ${st.dot}"></span>`}${st.text}</span></div>
<div class="seg tabs" role="tablist" aria-label="Views">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${ui.tab === k}" data-action="tab" data-tab="${k}" class="${ui.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
<div class="bar-right"><div class="avatars hide-md">${btn(esc(initials()), "pop-account", "avatar sm", 'aria-label="Account menu"')}${members.slice(0, 2).map((m) => `<span class="avatar sm" title="${esc(m.email)}">${esc(m.email.slice(0, 2).toUpperCase())}</span>`).join("")}</div>
<button type="button" class="icon-btn" data-action="pop" data-pop="history" aria-label="Version history" title="Version history">${icon("history", 18)}</button>
<button type="button" class="btn quiet hide-sm" data-action="pop" data-pop="github" aria-label="GitHub">${icon("github", 17)}${p.git.connected ? `<span class="dot ${gitBehind ? "amber" : "live"}"></span>${gitBehind ? "Not pushed" : "Synced"}` : "GitHub"}</button>
${btn("Share", "pop", "btn hide-sm", 'data-pop="share"')}
${arrowBtn("Publish", "pop", "", 'data-pop="publish"')}</div></header>`;
}

// Chat
function chatPanel() {
  const sugg = !build && ui.mode === "build" ? suggestions() : [];
  return `<aside class="chat" aria-label="Chat with Architect"><div class="msgs" id="msgs" aria-live="polite">${p.chat.map((m, i) => renderMsg(m, i)).join("")}</div>
${sugg.length ? `<div class="suggest">${sugg.map((s) => btn(esc(s), "suggest", "chip", `data-text="${esc(s)}"`)).join("")}</div>` : ""}
<form class="composer-mini" id="chat-form" style="position:relative">${ui.mention ? mentionMenu() : ""}${ui.sel ? `<span class="ctx">${icon("pointer", 11)}${EL_LABELS[ui.sel] || ui.sel}<button type="button" data-action="clear-sel" aria-label="Remove selection">${icon("x", 12)}</button></span>` : ""}<label class="sr" for="chat-input">Message Architect</label><textarea id="chat-input" rows="2" placeholder="${ui.mode === "plan" ? "Describe it. Architect plans before building." : "Ask for a change, or @ an agent or page"}">${esc(p.unsent || "")}</textarea>
<div class="tools-row"><button type="button" class="icon-btn" data-action="attach-chat" aria-label="Attach a file, screenshot or link">${icon("clip", 17)}</button><button type="button" class="icon-btn" data-action="mention" aria-label="Mention an agent or page">${icon("at", 17)}</button><div class="seg sm" style="margin-left:4px" role="group" aria-label="Mode">${[["plan", "Plan"], ["build", "Build"]].map(([k, l]) => `<button type="button" data-action="mode" data-k="${k}" class="${ui.mode === k ? "on" : ""}" aria-pressed="${ui.mode === k}">${l}</button>`).join("")}</div>
${build?.pid === p.id ? `<button type="button" class="send" data-action="stop" aria-label="Stop"><span class="stop"></span></button>` : `<button type="submit" class="send" aria-label="Send">${icon("up", 16)}</button>`}</div></form></aside>`;
}
function mentionMenu() {
  const a = A();
  const items = [a.agent.name, ...(p.agents || []).map((x) => x.name), ...p.pages.map((x) => x.name + " page")];
  return `<div class="pop mention" style="top:auto;bottom:calc(100% + 8px);left:0;right:auto;width:260px;padding:8px;gap:0"><div class="menu">${items.map((x) => btn(`${icon(/page$/.test(x) ? "file" : "bot", 15)}${esc(x)}`, "insert-mention", "", `data-text="${esc(x)}"`)).join("")}</div></div>`;
}
function suggestions() {
  const out = [];
  const s = p.settings;
  if (!s.feedback) out.push("Add feedback buttons to answers");
  if (!(p.agents || []).some((x) => /escalat/i.test(x.name + x.responsibility))) out.push("Hand unanswered questions to a person on Slack");
  if (s.theme !== "dark") out.push("Try a dark mode");
  if (!s.signin) out.push("Add Google sign-in");
  if (p.pages.length < 3) out.push(A().id === "knowledge" ? "Add an About page" : "Add a Contact page");
  return out.slice(0, 3);
}
const aiHead = `<span class="ai-head">${logo(18)}Architect</span>`;
function renderMsg(m, i) {
  const prev = p.chat[i - 1];
  const head = prev && prev.role === "assistant" ? "" : aiHead;
  if (m.role === "user")
    return `<div class="msg-user">${m.sel ? `<span class="sel-chip">${icon("pointer", 11)}${esc(m.sel)}</span>` : ""}<span>${esc(m.text)}</span></div>`;
  if (m.kind === "plan") return `<div class="msg-ai">${head}${planCard(m)}</div>`;
  if (m.kind === "build") return `<div class="msg-ai">${head}${buildCard(m)}</div>`;
  if (m.kind === "clarify")
    return `<div class="msg-ai">${head}<p>${esc(m.text)}</p><div class="options">${m.options.map((o, k) => `<button type="button" data-action="clarify" data-id="${m.id}" data-k="${k}" ${m.chosen != null ? "disabled" : ""}>${m.chosen === k ? icon("check", 14) : icon("right", 14)}${esc(o.label)}</button>`).join("")}</div></div>`;
  if (m.kind === "proposal")
    return `<div class="msg-ai">${head}<p>${esc(m.text)}</p><div class="steps">${m.steps.map((s) => `<div class="step todo"><span class="todo-ring"></span><span>${esc(s)}</span></div>`).join("")}</div>${fileChips(m.files)}${m.state ? `<span class="small muted">${m.state === "built" ? "Built. See the steps below." : "Set aside."}</span>` : `<div class="row">${btn("Build this", "proposal-build", "btn primary sm", `data-id="${m.id}"`)}${btn("Not now", "proposal-skip", "btn sm", `data-id="${m.id}"`)}</div>`}</div>`;
  return `<div class="msg-ai">${head}<p>${esc(m.text)}</p>${m.action ? btn(esc(m.action.label), m.action.do, "btn sm", `data-arg="${esc(m.action.arg || "")}"`) : ""}</div>`;
}
function planCard(m) {
  const a = A(),
    s = p.settings;
  const agents = [a.agent.name, ...(p.agents || []).map((x) => x.name + (x.channel ? ` (${x.channel})` : ""))];
  const firstBuild = p.chat.find((x) => x.kind === "build" && x.first);
  const built = firstBuild?.done;
  const refs = (p.references || []).map((x) => x.name);
  return `<div class="plan-card"><div class="pc-head">${built ? `<span class="built">${icon("check", 14)}Built in ${firstBuild.secs || 6} s · ${plural(firstBuild.files.length, "file")}</span>` : `<span style="font-weight:600">The plan</span>`}${m.awaiting ? "" : btn("Edit plan", "edit-plan", "link")}</div>
<dl><dt>Pages</dt><dd>${esc(p.pages.map((x) => x.name).join(", "))}</dd><dt>Agents</dt><dd>${esc(agents.join(", "))}</dd><dt>Data</dt><dd>${esc(p.sourceName)}${p.sourceKind === "sample" ? " (sample)" : ""}</dd><dt>Sign-in</dt><dd>${s.signin ? esc(s.signin) : s.audience === "team" ? "Team sign-in" : "Anyone with the link"}</dd><dt>Look</dt><dd>${esc(THEMES[s.theme]?.label || s.theme)}</dd>${refs.length ? `<dt>References</dt><dd>${esc(refs.join(", "))}</dd>` : ""}</dl>
<div class="pc-foot"><span>Starting point: ${esc(a.label)}</span>${btn("Change", "switch-start", "link")}</div></div>${m.awaiting ? `<div class="row">${btn("Build this plan", "approve-plan", "btn primary sm", `data-id="${m.id}"`)}${btn("Edit plan", "edit-plan", "btn sm")}</div>` : ""}`;
}
function buildCard(m) {
  const active = build?.msgId === m.id;
  const at = active ? build.step : m.done ? m.steps.length : m.paused ?? m.stoppedAt ?? m.steps.length;
  const steps = m.steps
    .map((s, k) => {
      if (k < at) return `<div class="step">${icon("check", 14, "add")}<span>${esc(s)}</span></div>`;
      if (active && k === at) return `<div class="step current">${spinner(14)}<span>${esc(s)}</span></div>`;
      return `<div class="step todo"><span class="todo-ring"></span><span>${esc(s)}</span></div>`;
    })
    .join("");
  const latest = p.versions.at(-1)?.id;
  const end = m.cancelled
    ? `<span class="small muted">Stopped. Nothing changed.</span>`
    : m.paused != null && !active
      ? `<div class="row"><span class="small muted">Paused.</span>${btn("Resume", "resume-build", "btn sm", `data-id="${m.id}"`)}</div>`
      : "";
  return `${m.intro ? `<p>${esc(m.intro)}</p>` : ""}<div class="steps">${steps}</div>${m.done ? fileChips(m.files) : ""}${end}${m.done && m.versionN ? `<div class="version-line">Version ${m.versionN}${m.versionId && m.versionId !== latest ? btn("Restore", "restore", "", `data-id="${m.versionId}"`) : ""}</div>` : ""}`;
}
function fileChips(files = []) {
  if (!files.length) return "";
  const shown = files.slice(0, 4);
  return `<div class="files">${shown.map((f) => `<button type="button" class="file-chip" data-action="code-open" data-path="${esc(f.path)}" title="${esc(f.path)}">${esc(f.path.split("/").pop())}${f.add ? `<span class="add">+${f.add}</span>` : ""}${f.del ? `<span class="del">−${f.del}</span>` : ""}</button>`).join("")}${files.length > 4 ? btn(`+${files.length - 4} more`, "tab", "file-chip", 'data-tab="code"') : ""}</div>`;
}

// Canvas
function canvasBody() {
  if (ui.tab === "code") return codePane();
  if (ui.tab === "agents") return agentsPane();
  if (ui.tab === "data") return dataPane();
  return previewPane();
}
function firstBuildLevel() {
  const m = p.chat.find((x) => x.kind === "build" && x.first);
  if (!m) return p.chat.some((x) => x.kind === "plan" && x.awaiting) ? 0 : 99;
  if (m.done) return 99;
  const at = build?.msgId === m.id ? build.step : m.paused ?? 0;
  return Math.round((at / m.steps.length) * 100);
}
function previewPane() {
  const page = p.pages.find((x) => x.id === ui.page) || p.pages[0];
  const changing = build?.pid === p.id && !p.chat.find((x) => x.id === build.msgId)?.first;
  const runs = (p.runs || []).length;
  const lvl = firstBuildLevel();
  return `<div class="canvas-pad"><div class="browser"><div class="browser-bar">
<button type="button" class="icon-btn" data-action="app-page" data-page="${p.pages[0]?.id}" aria-label="Back to the first page">${icon("left", 16)}</button><button type="button" class="icon-btn" data-action="app-refresh" aria-label="Refresh preview">${icon("refresh", 15)}</button>
<div class="url">${icon("lock", 12)}<span>${esc(slug(p.name))}.architect.app</span><span class="path">/${page && page.kind !== "home" ? esc(slug(page.name)) : ""}</span></div>
<div class="seg sm hide-sm" role="group" aria-label="Device size" style="margin-left:auto">${[["desktop", "monitor"], ["tablet", "tablet"], ["phone", "phone"]].map(([d, ic]) => `<button type="button" data-action="device" data-d="${d}" class="${ui.device === d ? "on" : ""}" aria-label="${cap(d)}" aria-pressed="${ui.device === d}">${icon(ic, 14)}</button>`).join("")}</div>
<button type="button" class="select-btn ${ui.selecting ? "on" : ""}" data-action="toggle-select" aria-pressed="${ui.selecting}" ${lvl < 99 ? "disabled" : ""}>${icon("pointer", 13)}Select</button>
<button type="button" class="icon-btn" data-action="open-draft" aria-label="Open the preview in a new tab">${icon("external", 15)}</button></div>
<div class="viewport ${ui.device !== "desktop" ? "framed" : ""} ${ui.selecting ? "selecting" : ""}" id="viewport"><div class="device ${ui.device}">${lvl < 99 ? skeletonApp(lvl) : appView(p, { builder: true })}</div>${lvl >= 99 ? inspector() : ""}</div>
${ui.console ? runsDrawer() : ""}
<div class="console"><button type="button" data-action="toggle-console" aria-expanded="${ui.console}">${icon("terminal", 13)}Console</button><span>No errors</span><span>${plural(runs, "run")}</span>${changing ? `<span class="applying">${spinner(12)}Applying changes to the preview</span>` : lvl < 99 ? `<span class="applying">${spinner(12)}Building</span>` : ""}</div></div></div>`;
}
function skeletonApp(lvl) {
  const th = THEMES[p.settings.theme] || THEMES.forest;
  const vars = themeVars(th);
  const a = A();
  const real = (n) => lvl >= n;
  const fresh = (n) => ((ui.lastLvl ?? 0) < n ? "reveal" : "");
  queueMicrotask(() => (ui.lastLvl = lvl));
  const sk = (w, h, extra = "") => `<span class="skel" style="display:block;width:${w};height:${h}px;${extra}"></span>`;
  return `<div class="appview ${th.dark ? "dark" : ""}" style="${vars}"><header class="a-head">${real(25) ? `<span class="a-brand ${fresh(25)}"><span class="a-mark">${esc(p.name[0] || "A")}</span>${esc(p.name)}</span><nav class="a-nav ${fresh(25)}">${p.pages.map((x, k) => `<button type="button" class="${k === 0 ? "on" : ""}">${esc(x.name)}</button>`).join("")}</nav>` : sk("160px", 18)}</header>
<div class="a-main">${real(45) ? `<div class="${fresh(45)}"><h2 class="a-h">${esc(p.copy.h2)}</h2><p class="a-intro">${esc(p.copy.intro)}</p></div><div class="a-form ${fresh(45)}" style="display:flex;gap:8px;align-items:center;border:1px solid var(--a-line);border-radius:12px;padding:6px 6px 6px 14px;background:var(--a-surface)"><span style="flex:1;color:var(--a-muted)">${esc(p.copy.placeholder)}</span><span class="a-btn">${esc(p.copy.button)}</span></div>` : `${sk("70%", 34)}${sk("45%", 14)}${sk("100%", 48, "margin-top:10px")}`}
${real(80) ? `<div class="a-chips ${fresh(80)}">${(p.chips || a.chips).map(([l]) => `<span class="a-chip">${esc(l)}</span>`).join("")}</div>` : `<div style="display:flex;gap:8px">${sk("110px", 30)}${sk("130px", 30)}${sk("100px", 30)}</div>`}
${sk("100%", 120, "margin-top:10px;opacity:.6")}</div></div>`;
}
const themeVars = (th) => `--a-bg:${th.bg};--a-surface:${th.surface};--a-ink:${th.ink};--a-muted:${th.muted};--a-accent:${th.accent};--a-on:${th.onAccent};--a-soft:${th.soft};--a-line:${th.line}`;
function appView(t, { builder = false } = {}) {
  const a = A(t),
    s = t.settings,
    th = THEMES[s.theme] || THEMES.forest,
    copy = t.copy || a.app,
    pages = t.pages?.length ? t.pages : [{ id: "home", name: "Ask", kind: "home" }];
  const page = pages.find((x) => x.id === ui.page) || pages[0];
  const el = (id) => (builder ? `data-el="${id}" data-label="${esc(EL_LABELS[id])}"` : "");
  const selCls = (id) => (builder && ui.sel === id ? " is-selected" : "");
  const signin = s.signin || (s.audience === "team" ? "Team sign-in" : "");
  let body = "";
  if (page.kind === "home") {
    body = `<div ${el("hero")} class="${selCls("hero")}"><h2 class="a-h">${esc(copy.h2)}</h2><p class="a-intro">${esc(copy.intro)}</p></div>
<form class="a-form${selCls("form")}" id="question-form" ${el("form")}><label class="sr" for="question">${esc(copy.placeholder)}</label><input id="question" autocomplete="off" placeholder="${esc(copy.placeholder)}" value="${esc(ui.q)}"><button class="a-btn" type="submit">${esc(copy.button)}</button></form>
<div class="a-chips${selCls("chips")}" ${el("chips")}>${(t.chips || a.chips).map(([l, q]) => `<button type="button" class="a-chip" data-action="sample-question" data-q="${esc(q)}">${esc(l)}</button>`).join("")}</div>
${ui.result ? resultCard(t, builder) : ""}`;
  } else if (page.kind === "source") body = sourcePage(t, page);
  else if (page.kind === "runs") {
    const runs = builder ? t.runs || [] : [];
    body = `<h2 class="a-h">${esc(page.name)}</h2>${runs.length ? `<div class="a-list">${runs.slice(0, 8).map((r) => `<div><strong>${esc(r.input)}</strong><small>${esc(r.output)}</small></div>`).join("")}</div>` : `<p class="a-empty">Nothing here yet. Questions and requests show up here after someone asks.</p>`}`;
  } else if (page.kind === "about")
    body = `<h2 class="a-h">${esc(page.name)}</h2><p class="a-intro" style="font-size:16px;line-height:1.7">${esc(a.promise(s.audience === "team" ? "teammates" : "customers", a.material))}</p><p class="a-intro">Answers come from ${esc(t.sourceName)}. ${t.agents?.some((x) => /escalat/i.test(x.name + x.responsibility)) ? "Anything it can’t answer goes to a person." : ""}</p>`;
  else if (page.kind === "contact")
    body = `<h2 class="a-h">${esc(page.name)}</h2><p class="a-intro">Send a message and a person will reply.</p><form class="stack" id="app-contact"><label class="sr" for="c-msg">Message</label><input id="c-email" placeholder="Your email" aria-label="Your email" style="background:var(--a-surface);color:var(--a-ink);border-color:var(--a-line)"><textarea id="c-msg" rows="4" placeholder="How can we help?" style="background:var(--a-surface);color:var(--a-ink);border-color:var(--a-line)"></textarea><button class="a-btn" type="submit" style="align-self:flex-start">Send</button></form>`;
  else
    body = `<h2 class="a-h">${esc(page.name)}</h2><p class="a-empty">This page is ready for content.</p>${builder ? `<span class="builder-hint">${icon("message", 13)}Describe what ${esc(page.name)} should show in the chat</span>` : ""}`;
  return `<div class="appview ${th.dark ? "dark" : ""}" style="${themeVars(th)}"><header class="a-head"><span class="a-brand${selCls("brand")}" ${el("brand")}><span class="a-mark">${esc((t.name || "A")[0])}</span>${esc(t.name)}</span><nav class="a-nav${selCls("nav")}" ${el("nav")} aria-label="${esc(t.name)} pages">${pages.map((x) => `<button type="button" data-action="app-page" data-page="${x.id}" class="${x.id === page.id ? "on" : ""}">${esc(x.name)}</button>`).join("")}</nav><span class="a-user">${signin ? `<span class="a-signin">${icon("lock", 11)}${esc(signin)}</span>` : ""}<span class="av">JS</span></span></header><div class="a-main">${body}</div></div>`;
}
function sourcePage(t, page) {
  const a = A(t);
  if (a.id === "insight") {
    const rows = t.source.trim().split("\n").map((l) => l.split(",").map((c) => c.trim()));
    const head = rows.shift() || [];
    return `<h2 class="a-h">${esc(page.name)}</h2><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const lines = t.source.split("\n").filter((l) => l.includes(":"));
  return `<h2 class="a-h">${esc(page.name)}</h2><div class="a-list">${lines.map((l) => `<div><strong>${esc(l.slice(0, l.indexOf(":")))}</strong><small>${esc(l.slice(l.indexOf(":") + 1).trim())}</small></div>`).join("")}</div>`;
}
function resultCard(t, builder) {
  const a = A(t),
    r = ui.result,
    s = t.settings;
  const el = builder ? `data-el="answer" data-label="${esc(`Answer card · ${a.agent.name}`)}"` : "";
  const handoff = (t.agents || []).find((x) => /escalat/i.test(x.name + x.responsibility));
  const chart = r.chart
    ? `<div class="bars">${r.chart.data.map((d) => `<div class="bar-row ${r.chart.highlight.includes(d.label) ? "hi" : ""}"><span>${esc(d.label)}</span><span class="bar-track"><i style="width:${Math.round((d.values.at(-1) / Math.max(...r.chart.data.map((x) => x.values.at(-1)), 1)) * 100)}%"></i></span><b>${d.values.at(-1)}</b></div>`).join("")}</div>`
    : "";
  return `<div class="a-card${ui.fresh ? " reveal" : ""}${builder && ui.sel === "answer" ? " is-selected" : ""}" ${el}><div class="row between"><span class="a-label">${r.blocked ? "Setup needed" : r.supported ? esc(a.app.found) : esc(a.app.missing)}</span>${r.team ? `<span class="a-tags"><span class="a-tag">${esc(r.team)}</span><span class="a-tag ${r.priority === "High" ? "hi" : ""}">${esc(r.priority)} priority</span></span>` : ""}</div><p>${esc(r.text)}</p>${chart}
${r.citation ? `<div ${builder ? `data-el="source" data-label="Source"` : ""} class="stack${builder && ui.sel === "source" ? " is-selected" : ""}" style="gap:8px">${ui.showSource ? `<div class="a-evidence">${esc(r.citation)}</div>` : ""}<div class="a-tags"><button type="button" class="a-tag" data-action="citation">${icon("book", 13)}${esc(a.evidenceLabel(r) || a.app.evidence)}</button></div></div>` : ""}
${!r.supported && !r.blocked && handoff ? `<p class="a-intro" style="font-size:13px;margin:0">${icon("hash", 13)} Sent to a person on ${esc(handoff.channel || "email")} by ${esc(handoff.name)}.</p>` : ""}
${s.feedback ? `<div class="a-feedback">${ui.fb ? (ui.fb === "down" && handoff ? `Thanks. ${esc(handoff.name)} passed this to a person.` : "Thanks for the feedback.") : `Was this helpful?<button type="button" data-action="fb" data-v="up">Helpful</button><button type="button" data-action="fb" data-v="down">Not helpful</button>`}</div>` : ""}</div>`;
}
function runsDrawer() {
  const runs = p.runs || [];
  return `<div class="drawer" aria-label="Runs">${runs.length ? runs.map((r, k) => runItem(r, k === 0)).join("") : `<p class="muted">No runs yet. Ask the app a question and each run appears here with the steps the agent took.</p>`}</div>`;
}
const runItem = (r, open) =>
  `<details class="run" ${open ? "open" : ""}><summary><span><strong>${esc(r.input)}</strong><br><span class="small muted">${ago(r.at)} · version ${r.revision} · ${r.ms} ms</span></span><span class="status ${r.supported ? "live" : "ember"}"><span class="dot ${r.supported ? "live" : "ember"}"></span>${r.supported ? "Answered" : "No match"}</span></summary><ol class="trace">${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><div class="out">${esc(r.output)}</div><div style="margin-top:8px">${btn("Run again with the current version", "rerun", "btn sm", `data-input="${esc(r.input)}"`)}</div></details>`;

// Select to edit
function inspector() {
  if (!ui.selecting || !ui.sel) return "";
  const a = A(),
    s = p.settings,
    c = p.copy;
  const head = `<div class="ins-head"><strong>${EL_LABELS[ui.sel]}</strong>${btn(icon("x", 14), "clear-sel", "icon-btn", 'aria-label="Close" style="width:28px;height:28px"')}</div>`;
  const agent = `<button type="button" class="agent-link" data-action="tab" data-tab="agents"><span class="ag">${icon("bot", 16)}</span><span class="grow"><small>${ui.sel === "form" ? "Questions go to" : "Answers come from"}</small><b>${esc(a.agent.name)}</b></span>${icon("right", 15)}</button>`;
  const ask = `<button type="button" class="btn sm" data-action="focus-chat">${icon("message", 13)}Ask for a change to this</button>`;
  let body = "";
  if (ui.sel === "brand")
    body = `<form id="ins-name" class="stack" style="gap:8px"><label class="field-label" for="ins-name-input" style="margin:0">App name</label><div class="row"><input id="ins-name-input" value="${esc(p.name)}" maxlength="50"><button class="btn sm primary" type="submit">Save</button></div></form><div class="stack" style="gap:6px"><span class="field-label" style="margin:0">Look</span><div class="row wrap">${Object.entries(THEMES).map(([k, th]) => `<button type="button" class="swatch ${s.theme === k ? "on" : ""}" data-action="theme" data-theme="${k}" aria-label="${th.label} theme" title="${th.label}" style="--sw:${th.accent};--sw-bg:${th.bg}"></button>`).join("")}</div></div>`;
  else if (ui.sel === "hero")
    body = `<form id="ins-hero" class="stack" style="gap:8px"><label class="field-label" for="ins-h2" style="margin:0">Headline</label><input id="ins-h2" value="${esc(c.h2)}" maxlength="80"><label class="field-label" for="ins-intro" style="margin:0">Intro</label><input id="ins-intro" value="${esc(c.intro)}" maxlength="140"><button class="btn sm primary" type="submit" style="align-self:flex-start">Save text</button></form>`;
  else if (ui.sel === "form")
    body = `${agent}<form id="ins-form" class="stack" style="gap:8px"><label class="field-label" for="ins-ph" style="margin:0">Placeholder</label><input id="ins-ph" value="${esc(c.placeholder)}" maxlength="80"><label class="field-label" for="ins-btn" style="margin:0">Button</label><input id="ins-btn" value="${esc(c.button)}" maxlength="30"><button class="btn sm primary" type="submit" style="align-self:flex-start">Save text</button></form>`;
  else if (ui.sel === "answer" || ui.sel === "source")
    body = `${agent}<div><div class="toggle-row"><span>Answer length</span><div class="seg sm">${["short", "detailed"].map((v) => `<button type="button" data-action="set" data-key="length" data-val="${v}" class="${s.length === v ? "on" : ""}">${v === "short" ? "Short" : "Detailed"}</button>`).join("")}</div></div><div class="toggle-row"><span>Show the ${esc(a.app.evidence.toLowerCase())}</span>${sw("setting", s.citations, "Show evidence", 'data-key="citations"')}</div><div class="toggle-row"><span>Feedback buttons</span>${sw("setting", s.feedback, "Feedback buttons", 'data-key="feedback"')}</div><div class="toggle-row"><span>No answer</span><div class="seg sm">${[["explain", "Hand off"], ["ask", "Ask back"]].map(([v, l]) => `<button type="button" data-action="set" data-key="unknown" data-val="${v}" class="${s.unknown === v ? "on" : ""}">${l}</button>`).join("")}</div></div></div>`;
  else if (ui.sel === "nav")
    body = `<div class="stack" style="gap:4px">${p.pages.map((x) => `<div class="toggle-row"><span>${esc(x.name)} <small>${x.kind === "home" ? "First page" : cap(x.kind === "runs" ? "history" : x.kind)}</small></span>${x.kind === "home" ? "" : btn(icon("x", 13), "remove-page", "icon-btn", `data-id="${x.id}" aria-label="Remove ${esc(x.name)}" style="width:28px;height:28px"`)}</div>`).join("")}</div><form id="ins-page" class="row"><label class="sr" for="ins-page-name">New page name</label><input id="ins-page-name" placeholder="New page, e.g. FAQ" maxlength="28"><button class="btn sm" type="submit">Add</button></form>`;
  else if (ui.sel === "chips")
    body = `<p class="hint">These three questions double as the checks that run before you publish: two should be answered and one should not.</p>${btn("Edit in Data", "tab", "btn sm", 'data-tab="data"')}`;
  return `<div class="inspector" id="inspector" role="dialog" aria-label="${EL_LABELS[ui.sel]}" style="visibility:hidden">${head}${body}${ask}</div>`;
}
function placeInspector() {
  const ins = document.querySelector("#inspector");
  if (!ins) return;
  const vp = document.querySelector("#viewport");
  const target = vp.querySelector(`[data-el="${ui.sel}"]`);
  if (!target) {
    ins.remove();
    return;
  }
  const v = vp.getBoundingClientRect(),
    r = target.getBoundingClientRect();
  let top = r.bottom - v.top + vp.scrollTop + 14;
  const below = v.bottom - r.bottom;
  if (below < ins.offsetHeight + 20 && r.top - v.top > ins.offsetHeight + 40) top = r.top - v.top + vp.scrollTop - ins.offsetHeight - 40;
  top = Math.max(vp.scrollTop + 12, Math.min(top, vp.scrollTop + vp.clientHeight - ins.offsetHeight - 12));
  const left = Math.max(12, Math.min(r.right - v.left - ins.offsetWidth, vp.clientWidth - ins.offsetWidth - 12));
  ins.style.top = top + "px";
  ins.style.left = left + "px";
  ins.style.visibility = "visible";
}

// Code
function visibleFiles() {
  const files = generateFiles(p);
  const lvl = firstBuildLevel();
  if (lvl >= 99) return files;
  return files.slice(0, Math.max(0, Math.round((files.length * lvl) / 100)));
}
const EXT_RULES = {
  js: [/(\/\/.*$)|(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:import|from|export|const|let|var|function|async|await|return|if|else|for|of|in|new|throw|try|catch|typeof|default)\b)|(\b\d+(?:\.\d+)?\b)/g, ["com", "str", "kw", "num"]],
  py: [/(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|return|import|from|class|if|else|for|in|raise|with|as|lambda|None|True|False|and|or|not)\b)|(\b\d+(?:\.\d+)?\b)/g, ["com", "str", "kw", "num"]],
  yaml: [/(#.*$)|("[^"]*"|'[^']*')|(^\s*-?\s*[\w.-]+(?=:))|(\b\d+(?:\.\d+)?\b)/g, ["com", "str", "key", "num"]],
  json: [/("(?:[^"\\]|\\.)*"(?=\s*:))|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?\b)/g, ["key", "str", "kw", "num"]],
  md: [/(^#.*$)|(`[^`]*`)|(^\s*-\s)/g, ["kw", "str", "num"]],
  css: [/(\/\*.*?\*\/)|("[^"]*")|(^\s*[\w-]+(?=\s*[:{])|--[\w-]+)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:px|em|%)?\b)/g, ["com", "str", "key", "num"]],
  html: [/(<!--.*?-->)|("[^"]*")|(<\/?[\w-]+|\/?>)|(\b\d+\b)/g, ["com", "str", "kw", "num"]],
};
EXT_RULES.mjs = EXT_RULES.js;
EXT_RULES.yml = EXT_RULES.yaml;
function highlightLine(line, ext) {
  const rule = EXT_RULES[ext];
  if (!rule) return esc(line);
  const [re, cls] = rule;
  let out = "",
    last = 0;
  for (const m of line.matchAll(re)) {
    const g = m.findIndex((x, k) => k > 0 && x !== undefined);
    out += esc(line.slice(last, m.index)) + `<span class="tk-${cls[g - 1]}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(line.slice(last));
}
function codePane() {
  const files = visibleFiles();
  if (!files.length) return `<div class="code-wrap"><div class="tree"></div><div class="viewer"><div class="empty" style="margin:auto"><div class="display">Writing files…</div><p>They appear here as the build creates them.</p></div></div></div>`;
  if (!files.some((f) => f.path === ui.codeFile)) ui.codeFile = (files.find((f) => f.path === "app/index.html") || files[0]).path;
  const f = files.find((x) => x.path === ui.codeFile);
  const base = p.git.connected && p.git.committedRevision ? committedFiles(p) : null;
  const marks = new Map((base ? diffFiles(base, files) : []).map((d) => [d.path, d.status]));
  // Lines the last version added to this file
  let added = new Set();
  const prev = p.versions.at(-2);
  if (prev) {
    const old = generateFiles({ ...p, ...clone(prev.state) }).find((x) => x.path === f.path);
    if (old && old.text !== f.text) {
      const pool = new Map();
      for (const l of old.text.split("\n")) pool.set(l, (pool.get(l) || 0) + 1);
      f.text.split("\n").forEach((l, k) => {
        if (pool.get(l)) pool.set(l, pool.get(l) - 1);
        else if (l.trim()) added.add(k);
      });
    }
  }
  // Folder tree
  const dirs = {};
  for (const x of files) {
    const parts = x.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    (dirs[dir] ||= []).push(x);
  }
  const tree = Object.keys(dirs)
    .sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map((d) => `${d ? `<div class="tree-row">${icon("folder", 14)}${esc(d)}</div>` : ""}${dirs[d].map((x) => `<button type="button" class="tree-row file ${x.path === ui.codeFile ? "on" : ""} ${firstBuildLevel() < 99 ? "appear" : ""}" data-action="code-file" data-path="${esc(x.path)}" style="padding-left:${d ? 28 : 8}px">${icon("file", 13)}<span>${esc(x.path.split("/").pop())}</span>${marks.get(x.path) ? `<span class="mark ${marks.get(x.path)}" title="${marks.get(x.path) === "A" ? "Added" : "Modified"} since the last commit">${marks.get(x.path)}</span>` : ""}</button>`).join("")}`)
    .join("");
  const ext = f.path.split(".").pop();
  const cloneCmd = p.git.connected ? `git clone https://github.com/${p.git.repo}.git` : `npx architect pull ${slug(p.name)}`;
  return `<div class="code-wrap"><nav class="tree" aria-label="Files"><div class="t-head"><span class="eyebrow">Files</span><span class="small muted">${files.length}</span></div>${tree}</nav>
<div class="viewer"><div class="viewer-bar"><div class="crumbs">${f.path.split("/").map((x, k, arr) => (k === arr.length - 1 ? `<b>${esc(x)}</b>` : `${esc(x)}<span>/</span>`)).join("")}</div><div class="row" style="margin-left:auto">${p.git.connected ? `<span class="status hide-sm">${icon("branch", 13)}${esc(p.git.branch)} · ${p.git.committedRevision === p.revision ? "synced" : "not pushed"}</span>` : btn(`${icon("github", 14)}Save to GitHub`, "pop", "btn sm quiet", 'data-pop="github"')}${btn(`${icon("copy", 13)}Copy`, "copy-file", "btn sm")}${btn(`${icon("download", 13)}Download`, "download-zip", "btn sm")}</div></div>
<pre class="code" aria-label="${esc(f.path)}"><code>${f.text.replace(/\n$/, "").split("\n").map((l, k) => `<span class="ln${added.has(k) ? " added" : ""}">${highlightLine(l, ext)}</span>`).join("")}</code></pre>
<div class="code-foot"><span class="hide-sm">Run it yourself:</span>${btn("npm run dev", "copy-cmd", "cmd", 'data-cmd="npm run dev"')}${btn("npm test", "copy-cmd", "cmd", 'data-cmd="npm test"')}<span style="margin-left:auto" class="hide-sm"></span>${btn(esc(cloneCmd), "copy-cmd", "cmd hide-sm", `data-cmd="${esc(cloneCmd)}"`)}</div></div></div>`;
}

// Agents
function agentsPane() {
  const a = A(),
    extra = p.agents || [],
    sel = extra.find((x) => x.id === ui.agentSel);
  const setup = frameworkSetup(p);
  const list = `<div class="side-list"><span class="eyebrow">Agents</span><button type="button" class="agent-item ${!sel ? "on" : ""}" data-action="agent-select" data-id="main"><span class="ag">${icon("bot", 16)}</span><span><b>${esc(a.agent.name)}</b><small>${esc(p.settings.framework)} · answers from ${esc(p.sourceName)}</small></span></button>${extra.map((x) => `<button type="button" class="agent-item ${sel?.id === x.id ? "on" : ""}" data-action="agent-select" data-id="${x.id}"><span class="ag alt">${icon("bot", 16)}</span><span><b>${esc(x.name)}</b><small>${esc(x.trigger || "")}${x.channel ? ` · ${esc(x.channel)}` : ""}</small></span></button>`).join("")}<button type="button" class="btn sm" data-action="add-agent" style="margin:8px 4px 0;align-self:flex-start">${icon("plus", 14)}Add agent</button>
<div class="flow-mini" aria-label="How a question moves"><span>${icon("message", 12)} Question asked</span><span class="arrow">↓</span><span><b>${esc(a.agent.name)}</b> reads ${esc(p.sourceName)}</span>${extra.map((x) => `<span class="arrow">↓ ${esc((x.trigger || "").toLowerCase())}</span><span><b>${esc(x.name)}</b>${x.channel ? ` → ${esc(x.channel)}` : ""}</span>`).join("")}<span class="arrow">↓</span><span>Answer card</span></div></div>`;
  if (sel)
    return `<div class="panel-wrap">${list}<div class="main-panel"><div class="ph"><span class="ag" style="width:36px;height:36px;border-radius:10px;background:var(--mist);display:inline-flex;align-items:center;justify-content:center">${icon("bot", 18)}</span><div><h2>${esc(sel.name)}</h2><span class="status"><span class="dot live"></span>${esc(sel.status || "Configured")}</span></div></div>
<div class="card"><div class="listrow"><div><strong>Job</strong><p>${esc(sel.responsibility)}</p></div></div><div class="listrow"><div><strong>Runs</strong><p>${esc(sel.trigger)}</p></div></div>${sel.channel ? `<div class="listrow"><div><strong>Reaches people on</strong><p>${esc(sel.channel)}</p></div></div>` : ""}<div class="listrow"><div><strong>Origin</strong><p>${esc(sel.origin || "Created here")}${sel.entry ? ` · <code>${esc(sel.entry)}</code>` : ""}</p></div></div></div>
<div class="row" style="margin-top:14px">${btn("Remove agent", "remove-agent", "btn danger sm", `data-id="${sel.id}"`)}</div></div></div>`;
  const s = p.settings,
    tools = p.tools || ["read_source"];
  const tabs = [
    ["behavior", "Behavior"],
    ["tools", "Tools"],
    ["framework", "Framework and model"],
    ["test", "Test"],
    ["runs", `Runs · ${(p.runs || []).length}`],
  ];
  let body = "";
  if (ui.agentTab === "behavior")
    body = `<div class="card"><h3>Job</h3><p class="muted" style="margin-top:6px">${esc(a.agent.job)}. Used on ${esc(p.pages[0]?.name || "the first page")}.</p></div>
<form class="card" id="instructions-form"><h3>Instructions</h3><label class="sr" for="instructions">Instructions</label><textarea id="instructions" rows="5" style="margin-top:10px">${esc(p.instructions)}</textarea><div class="row between" style="margin-top:10px"><span class="hint">Written to <code>agents/prompts/${esc(slug(a.agent.name).replace(/-/g, "_"))}.md</code></span><button class="btn sm primary" type="submit">Save instructions</button></div></form>
<div class="card"><h3>Behavior</h3><div style="margin-top:6px"><div class="toggle-row"><span>Answer length</span><div class="seg sm">${["short", "detailed"].map((v) => `<button type="button" data-action="set" data-key="length" data-val="${v}" class="${s.length === v ? "on" : ""}">${v === "short" ? "Short" : "Detailed"}</button>`).join("")}</div></div><div class="toggle-row"><span>When there’s no answer</span><div class="seg sm">${[["explain", "Explain and hand off"], ["ask", "Ask a follow-up"]].map(([v, l]) => `<button type="button" data-action="set" data-key="unknown" data-val="${v}" class="${s.unknown === v ? "on" : ""}">${l}</button>`).join("")}</div></div><div class="toggle-row"><span>Show the ${esc(a.app.evidence.toLowerCase())}<small>People can check where each answer came from.</small></span>${sw("setting", s.citations, "Show evidence", 'data-key="citations"')}</div><div class="toggle-row"><span>Feedback buttons<small>Helpful and Not helpful under each answer.</small></span>${sw("setting", s.feedback, "Feedback buttons", 'data-key="feedback"')}</div></div></div>`;
  else if (ui.agentTab === "tools")
    body = `<div class="card"><h3>What ${esc(a.agent.name)} may do</h3><div style="margin-top:6px">${TOOLS.map(([id, label]) => `<div class="toggle-row"><span>${esc(label)}<small>${id === "read_source" ? `Reads ${esc(p.sourceName)}. Turn it off and the app replies with a setup message.` : "Runs as a demo action in this prototype."}</small></span>${sw("tool", tools.includes(id), label, `data-id="${id}"`)}</div>`).join("")}</div></div>`;
  else if (ui.agentTab === "framework")
    body = `<div class="card"><h3>Framework</h3><p class="hint" style="margin:6px 0 12px">Keep the stack you already use. Architect writes the matching files.</p><div class="fw-chips">${["Lyzr managed", "LangGraph", "CrewAI", "OpenAI Agents SDK", "Custom framework"].map((x) => btn(x, "framework", `chip ${s.framework === x ? "on" : ""}`, `data-fw="${x}" aria-pressed="${s.framework === x}"`)).join("")}</div>
${s.framework === "Custom framework" ? `<form id="custom-entry" class="row" style="margin-top:12px"><label class="sr" for="entry">Entry point</label><input id="entry" value="${esc(s.customFramework || "")}" placeholder="agents/main.py exposing run(input)"><button class="btn sm" type="submit">Save</button></form>` : ""}
<p class="hint" style="margin-top:12px">Writes ${btn(`<code>${esc(setup.entry)}</code>`, "code-open", "link", `data-path="${esc(setup.entry)}"`)} · runs on ${esc(setup.runtime)}</p></div>
<div class="card"><h3>Model</h3><label class="sr" for="agent-model">Model</label><select id="agent-model" data-change="model" style="margin-top:10px">${["Managed default", "OpenAI · bring your key", "Anthropic · bring your key"].map((x) => `<option ${s.model === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
<div class="card"><div class="row between"><h3>Setup</h3><span class="status ${/ready/i.test(setup.status) ? "live" : ""}"><span class="dot ${/ready/i.test(setup.status) ? "live" : "amber"}"></span>${esc(setup.status)}</span></div><ol class="trace" style="margin-top:10px">${setup.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><div style="margin-top:12px">${envVars(p).map((v) => `<div class="toggle-row"><code>${esc(v.name)}</code><span class="status ${v.status === "Not set" ? "" : "live"}"><span class="dot ${v.status === "Not set" ? "amber" : "live"}"></span>${esc(v.status)}</span></div>`).join("")}</div>${btn("Manage variables", "settings", "btn sm", 'style="margin-top:10px"')}</div>`;
  else if (ui.agentTab === "test")
    body = `<form class="card" id="test-form"><h3>Try ${esc(a.agent.name)}</h3><div class="row" style="margin-top:10px"><label class="sr" for="test-input">Test input</label><input id="test-input" value="${esc(ui.testInput || (p.chips || a.chips)[0][1])}"><button class="btn primary sm" type="submit">${icon("play", 12)}Run</button></div><div class="row wrap" style="margin-top:10px">${(p.chips || a.chips).map(([l, q]) => btn(esc(l), "test-chip", "chip", `data-q="${esc(q)}"`)).join("")}</div>${ui.testResult ? `<div class="out" style="margin-top:14px"><strong>${ui.testResult.supported ? "Answered" : "No match"}</strong><p style="margin-top:4px">${esc(ui.testResult.text)}</p></div><ol class="trace">${ui.testResult.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}</form>`;
  else body = `<div class="card">${(p.runs || []).length ? p.runs.map((r, k) => runItem(r, k === 0)).join("") : `<p class="muted">No runs yet. Every question asked in the preview or in Test is recorded here with its steps.</p>`}</div>`;
  return `<div class="panel-wrap">${list}<div class="main-panel"><div class="ph"><span style="width:36px;height:36px;border-radius:10px;background:var(--ink);color:#fff;display:inline-flex;align-items:center;justify-content:center">${icon("bot", 18)}</span><div><h2>${esc(a.agent.name)}</h2><span class="status ${/ready/i.test(setup.status) ? "live" : ""}"><span class="dot ${/ready/i.test(setup.status) ? "live" : "amber"}"></span>${esc(/ready/i.test(setup.status) ? "Ready" : setup.status)} · ${esc(s.framework)}</span></div></div><div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${ui.agentTab === k}" data-action="agent-tab" data-k="${k}" class="${ui.agentTab === k ? "on" : ""}">${l}</button>`).join("")}</div>${body}</div></div>`;
}

// Data
function dataPane() {
  const a = A();
  const checks = runChecks(p);
  return `<div class="panel-wrap"><div class="side-list"><span class="eyebrow">Sources</span><div class="agent-item on"><span class="ag">${icon(a.id === "insight" ? "db" : "book", 16)}</span><span><b>${esc(p.sourceName)}</b><small>${p.sourceKind === "sample" ? "Sample content" : "Your content"} · ${plural(p.source.split("\n").filter(Boolean).length, "line")}</small></span></div><span class="eyebrow" style="margin-top:14px">Connect</span>${a.source.connectors.map((x) => `<button type="button" class="agent-item" data-action="connect-source" data-source="${esc(x)}"><span class="ag alt">${icon("link", 15)}</span><span><b>${esc(x)}</b><small>${p.connections?.includes(x) ? "Set up" : "Not connected"}</small></span></button>`).join("")}</div>
<div class="main-panel"><div class="ph"><div><h2>${esc(p.sourceName)}</h2><span class="status">${p.sourceKind === "sample" ? "Sample content. Replace it with yours." : "Your content"}</span></div></div>
<form class="card" id="source-form"><div class="field"><label class="field-label" for="source-name">Name</label><input id="source-name" value="${esc(p.sourceName)}" required></div><div class="field"><label class="field-label" for="source-text">${esc(a.source.label)}</label><textarea id="source-text" rows="9" class="mono" style="font-size:12.5px">${esc(p.source)}</textarea><p class="hint">${esc(a.source.hint)}</p></div><div class="row between" style="margin-top:12px"><label class="btn sm" style="cursor:pointer">${icon("upload", 13)}Import a .txt or .csv<input id="source-file" type="file" accept=".txt,.csv,.md,text/plain,text/csv" class="sr"></label><button class="btn primary sm" type="submit">Save source</button></div></form>
<div class="card"><div class="row between"><h3>Sample questions</h3><span class="status ${checks.passed === checks.total ? "live" : ""}"><span class="dot ${checks.passed === checks.total ? "live" : "amber"}"></span>${checks.passed} of ${checks.total} behave</span></div><p class="hint" style="margin:6px 0 8px">The first two should be answered and the last should not. They run before every publish.</p>${checks.results.map((r) => `<div class="toggle-row"><span>${esc(r.question)}<small>${r.expected ? "Should be answered" : "Should not be answered"}</small></span><span class="status ${r.ok ? "live" : "ember"}">${r.ok ? icon("check", 14) : icon("alert", 14)}${r.ok ? "As expected" : "Check this"}</span></div>`).join("")}</div></div></div>`;
}

// ---------- Popovers ----------
function workspacePop() {
  if (ui.pop === "project") return projectPop();
  if (ui.pop === "history") return historyPop();
  if (ui.pop === "github") return githubPop();
  if (ui.pop === "share") return sharePop();
  if (ui.pop === "publish") return publishPop();
  if (ui.pop === "account") return accountPop("ws");
  return "";
}
function projectPop() {
  return `<div class="pop left" role="dialog" aria-label="Project"><form id="rename-form" class="stack" style="gap:8px"><label class="field-label" for="rename" style="margin:0">Project name</label><div class="row"><input id="rename" value="${esc(p.name)}" maxlength="50"><button class="btn sm primary" type="submit">Save</button></div></form><div class="menu">${btn(`${icon("settings", 15)}Project settings`, "settings", "")}${btn(`${icon("history", 15)}Version history`, "pop", "", 'data-pop="history"')}${btn(`${icon("download", 15)}Download source (.zip)`, "download-zip", "")}${btn(`${icon("file", 15)}Export project (.json)`, "export", "")}<hr>${btn(`${icon("grid", 15)}All projects`, "home", "")}${btn(`${icon("archive", 15)}Archive project`, "archive", "")}</div></div>`;
}
function historyPop() {
  const rel = new Map(p.releases.map((r) => [r.revision, r.number]));
  return `<div class="pop" role="dialog" aria-label="Version history"><div><h2>Versions</h2><p class="sub">Every change is saved. Restoring an older version adds a new one, so nothing is lost.</p></div><div class="versions">${[...p.versions]
    .reverse()
    .map((v, k) => `<div class="listrow"><div><strong>Version ${v.n}</strong><p>${esc(v.label)} · ${ago(v.at)}${rel.has(v.revision) ? ` · published as release ${rel.get(v.revision)}` : ""}</p></div>${k === 0 ? `<span class="status live"><span class="dot live"></span>Current</span>` : btn("Restore", "restore", "btn sm", `data-id="${v.id}"`)}</div>`)
    .join("")}</div></div>`;
}
function githubPop() {
  const g = p.git;
  if (!g.connected)
    return `<div class="pop" role="dialog" aria-label="GitHub"><div><h2>Save every version to GitHub</h2><p class="sub">Architect commits each version to your repository, so the code is always yours.</p></div><form id="git-form" class="stack" style="gap:12px"><div class="field"><label class="field-label" for="git-repo">Repository</label><input id="git-repo" value="${esc(g.repo || `${slug(db.account?.name || "you")}/${slug(p.name)}`)}" pattern="[\\w.\\-]+/[\\w.\\-]+" required></div><div class="toggle-row" style="border:0;padding:0"><span>Private repository</span>${sw("noop", true, "Private repository")}</div><button class="btn primary" type="submit" ${ui.gitStep ? "disabled" : ""}>${ui.gitStep ? `${spinner(14)}Waiting for GitHub…` : `${icon("github", 16)}Connect GitHub`}</button></form><div class="pop-foot"><span>Already on GitHub?</span>${btn("Import a repository", "import", "link")}</div></div>`;
  const behind = g.committedRevision < p.revision;
  const n = p.versions.filter((v) => v.revision > g.committedRevision).length;
  return `<div class="pop" role="dialog" aria-label="GitHub"><div class="row" style="gap:10px">${icon("github", 22)}<div class="grow"><strong style="font-size:15px">${esc(g.repo)}</strong><div class="row small muted">${icon("branch", 13)}<span>${esc(g.branch)}</span>${btn("Change", "branch", "link small")}</div></div></div>
<div class="note-amber" style="background:${behind ? "var(--amber-soft)" : "var(--sage)"}">${behind ? icon("alert", 15) : icon("check", 15)}<span>${behind ? `${plural(n || 1, "version")} not pushed yet` : `Up to date${g.lastMessage ? ` · “${esc(g.lastMessage)}”` : ""}`}</span></div>
<div class="toggle-row"><span>Commit every version automatically<small>Turn off to review and push yourself.</small></span>${sw("git-auto", g.auto !== false, "Commit every version automatically")}</div>
<div class="row wrap">${behind ? btn("Commit and push", "commit-push", "btn primary sm") : ""}${btn("Open a pull request", "open-pr", "btn sm")}${btn(`${icon("code", 13)}View changes`, "tab", "btn sm", 'data-tab="code"')}</div>
<div class="field"><span class="field-label">Clone</span>${btn(`git clone https://github.com/${esc(g.repo)}.git`, "copy-cmd", "cmd", `data-cmd="git clone https://github.com/${esc(g.repo)}.git" style="text-align:left;padding:8px 10px"`)}</div>
<div class="pop-foot"><span>${g.lastCommit ? `Last commit <code>${esc(g.lastCommit)}</code>` : "No commits yet"}</span>${btn("Disconnect", "git-disconnect", "link")}</div></div>`;
}
function sharePop() {
  const me = { email: db.account?.email || "aman@demo.architect", role: "Owner", name: db.account?.name || "Aman" };
  const members = [me, ...(p.members || []).filter((m) => m.role !== "Owner")];
  return `<div class="pop" role="dialog" aria-label="Share"><div><h2>Share ${esc(p.name)}</h2><p class="sub">Invite people to build with you, or send the preview.</p></div><form id="invite-form" class="row"><label class="sr" for="invite-email">Email</label><input id="invite-email" type="email" required placeholder="name@company.com"><label class="sr" for="invite-role">Role</label><select id="invite-role" style="width:auto"><option>Can edit</option><option>Can view</option></select><button class="btn primary sm" type="submit">Invite</button></form><div>${members.map((m) => `<div class="listrow"><div class="row" style="gap:10px"><span class="avatar sm">${esc((m.name || m.email).slice(0, 2).toUpperCase())}</span><div><strong style="font-size:13.5px">${esc(m.name || m.email)}</strong><p>${esc(m.email)}${m.status ? ` · ${esc(m.status)}` : ""}</p></div></div><span class="small muted">${esc(m.role)}</span></div>`).join("")}</div><div class="pop-foot"><span>${icon("link", 13)} Preview link</span>${btn(`${icon("copy", 13)}Copy link`, "copy-preview", "btn sm")}</div></div>`;
}
function publishPop() {
  const latest = p.releases.at(-1);
  const address = p.customDomain?.status === "verified" ? p.customDomain.name : `${slug(p.name)}.architect.app`;
  if (typeof ui.pubStep === "number") {
    const steps = [`Froze version ${p.versions.at(-1).n}`, `Started ${plural(1 + (p.agents || []).length, "agent")} with production settings`, "Moved visitors to the new version"];
    return `<div class="pop" role="dialog" aria-label="Publishing"><div class="row between"><h2>Publishing</h2><span class="small muted">${ui.pubStep + 1} of 3</span></div><div class="progress"><i style="width:${Math.round(((ui.pubStep + 0.5) / 3) * 100)}%"></i></div><div class="steps">${steps.map((s, k) => (k < ui.pubStep ? `<div class="step">${icon("check", 14, "add")}<span>${esc(s)}</span></div>` : k === ui.pubStep ? `<div class="step current">${spinner(14)}<span>${esc(s)}</span></div>` : `<div class="step todo"><span class="todo-ring"></span><span>${esc(s)}</span></div>`)).join("")}</div></div>`;
  }
  if (ui.pubStep === "live" && latest) {
    return `<div class="pop" role="dialog" aria-label="Live"><div class="live-art">${horizon(true)}</div><div><span class="status live"><span class="dot live"></span>Live · release ${latest.number}</span><h2 style="margin-top:6px;font-size:30px">${esc(p.name)} is live.</h2></div><div class="addr"><span class="grow" style="font-weight:500">${esc(address)}</span>${btn(`${icon("copy", 13)}Copy`, "copy-link", "btn sm quiet", `data-link="${esc(recipientUrl(latest))}"`)}</div><div class="row"><a class="btn primary grow" href="?release=${latest.id}" target="_blank" rel="noopener">Open app</a>${btn("Share", "pop", "btn grow", 'data-pop="share"')}${btn(icon("qr", 16), "qr", "icon-btn", 'aria-label="Show QR code" style="border:1px solid var(--line-2);width:36px;height:36px"')}</div>${releasesList()}</div>`;
  }
  const checks = runChecks(p);
  const env = envVars(p).filter((v) => v.status === "Not set");
  const reading = (p.tools || ["read_source"]).includes("read_source");
  const since = latest ? p.versions.filter((v) => v.revision > latest.revision).length : 0;
  const upToDate = latest && latest.revision === p.revision;
  return `<div class="pop" role="dialog" aria-label="Publish"><div><h2>Publish ${esc(p.name)}</h2><p class="sub">${latest ? (upToDate ? `Release ${latest.number} is live and up to date.` : `Version ${p.versions.at(-1).n} · ${plural(since, "change")} since release ${latest.number}`) : `Version ${p.versions.at(-1).n} · first release`}</p></div>
<div class="field"><span class="field-label">Address</span><div class="addr"><span class="grow">${esc(slug(p.name))}<span class="muted">.architect.app</span></span>${p.customDomain ? `<span class="status ${p.customDomain.status === "verified" ? "live" : ""}" style="background:var(--sage);border-radius:8px;padding:4px 8px"><span class="dot ${p.customDomain.status === "verified" ? "live" : "amber"}"></span>${esc(p.customDomain.name)}</span>` : btn("Add a domain", "domain", "btn sm quiet")}</div></div>
<div class="field"><span class="field-label">Who can open it</span><div class="seg block" role="group">${[["public", "Anyone with the link"], ["team", p.settings.signin ? `${p.settings.signin} sign-in` : "Signed-in people"]].map(([v, l]) => `<button type="button" data-action="set" data-key="audience" data-val="${v}" class="${p.settings.audience === v ? "on" : ""}">${esc(l)}</button>`).join("")}</div></div>
<div class="field"><span class="field-label">Before it goes live</span><div class="checks"><div>${icon(p.stage === "built" ? "check" : "alert", 14, p.stage === "built" ? "add" : "del")}${p.stage === "built" ? "The app builds" : "Finish building first"}</div><div>${icon(checks.passed === checks.total ? "check" : "alert", 14, checks.passed === checks.total ? "add" : "del")}Sample questions: ${checks.passed} of ${checks.total} behave</div><div>${icon(reading ? "check" : "alert", 14, reading ? "add" : "del")}${reading ? `${esc(A().agent.name)} can read ${esc(p.sourceName)}` : "Source reading is off in Tools"}</div>${env.length ? `<div class="note-amber">${icon("alert", 15)}<span class="grow"><code>${esc(env.map((v) => v.name).join(", "))}</code> not set</span>${btn("Add", "settings", "btn sm")}</div>` : ""}</div></div>
<button type="button" class="btn primary big arrow" data-action="release" ${p.stage !== "built" || build?.pid === p.id || upToDate ? "disabled" : ""}>${upToDate ? "Up to date" : latest ? `Publish version ${p.versions.at(-1).n}` : "Publish"}<span class="disc">${icon("arrow", 15)}</span></button>
${p.releases.length ? releasesList() : ""}</div>`;
}
function releasesList() {
  const latest = p.releases.at(-1);
  return `<div class="versions"><span class="field-label">Releases</span>${p.releases
    .slice()
    .reverse()
    .slice(0, 5)
    .map((r) => `<div class="listrow"><div><strong>Release ${r.number}</strong><p>${ago(r.at)} · ${esc(describe(r))}</p></div><div class="row">${btn("Log", "deploy-log", "btn sm quiet", `data-id="${r.id}"`)}${r === latest ? `<span class="status live"><span class="dot live"></span>Live</span>` : btn("Roll back", "rollback", "btn sm", `data-id="${r.id}"`)}</div></div>`)
    .join("")}</div>`;
}
function accountPop(where) {
  return `<div class="pop" role="dialog" aria-label="Account" style="width:300px;${where === "home" ? "top:62px;right:24px" : ""}"><div class="row" style="gap:10px"><span class="avatar">${esc(initials())}</span><div><strong>${esc(db.account?.name || "Aman")}</strong><p class="small muted">${esc(db.account?.email || "")}</p></div></div><div class="menu">${where === "ws" ? btn(`${icon("settings", 15)}Project settings`, "settings", "") : ""}${btn(`${icon("bolt", 15)}1,240 credits · usage`, "usage", "")}${btn(`${icon("info", 15)}What’s real in this prototype`, "about", "")}${btn(`${icon("refresh", 15)}Reset demo data`, "reset-demo", "")}<hr>${btn(`${icon("logout", 15)}Sign out`, "signout", "")}</div></div>`;
}
const recipientUrl = (r) => `${location.origin}${location.pathname}?release=${r.id}`;

// ---------- Shared views (published release, draft preview) ----------
function findRelease(id) {
  for (const x of db.projects) {
    const r = x.releases.find((y) => y.id === id);
    if (r) return r;
  }
  return null;
}
function sharedView() {
  const target = releaseId ? findRelease(releaseId) : byId(previewId);
  const badge = `<a class="made-with" href="./">${logo(18)}Made with Architect</a>`;
  if (!target) {
    app.innerHTML = `<div class="gate">${logo(34)}<h1 class="display" style="font-size:34px">This link isn’t available here.</h1><p class="muted">Prototype releases live in the browser that published them. Open Architect in that browser to see it.</p><a class="btn primary" href="./">Open Architect</a></div>`;
    return;
  }
  const th = THEMES[target.settings.theme] || THEMES.forest;
  document.body.style.background = th.bg;
  if (releaseId && target.settings.audience === "team" && !sessionStorage.getItem("recipient-" + target.id)) {
    app.innerHTML = `<div class="appview ${th.dark ? "dark" : ""}" style="${themeVars(th)};min-height:100vh"><div class="gate"><span class="a-mark" style="width:44px;height:44px;border-radius:12px;font-size:20px">${esc(target.name[0])}</span><h1 class="a-h" style="font-family:Georgia,serif;font-weight:400;font-size:34px">${esc(target.name)}</h1><p style="color:var(--a-muted)">Sign in to continue.</p><button type="button" class="a-btn" data-action="recipient-login" style="padding:12px 22px">${target.settings.signin === "Google" ? "Continue with Google" : target.settings.signin ? `Continue with ${esc(target.settings.signin)}` : "Continue with your work account"}</button></div></div>${badge}`;
    return;
  }
  document.title = target.name;
  app.innerHTML = `<div class="shared">${appView(target, { builder: false })}</div>${badge}`;
}

// ---------- Flows ----------
function setHash() {
  if (p && ui.view === "workspace") history.replaceState(null, "", `#${p.id}/${ui.tab}`);
  else history.replaceState(null, "", location.pathname + location.search);
}
function resetWorkspaceUi() {
  Object.assign(ui, { tab: "preview", pop: null, selecting: false, sel: "", page: "home", console: false, mode: "build", mobile: "chat", mention: false, codeFile: "", agentSel: "main", agentTab: "behavior", testResult: null, q: "", result: null, showSource: false, fb: "", pubStep: null, stick: true });
}
function openProject(id, tab = "preview") {
  p = byId(id);
  if (!p) return;
  resetWorkspaceUi();
  ui.view = "workspace";
  ui.tab = tab;
  if (p.chat.length === 0) p.chat.push({ role: "assistant", kind: "text", text: `Welcome back to ${p.name}. Ask for a change, or select something in the preview.` });
  setHash();
  render();
}
function goHome() {
  closeModal();
  ui.view = "home";
  ui.pop = null;
  p = null;
  setHash();
  render();
  window.scrollTo({ top: 0 });
}
function requireAccount(action) {
  if (db.signedIn) return true;
  pending = action;
  auth = { step: "choose", email: "", busy: "" };
  signinDialog();
  return false;
}
function signinDialog() {
  const idea = pending?.brief;
  const title = idea ? "Sign in to start building" : "Sign in to Architect";
  const sub = idea ? "Your idea is saved. The build starts as soon as you’re in." : "Build apps and agents by describing them.";
  let body;
  if (auth.step === "sent")
    body = `<div class="quote">We sent a sign-in link to <strong>${esc(auth.email)}</strong>. Open it on this device, or enter the code from the email.</div><form id="code-form" class="stack"><div class="field"><label class="field-label" for="code">Code</label><input id="code" value="ARCHITECT" autocomplete="one-time-code"></div><button class="btn primary big" type="submit">Continue</button></form><button type="button" class="link" data-action="auth-back" style="align-self:center">Use another way to sign in</button>`;
  else
    body = `${idea ? `<div class="quote"><span class="eyebrow" style="display:block;margin-bottom:6px">Your idea</span>${esc(idea.length > 220 ? idea.slice(0, 220) + "…" : idea)}</div>` : ""}<div class="stack">${btn(auth.busy === "Google" ? `${spinner(16)}Connecting to Google…` : `${googleLogo}Continue with Google`, "auth-provider", "provider", `data-provider="Google" autofocus ${auth.busy ? "disabled" : ""}`)}${btn(auth.busy === "GitHub" ? `${spinner(16)}Connecting to GitHub…` : `${icon("github", 18)}Continue with GitHub`, "auth-provider", "provider", `data-provider="GitHub" ${auth.busy ? "disabled" : ""}`)}</div><div class="or">or with work email</div><form id="email-form" class="stack"><label class="sr" for="email">Work email</label><input id="email" type="email" required placeholder="you@company.com" value="${esc(auth.email)}" style="height:48px"><button class="btn primary big" type="submit">Email me a sign-in link</button></form><p class="small muted" style="text-align:center">By continuing you agree to the Terms and Privacy Policy.</p><button type="button" class="link" data-action="auth-demo" style="align-self:center">Look around a demo workspace instead</button>`;
  dialog(title, sub, body, "", { logo: true });
}
function finishSignIn(method, email) {
  db.signedIn = true;
  db.account = { name: /^aman/.test(email) ? "Aman" : cap(email.split("@")[0].replace(/[._-].*/, "")) || "You", email, method };
  save();
  auth = { step: "choose", email: "", busy: "" };
  closeModal();
  const next = pending;
  pending = null;
  toast(`Signed in with ${method}.`);
  if (next?.type === "build") return startProject(next.brief, next.opts);
  if (next?.type === "import") return act.import();
  render();
}

// First build
function introFor(x, read) {
  const a = A(x);
  let t = `Here’s the plan for ${x.name}.`;
  if (!read.confident) t += ` I started from “${a.label}”, the closest of the three starting points this prototype builds. You can switch it below.`;
  if (x.initialOps?.length) t += ` From your prompt: ${x.initialOps.join("; ").replace(/\.$/, "")}.`;
  return t;
}
function firstSteps(x) {
  const a = A(x),
    setup = frameworkSetup(x),
    checks = runChecks(x),
    extra = x.agents || [];
  return [
    `Planned ${plural(x.pages.length, "page")}, ${plural(1 + extra.length, "agent")} and the data`,
    `Laid out ${x.pages.map((y) => y.name).join(" and ")} · app/index.html, app/app.js`,
    `Wrote ${a.agent.name} on ${x.settings.framework} · ${setup.entry}`,
    ...extra.map((y) => `Added ${y.name}${y.channel ? ` · hands off on ${y.channel}` : ""}`),
    `Loaded ${x.sourceName} · ${plural(x.source.split("\n").filter(Boolean).length, "entry", "entries")}`,
    x.settings.signin ? `Added ${x.settings.signin} sign-in` : null,
    `Checked ${checks.total} sample questions · ${checks.passed} of ${checks.total} behave as expected`,
    "Started the preview",
  ].filter(Boolean);
}
function startProject(text, opts = {}) {
  const x = createProject(text, false, opts);
  for (const f of ui.attachments) {
    const fits = f.text && ((A(x).id === "insight" && /\.csv$/i.test(f.name)) || (A(x).id !== "insight" && /\.(txt|md)$/i.test(f.name) && /^[^:\n]{2,40}:/m.test(f.text)));
    if (fits) {
      x.source = f.text.trim();
      x.sourceName = f.name.replace(/\.[^.]+$/, "");
      x.sourceKind = "local";
    }
  }
  x.references = ui.attachments.map((f) => ({ name: f.name, kind: f.kind }));
  for (const name of ui.homeAgents) {
    const s = STUDIO_AGENTS.find((y) => y[0] === name);
    x.agents.push({ id: crypto.randomUUID(), enabled: true, name: s[0], responsibility: s[1], trigger: "After the main agent answers", origin: `Lyzr Studio · ${s[2]}`, status: "Managed in Studio" });
  }
  x.builderModel = ui.model;
  x.versions = [];
  checkpoint(x, "First version");
  const read = interpret(text);
  x.chat.push({ role: "user", text });
  x.chat.push({ role: "assistant", kind: "text", text: introFor(x, read) });
  x.chat.push({ role: "assistant", kind: "plan", id: uid(), awaiting: ui.planFirst });
  db.projects.unshift(x);
  ui.attachments = [];
  ui.homeAgents = [];
  brief = "";
  sessionStorage.removeItem("architect-draft-brief");
  p = x;
  resetWorkspaceUi();
  ui.view = "workspace";
  save();
  setHash();
  if (ui.planFirst) {
    ui.planFirst = false;
    render();
  } else startFirstBuild();
}
function startFirstBuild() {
  ui.lastLvl = 0;
  const m = { role: "assistant", kind: "build", id: uid(), first: true, steps: firstSteps(p), files: generateFiles(p).map((f) => ({ path: f.path, status: "A", add: f.text.split("\n").length, del: 0 })), versionN: p.versions[0].n, versionId: p.versions[0].id, started: Date.now() };
  p.chat.push(m);
  p.stage = "building";
  save();
  runSteps(m, 620, (x) => {
    x.stage = "built";
    m.secs = Math.max(4, Math.round((Date.now() - m.started) / 1000));
  });
}
function runSteps(m, ms, done, from = 0) {
  const proj = p;
  clearInterval(build?.timer);
  build = { pid: proj.id, msgId: m.id, step: from, proj, m, done };
  build.timer = setInterval(() => {
    build.step++;
    if (build.step >= m.steps.length) {
      clearInterval(build.timer);
      build = null;
      delete m.paused;
      m.done = true;
      done(proj);
      save();
    }
    render();
  }, ms);
  ui.stick = true;
  render();
}

// Changes from chat
const INTROS = { settings: "On it.", page: "Adding the page.", agent: "Adding an agent for that.", instructions: "Updating the agent’s instructions.", rename: "Renaming it.", copy: "Updating the text.", tools: "Giving the agent that ability.", removePage: "Removing the page." };
function autoCommit(x, label) {
  if (!x.git.connected || x.git.auto === false) return;
  x.git.committedRevision = x.revision;
  x.git.syncedRevision = x.revision;
  x.git.lastMessage = label;
  x.git.lastCommit = uid().slice(0, 7);
}
function runChange(ops, intro) {
  if (build) return toast("Wait for the current change to finish.");
  const dry = clone(p);
  const { files } = applyOps(dry, ops);
  const descs = ops.flatMap((op) => describeOp(p, op).split(" · "));
  const touched = files.filter((f) => f.status === "M").slice(0, 2).map((f) => f.path.split("/").pop());
  const m = { role: "assistant", kind: "build", id: uid(), intro: intro || INTROS[ops[0].type] || "On it.", steps: [`Read ${touched.join(" and ") || "the project"}`, ...descs, `Updated ${plural(files.length, "file")}`, "Refreshed the preview"], files, ops };
  p.chat.push(m);
  save();
  runSteps(m, 460, (x) => {
    const res = applyOps(x, ops);
    m.files = res.files;
    m.versionN = res.version.n;
    m.versionId = res.version.id;
    delete m.ops;
    autoCommit(x, res.version.label);
    if (x === p) {
      ui.result = ui.q && ui.result ? answer(x, ui.q) : null;
      ui.fb = "";
      const page = ops.find((o) => o.type === "page");
      if (page) ui.page = page.page.id;
      if (ops.some((o) => o.type === "removePage" && o.id === ui.page)) ui.page = "home";
    }
  });
}
function quickChange(ops, message) {
  const res = applyOps(p, ops);
  autoCommit(p, res.version.label);
  ui.result = ui.result && ui.q ? answer(p, ui.q) : null;
  save();
  render();
  if (modal.open && modal.dataset.kind === "settings") settingsDialog();
  toast(`${message || describeOp(p, ops[0]).split(" · ")[0]} · version ${res.version.n}`);
}
function guessName(text) {
  const words = text
    .replace(/[^\w\s'-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const skip = new Set("please can you could we i want need would like to add make create build show let have give a an the some new me us it my our".split(" "));
  const stop = new Set("of for with that where to on in which who so and or when about by from".split(" "));
  const out = [];
  for (const w of words) {
    if (!out.length && skip.has(w)) continue;
    if (stop.has(w)) break;
    out.push(w);
    if (out.length === 3) break;
  }
  return out.length ? cap(out.join(" ")).replace(/\b\w/g, (c) => c.toUpperCase()) : "New";
}
function sendMessage(text) {
  if (!text) return;
  const sel = ui.sel ? EL_LABELS[ui.sel] : "";
  p.chat.push({ role: "user", text, sel });
  p.unsent = "";
  ui.stick = true;
  const det = detectOps(p, text, ui.sel);
  if (det.undo) {
    const prev = p.versions.at(-2);
    if (!prev) {
      p.chat.push({ role: "assistant", kind: "text", text: "There’s nothing to undo yet. This is the first version." });
      save();
      return render();
    }
    return restore(prev.id);
  }
  if (det.device) ui.device = det.device;
  if (det.ops.length) {
    if (ui.mode === "plan") {
      const dry = clone(p);
      const { files } = applyOps(dry, det.ops);
      p.chat.push({ role: "assistant", kind: "proposal", id: uid(), text: "Here’s what I’d do. Nothing changes until you say build.", steps: det.ops.flatMap((op) => describeOp(p, op).split(" · ")), files, ops: det.ops });
      save();
      return render();
    }
    save();
    return runChange(det.ops);
  }
  if (det.device) {
    p.chat.push({ role: "assistant", kind: "text", text: "The app already adapts to small screens. I switched the preview to phone size so you can check it." });
    save();
    return render();
  }
  if (det.data) {
    p.chat.push({ role: "assistant", kind: "text", text: `Paste or import it in Data and ${A().agent.name} answers from it straight away.`, action: { label: "Open Data", do: "tab-arg", arg: "data" } });
    save();
    return render();
  }
  if (/\b(premium|modern|clean|minimal|beautiful|prettier|pretty|nicer|elegant|polish\w*|sleek|fun|playful|bold|fresh|calmer|warmer|look(s)? (better|nicer|good)|design|style|vibe)\b/i.test(text)) {
    const looks = Object.entries(THEMES).filter(([k]) => k !== p.settings.theme).slice(0, 3);
    p.chat.push({
      role: "assistant",
      kind: "clarify",
      id: uid(),
      text: "Here are three looks for it. Pick one and I’ll apply it; you can fine-tune by selecting anything in the preview.",
      options: looks.map(([k, th]) => ({ label: `${th.label}${th.dark ? ": dark background, bright accent" : `: ${k === "plum" ? "deep plum accent" : k === "amber" ? "warm terracotta accent" : k === "ocean" ? "calm blue accent" : "quiet green accent"}`}`, ops: [{ type: "settings", change: { theme: k } }] })),
    });
    save();
    return render();
  }
  const name = guessName(text);
  p.chat.push({
    role: "assistant",
    kind: "clarify",
    id: uid(),
    text: "I can build that a few ways. Which fits?",
    options: [
      { label: `Add a “${name}” page`, ops: [{ type: "page", page: { id: slug(name) + "-" + uid().slice(0, 4), name, kind: pageKind(name) } }] },
      { label: `Tell ${A().agent.name} to do it`, ops: [{ type: "instructions", line: text.replace(/\s+/g, " ").slice(0, 160) }] },
      { label: "Plan it with me first", plan: true },
    ],
  });
  save();
  render();
}
function restore(id) {
  if (build) return toast("Wait for the current change to finish.");
  const v = p.versions.find((x) => x.id === id);
  const res = restoreVersion(p, id);
  if (!res) return;
  autoCommit(p, res.version.label);
  p.chat.push({ role: "assistant", kind: "build", id: uid(), intro: `Back to version ${v.n}.`, steps: [`Restored version ${v.n}: ${v.label}`, "Refreshed the preview"], files: res.files, done: true, versionN: res.version.n, versionId: res.version.id });
  ui.result = null;
  ui.page = "home";
  ui.pop = null;
  save();
  render();
  toast(`Restored version ${v.n}. Saved as version ${res.version.n}.`);
}
function startPublish() {
  ui.pubStep = 0;
  render();
  clearInterval(pubTimer);
  const proj = p;
  pubTimer = setInterval(() => {
    if (p !== proj) return clearInterval(pubTimer);
    ui.pubStep++;
    if (ui.pubStep >= 3) {
      clearInterval(pubTimer);
      const r = publish(p);
      p.stage = "built";
      save();
      ui.pubStep = "live";
      ui.lastRelease = r;
    }
    render();
  }, 700);
}
function recordPreview(q) {
  ui.fresh = true;
  setTimeout(() => (ui.fresh = false), 50);
  ui.q = q;
  ui.result = answer(p, q);
  ui.showSource = false;
  ui.fb = "";
  recordRun(p, q, ui.result);
  save();
}
function downloadBlob(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast(text);
  }
}

// Import
function importDialog() {
  const f = importFlow;
  if (f.step === "pick")
    return dialog(
      "Import from GitHub",
      "Architect reads the repository first. Nothing is written until you ask for a change.",
      `<label class="sr" for="repo-search">Search repositories</label><input id="repo-search" placeholder="Search your repositories" value="northstar"><div class="stack">${[["northstar/support-app", "React · LangGraph · team sign-in · updated 3 days ago"]].map(([r, d]) => `<button type="button" class="choice ${f.repo === r ? "on" : ""}" data-action="import-repo" data-repo="${r}">${icon("github", 20)}<span class="grow"><b>${r}</b><small>${d}</small></span>${f.repo === r ? icon("check", 16) : ""}</button>`).join("")}</div><div class="field"><label class="field-label" for="import-branch">Branch</label><select id="import-branch"><option>main</option><option ${f.branch === "feature/citations" ? "selected" : ""}>feature/citations</option></select></div>`,
      `${btn("Grant access to more repositories", "import-more", "btn quiet")}${btn("Read this repository", "import-scan", "btn primary", f.repo ? "" : "disabled")}`,
    );
  if (f.step === "zip")
    return dialog("Upload a project", "A ZIP of your codebase. Architect reads the frameworks, start commands and sign-in before changing anything.", `<label class="choice" style="cursor:pointer;justify-content:center;padding:26px;border-style:dashed">${icon("upload", 20)}<span><b>Choose a .zip</b><small>Or drop it here</small></span><input id="zip-file" type="file" accept=".zip,application/zip" class="sr"></label>`);
  if (f.step === "scan") {
    const lines = [
      [`Read ${f.archive ? f.archive.name : `${f.repo} · ${f.branch}`}`, f.archive ? `${Math.round(f.archive.size / 1024)} KB` : "214 files"],
      ["App", "React 18 with Vite, 12 pages"],
      ["Agent", "One LangGraph graph in agents/graph.py"],
      ["Sign-in", "Clerk, team accounts"],
      ["Data", "docs/handbook.md"],
      ["Hosting", "Vercel, production"],
    ];
    return dialog(
      f.scanStep >= lines.length ? "What we found" : "Reading your project…",
      f.scanStep >= lines.length ? "We keep your framework, sign-in, data and hosting. Changes go to a branch you review." : "",
      `<div class="steps" style="font-size:14px">${lines.map(([t, d], k) => (k < f.scanStep ? `<div class="step">${icon("check", 15, "add")}<span><b style="font-weight:600">${esc(t)}</b> · ${esc(d)}</span></div>` : k === f.scanStep ? `<div class="step current">${spinner(15)}<span>${esc(t)}</span></div>` : `<div class="step todo"><span class="todo-ring"></span><span>${esc(t)}</span></div>`)).join("")}</div>${f.scanStep >= lines.length ? `<div class="stack" style="gap:8px"><span class="field-label" style="margin:0">What would you like to do first?</span><div class="row wrap">${btn("Show sources under answers", "import-go", "chip", 'data-change="citations"')}${btn("Shorter answers", "import-go", "chip", 'data-change="length"')}${btn("Just look around", "import-go", "chip", 'data-change=""')}</div></div>` : ""}`,
      f.scanStep >= lines.length ? arrowBtn("Open in workspace", "import-go", "", 'data-change=""') : "",
    );
  }
  return dialog(
    "Bring a project into Architect",
    "Keep working on something you already built. Architect reads it first and changes nothing until you ask.",
    `<div class="stack">${btn(`${icon("github", 22)}<span class="grow"><b>From GitHub</b><small>Pick a repository and branch</small></span>${icon("right", 16)}`, "import-github", "choice")}${btn(`${icon("upload", 22)}<span class="grow"><b>Upload a ZIP</b><small>A folder with your code</small></span>${icon("right", 16)}`, "import-zip-step", "choice")}${btn(`${icon("grid", 22)}<span class="grow"><b>Try the example</b><small>Northstar Support: React, team sign-in and a LangGraph agent</small></span>${icon("right", 16)}`, "import-sample", "choice")}</div>`,
  );
}
function runImportScan() {
  importFlow.step = "scan";
  importFlow.scanStep = 0;
  importDialog();
  clearInterval(importFlow.timer);
  importFlow.timer = setInterval(() => {
    if (!importFlow || !modal.open) return clearInterval(importFlow?.timer);
    importFlow.scanStep++;
    if (importFlow.scanStep >= 6) clearInterval(importFlow.timer);
    importDialog();
  }, 420);
}
function createImported(change) {
  const x = createProject("Northstar Support: an existing React app with team sign-in and a LangGraph workflow.", true);
  x.baselineFramework = "LangGraph";
  x.settings.length = "detailed";
  x.settings.citations = false;
  x.importedAt = new Date().toISOString();
  x.git = { ...x.git, repo: importFlow?.repo || "northstar/support-app", branch: importFlow?.branch || "main", connected: true, committedRevision: 1, syncedRevision: 1, auto: true, lastMessage: "Imported into Architect", lastCommit: uid().slice(0, 7) };
  x.versions = [];
  checkpoint(x, "Imported from GitHub");
  x.chat.push({ role: "assistant", kind: "text", text: `Imported ${x.git.repo}. It’s a React app with team sign-in and a LangGraph agent; all three stay as they are. The preview runs your current version.` });
  db.projects.unshift(x);
  save();
  closeModal();
  p = x;
  resetWorkspaceUi();
  ui.view = "workspace";
  setHash();
  render();
  const first = change === "citations" ? "show the sources under each answer" : change === "length" ? "make the answers shorter" : "";
  if (first) sendMessage(cap(first));
}

// ---------- Actions ----------
const act = {
  home: () => goHome(),
  open: (el) => openProject(el.dataset.id),
  close: () => closeModal(),
  "home-tab": (el) => {
    ui.homeTab = el.dataset.tab;
    render();
  },
  "pop-account": () => {
    ui.pop = ui.pop === "account" ? null : "account";
    render();
  },
  pop: (el) => {
    const next = el.dataset.pop;
    ui.pop = ui.pop === next ? null : next;
    if (ui.pop === "publish" && typeof ui.pubStep !== "number") ui.pubStep = p.releases.length && p.releases.at(-1).revision === p.revision ? "live" : null;
    ui.mention = false;
    closeModal();
    render();
  },
  signin: () => {
    pending = null;
    auth = { step: "choose", email: "", busy: "" };
    signinDialog();
  },
  "auth-provider": (el) => {
    auth.busy = el.dataset.provider;
    signinDialog();
    setTimeout(() => finishSignIn(auth.busy, "aman@demo.architect"), 900);
  },
  "auth-back": () => {
    auth.step = "choose";
    signinDialog();
  },
  "auth-demo": () => finishSignIn("Demo", "aman@demo.architect"),
  signout: () => {
    db.signedIn = false;
    db.account = null;
    save();
    ui.pop = null;
    goHome();
    toast("Signed out. Your projects stay in this browser.");
  },
  about: () => {
    ui.pop = null;
    dialog(
      "What’s real in this prototype",
      "Architect 2.0 is a working prototype. Everything runs in your browser; a few services are stand-ins.",
      `<div class="two"><div class="card tint-sage"><h3>Real</h3><ul class="trace" style="margin-top:8px"><li>Any prompt becomes a project with pages, agents, data and sample content in its subject</li><li>Chat changes the app, its agent and its code, with every version restorable</li><li>Answers, routing and number questions over your own text</li><li>Generated source as a runnable project and a real ZIP</li><li>Runs with traces, releases with rollback, and a working link for each release</li></ul></div><div class="card tint-sand"><h3>Stand-ins</h3><ul class="trace" style="margin-top:8px"><li>Sign-in providers and email links</li><li>Language models: matching is deterministic</li><li>GitHub, repository import and hosting</li><li>Other agent frameworks: files are written, not run</li></ul><p class="hint" style="margin-top:10px">Projects and releases live in this browser’s storage.</p></div></div>`,
      "",
      { wide: true },
    );
  },
  usage: () => {
    ui.pop = null;
    const n = db.projects.length;
    dialog("Usage", "This month, across your workspace.", `<div class="two"><div class="card tint-sand"><span class="eyebrow">Credits left</span><div class="display" style="font-size:40px;margin-top:6px">1,240</div><p class="hint">of 2,000 on the Team plan</p></div><div class="card tint-mist"><span class="eyebrow">Projects</span><div class="display" style="font-size:40px;margin-top:6px">${n}</div><p class="hint">${plural(db.projects.reduce((s, x) => s + (x.runs || []).length, 0), "agent run")} recorded</p></div></div>`);
  },
  "reset-demo": () => {
    ui.pop = null;
    dialog("Reset demo data?", `This removes ${plural(db.projects.length, "project")} and every release saved in this browser. It can’t be undone.`, "", btn("Keep everything", "close") + btn("Reset", "reset-confirm", "btn danger"));
  },
  "reset-confirm": () => {
    db = { projects: [], signedIn: false };
    save();
    goHome();
    toast("Demo data reset.");
  },
  templates: () => {
    ui.pop = null;
    dialog("Start from a template", "Each one builds a working app you can change by chatting.", `<div class="tpl-grid">${TEMPLATES.map(([n, d], i) => `<button type="button" class="tpl" data-action="use-template" data-i="${i}">${thumb(TPL_THEMES[i])}<span><b>${n}</b><small>${d}</small></span></button>`).join("")}</div>`, "", { wide: true });
  },
  "use-template": (el) => {
    closeModal();
    const text = TEMPLATES[+el.dataset.i][2];
    brief = text;
    if (!requireAccount({ type: "build", brief: text })) return;
    startProject(text);
  },
  consult: () => {
    ui.pop = null;
    const q = act.consult.q || (act.consult.q = { who: "My team", what: "Answer questions", about: "" });
    const chips = (key, list) => `<div class="row wrap">${list.map((x) => btn(x, "consult-pick", `chip ${q[key] === x ? "on" : ""}`, `data-key="${key}" data-val="${x}"`)).join("")}</div>`;
    dialog("Let’s find a good first app", "The best first app takes one job off someone’s plate. Three quick questions.", `<div class="stack"><span class="field-label">Who will use it?</span>${chips("who", ["My team", "Customers", "Students", "Patients"])}<span class="field-label" style="margin-top:6px">What should it do for them?</span>${chips("what", ["Answer questions", "Sort requests", "Explain our numbers"])}<label class="field-label" for="consult-about" style="margin-top:6px">What is it about?</label><input id="consult-about" placeholder="For example: leave policy, refunds, class bookings" value="${esc(q.about)}"></div>`, arrowBtn("Use this idea", "consult-use"));
  },
  "consult-pick": (el) => {
    act.consult.q[el.dataset.key] = el.dataset.val;
    act.consult.q.about = document.querySelector("#consult-about")?.value || act.consult.q.about;
    act.consult();
  },
  "consult-use": () => {
    const q = act.consult.q;
    const about = (document.querySelector("#consult-about")?.value || "").trim() || "our most common questions";
    const who = q.who === "My team" ? "my team" : q.who.toLowerCase();
    brief = q.what === "Answer questions" ? `An assistant where ${who} ask questions about ${about} and get answers with the source.` : q.what === "Sort requests" ? `An inbox where ${who} send requests about ${about}, and each one is routed to the right person with a priority.` : `A dashboard where ${who} ask about the numbers for ${about} and see the rows behind every answer.`;
    sessionStorage.setItem("architect-draft-brief", brief);
    closeModal();
    render();
    document.querySelector("#brief")?.focus();
  },
  attach: () =>
    dialog("Add context", "Screenshots, documents or links help Architect match what you have in mind. Text files become the app’s content.", `<label class="choice" style="cursor:pointer">${icon("upload", 20)}<span class="grow"><b>Upload a file</b><small>.txt, .md or .csv become the app’s data · images and PDFs are kept as references</small></span><input id="attach-file" type="file" class="sr" accept=".txt,.md,.csv,.png,.jpg,.jpeg,.pdf"></label><form id="link-form" class="stack" style="gap:8px"><label class="field-label" for="attach-link" style="margin:0">Or paste a link</label><div class="row"><input id="attach-link" type="url" placeholder="Figma, a website, or a doc" required><button class="btn" type="submit">Add</button></div></form>`),
  "attach-chat": () => act.attach(),
  "remove-attachment": (el) => {
    ui.attachments.splice(+el.dataset.i, 1);
    render();
  },
  "toggle-plan": () => {
    ui.planFirst = !ui.planFirst;
    render();
  },
  studio: () => {
    ui.pop = null;
    dialog("Use your agents", "Agents from Lyzr Studio keep their owner and settings. Architect wires them into the new app.", `<div class="stack">${STUDIO_AGENTS.map(([n, r, o]) => `<button type="button" class="choice ${ui.homeAgents.includes(n) ? "on" : ""}" data-action="toggle-studio" data-name="${n}"><span class="ag" style="width:34px;height:34px;border-radius:10px;background:var(--mist);display:inline-flex;align-items:center;justify-content:center">${icon("bot", 17)}</span><span class="grow"><b>${n}</b><small>${r} · owned by ${o}</small></span>${ui.homeAgents.includes(n) ? icon("check", 16) : ""}</button>`).join("")}</div>`, btn("Done", "close", "btn primary"));
  },
  "toggle-studio": (el) => {
    const n = el.dataset.name;
    ui.homeAgents = ui.homeAgents.includes(n) ? ui.homeAgents.filter((x) => x !== n) : [...ui.homeAgents, n];
    act.studio();
    render();
  },
  import: () => {
    ui.pop = null;
    if (!requireAccount({ type: "import" })) return;
    importFlow = { step: "choose", repo: "", branch: "main", scanStep: 0 };
    importDialog();
  },
  "import-zip": () => {
    act.import();
    if (importFlow) {
      importFlow.step = "zip";
      importDialog();
    }
  },
  "import-github": () => {
    importFlow.step = "pick";
    importFlow.repo = "northstar/support-app";
    importDialog();
  },
  "import-zip-step": () => {
    importFlow.step = "zip";
    importDialog();
  },
  "import-repo": (el) => {
    importFlow.repo = el.dataset.repo;
    importDialog();
  },
  "import-more": () => toast("GitHub would open here to grant access to more repositories."),
  "import-scan": () => {
    importFlow.branch = document.querySelector("#import-branch")?.value || "main";
    runImportScan();
  },
  "import-sample": () => {
    importFlow.repo = "northstar/support-app";
    importFlow.branch = "main";
    runImportScan();
  },
  "import-go": (el) => createImported(el.dataset.change),
  // Workspace
  tab: (el) => {
    ui.tab = el.dataset.tab;
    ui.pop = null;
    if (ui.tab !== "preview") ui.selecting = false;
    ui.mobile = "app";
    setHash();
    render();
  },
  "tab-arg": (el) => act.tab({ dataset: { tab: el.dataset.arg } }),
  mobile: (el) => {
    ui.mobile = el.dataset.k;
    render();
  },
  mode: (el) => {
    ui.mode = el.dataset.k;
    render();
    document.querySelector("#chat-input")?.focus();
  },
  suggest: (el) => sendMessage(el.dataset.text),
  mention: () => {
    ui.mention = !ui.mention;
    render();
  },
  "insert-mention": (el) => {
    ui.mention = false;
    p.unsent = `${(p.unsent || "").replace(/@$/, "")}@${el.dataset.text} `;
    render();
    const t = document.querySelector("#chat-input");
    t?.focus();
    t?.setSelectionRange(t.value.length, t.value.length);
  },
  stop: () => {
    if (!build) return;
    clearInterval(build.timer);
    const m = build.m;
    if (m.first) {
      m.paused = build.step;
      build = null;
      toast("Paused. Resume whenever you’re ready.");
    } else {
      m.cancelled = true;
      m.stoppedAt = build.step;
      m.done = false;
      delete m.ops;
      build = null;
    }
    save();
    render();
  },
  "resume-build": (el) => {
    const m = p.chat.find((x) => x.id === el.dataset.id);
    runSteps(m, 620, (x) => {
      x.stage = "built";
      m.secs = Math.max(4, Math.round((Date.now() - m.started) / 1000));
    }, m.paused || 0);
  },
  "approve-plan": (el) => {
    const m = p.chat.find((x) => x.id === el.dataset.id);
    m.awaiting = false;
    startFirstBuild();
  },
  "edit-plan": () => {
    p.chat.push({ role: "assistant", kind: "text", text: "Tell me what to change: pages, agents, sign-in or the look. You can also switch the starting point below the plan." });
    save();
    render();
    document.querySelector("#chat-input")?.focus();
  },
  "switch-start": () =>
    dialog("Change the starting point", "The engine the app is built on. Your name, look, agents and sign-in stay.", `<div class="stack">${Object.values(ARCHETYPES).map((a) => `<button type="button" class="choice ${a.id === p.archetype ? "on" : ""}" data-action="switch-to" data-id="${a.id}"><span class="grow"><b>${a.label}</b><small>${a.blurb}</small></span>${a.id === p.archetype ? icon("check", 16) : ""}</button>`).join("")}</div>`),
  "switch-to": (el) => {
    if (el.dataset.id === p.archetype) return closeModal();
    const a = ARCHETYPES[el.dataset.id];
    const res = switchArchetype(p, el.dataset.id);
    autoCommit(p, res.version.label);
    p.chat.push({ role: "assistant", kind: "build", id: uid(), intro: `Rebuilt ${p.name} as “${a.label}”.`, steps: [`Switched the engine to ${a.label}`, `Loaded ${p.sourceName}`, `Laid out ${p.pages.map((x) => x.name).join(" and ")}`, "Refreshed the preview"], files: res.files, done: true, versionN: res.version.n, versionId: res.version.id });
    ui.result = null;
    ui.page = "home";
    closeModal();
    save();
    render();
  },
  clarify: (el) => {
    const m = p.chat.find((x) => x.id === el.dataset.id);
    const o = m.options[+el.dataset.k];
    m.chosen = +el.dataset.k;
    if (o.plan) {
      ui.mode = "plan";
      p.chat.push({ role: "assistant", kind: "text", text: "Tell me more: where should it live, and what should people see or be able to do? I’ll lay out the steps before building." });
      save();
      render();
      return document.querySelector("#chat-input")?.focus();
    }
    save();
    runChange(o.ops);
  },
  "proposal-build": (el) => {
    const m = p.chat.find((x) => x.id === el.dataset.id);
    m.state = "built";
    ui.mode = "build";
    runChange(m.ops);
  },
  "proposal-skip": (el) => {
    p.chat.find((x) => x.id === el.dataset.id).state = "skipped";
    save();
    render();
  },
  restore: (el) => restore(el.dataset.id),
  "focus-chat": () => {
    ui.mobile = "chat";
    render();
    document.querySelector("#chat-input")?.focus();
  },
  // Preview
  device: (el) => {
    ui.device = el.dataset.d;
    render();
  },
  "toggle-select": () => {
    ui.selecting = !ui.selecting;
    if (!ui.selecting) ui.sel = "";
    render();
  },
  "clear-sel": () => {
    ui.sel = "";
    render();
  },
  "app-page": (el) => {
    ui.page = el.dataset.page;
    ui.result = null;
    render();
  },
  "app-refresh": () => {
    ui.q = "";
    ui.result = null;
    ui.page = "home";
    render();
  },
  "open-draft": () => window.open(`${location.pathname}?preview=${p.id}`, "_blank", "noopener"),
  "toggle-console": () => {
    ui.console = !ui.console;
    render();
  },
  "sample-question": (el) => {
    if (previewId || releaseId) {
      ui.q = el.dataset.q;
      const t = releaseId ? findRelease(releaseId) : byId(previewId);
      ui.result = answer(t, ui.q);
      ui.showSource = false;
      return render();
    }
    recordPreview(el.dataset.q);
    render();
  },
  citation: () => {
    ui.showSource = !ui.showSource;
    render();
  },
  fb: (el) => {
    ui.fb = el.dataset.v;
    render();
  },
  rerun: (el) => {
    ui.tab = "preview";
    ui.page = "home";
    recordPreview(el.dataset.input);
    render();
    toast("Ran again with the current version.");
  },
  theme: (el) => quickChange([{ type: "settings", change: { theme: el.dataset.theme } }]),
  set: (el) => {
    const v = el.dataset.val;
    if (p.settings[el.dataset.key] === v) return;
    quickChange([{ type: "settings", change: { [el.dataset.key]: v } }]);
  },
  "remove-page": (el) => {
    const pg = p.pages.find((x) => x.id === el.dataset.id);
    if (ui.page === pg.id) ui.page = "home";
    quickChange([{ type: "removePage", id: pg.id, name: pg.name }]);
  },
  // Code
  "code-file": (el) => {
    ui.codeFile = el.dataset.path;
    render();
  },
  "code-open": (el) => {
    ui.codeFile = el.dataset.path;
    ui.tab = "code";
    ui.mobile = "app";
    closeModal();
    setHash();
    render();
  },
  "copy-file": () => {
    const f = generateFiles(p).find((x) => x.path === ui.codeFile);
    if (f) copy(f.text, `Copied ${f.path}.`);
  },
  "copy-cmd": (el) => copy(el.dataset.cmd, "Copied to the clipboard."),
  "download-zip": () => {
    ui.pop = null;
    downloadBlob(new Blob([zipBytes(generateFiles(p))], { type: "application/zip" }), `${slug(p.name)}-source.zip`);
    toast("Downloaded the source. Run npm run dev inside it.");
    render();
  },
  export: () => {
    ui.pop = null;
    downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }), slug(p.name) + ".json");
    render();
  },
  // Agents
  "agent-select": (el) => {
    ui.agentSel = el.dataset.id;
    render();
  },
  "agent-tab": (el) => {
    ui.agentTab = el.dataset.k;
    render();
  },
  framework: (el) => {
    if (p.settings.framework === el.dataset.fw) return;
    quickChange([{ type: "framework", change: { framework: el.dataset.fw } }]);
  },
  "test-chip": (el) => {
    ui.testInput = el.dataset.q;
    const r = answer(p, ui.testInput);
    ui.testResult = { ...r, steps: recordRun(p, ui.testInput, r).steps };
    save();
    render();
  },
  "add-agent": () =>
    dialog("Add an agent", "Give the app a second job only when it needs one. Handoffs show in every run.", `<div class="stack">${btn(`${icon("plus", 18)}<span class="grow"><b>Create a new agent</b><small>Name it and give it one job</small></span>`, "add-agent-new", "choice")}${btn(`${icon("bot", 18)}<span class="grow"><b>Use one from Lyzr Studio</b><small>Keeps its owner and settings</small></span>`, "add-agent-studio", "choice")}${btn(`${icon("code", 18)}<span class="grow"><b>Bring your own code</b><small>Point at an entry point in any framework</small></span>`, "add-agent-custom", "choice")}</div>`),
  "add-agent-new": () =>
    dialog("Create an agent", "", `<form id="agent-form" class="stack"><div class="field"><label class="field-label" for="agent-name">Name</label><input id="agent-name" required placeholder="Summarizer"></div><div class="field"><label class="field-label" for="agent-job">Job</label><select id="agent-job">${["Summarize the answer", "Draft a reply", "Escalate to a person", "Translate the answer"].map((x) => `<option>${x}</option>`).join("")}</select></div><div class="field"><label class="field-label" for="agent-trigger">Runs</label><select id="agent-trigger">${["After the main agent answers", "When no answer is found", "On request"].map((x) => `<option>${x}</option>`).join("")}</select></div><div class="dlg-actions">${btn("Cancel", "close")}<button class="btn primary" type="submit">Add agent</button></div></form>`),
  "add-agent-studio": () =>
    dialog("Use a Studio agent", "", `<div class="stack">${STUDIO_AGENTS.map(([n, r, o]) => btn(`${icon("bot", 18)}<span class="grow"><b>${n}</b><small>${r} · owned by ${o}</small></span>`, "attach-studio", "choice", `data-name="${n}" data-job="${r}" data-owner="${o}"`)).join("")}</div>`),
  "attach-studio": (el) => {
    const e = addAgent(p, { name: el.dataset.name, responsibility: el.dataset.job, origin: `Lyzr Studio · ${el.dataset.owner}`, status: "Managed in Studio" });
    checkpoint(p, `Added ${e.name}`);
    autoCommit(p, `Added ${e.name}`);
    save();
    closeModal();
    ui.agentSel = e.id;
    render();
    toast(`${e.name} attached.`);
  },
  "add-agent-custom": () =>
    dialog("Bring your own agent", "Architect calls run(input) and shows the handoff in every run.", `<form id="custom-agent-form" class="stack"><div class="field"><label class="field-label" for="ca-name">Name</label><input id="ca-name" required placeholder="Ranker"></div><div class="field"><label class="field-label" for="ca-framework">Framework</label><input id="ca-framework" required placeholder="Semantic Kernel"></div><div class="field"><label class="field-label" for="ca-entry">Entry point</label><input id="ca-entry" required placeholder="agents/ranker.py"></div><div class="field"><label class="field-label" for="ca-job">Job</label><input id="ca-job" required placeholder="Rank candidate answers"></div><div class="dlg-actions">${btn("Cancel", "close")}<button class="btn primary" type="submit">Add agent</button></div></form>`),
  "remove-agent": (el) => {
    const name = p.agents.find((x) => x.id === el.dataset.id)?.name;
    removeAgent(p, el.dataset.id);
    checkpoint(p, `Removed ${name}`);
    autoCommit(p, `Removed ${name}`);
    save();
    ui.agentSel = "main";
    render();
    toast(`${name} removed.`);
  },
  // Data
  "connect-source": (el) =>
    dialog(`Connect ${esc(el.dataset.source)}`, "Choose what the agent can read. Access is requested before anything is read.", `<div class="field"><label class="field-label" for="source-scope">Folder, table or collection</label><input id="source-scope" placeholder="Company handbook"></div>`, btn("Cancel", "close") + btn("Connect", "save-connection", "btn primary", `data-source="${esc(el.dataset.source)}"`)),
  "save-connection": (el) => {
    p.connections = [...new Set([...(p.connections || []), el.dataset.source])];
    save();
    closeModal();
    render();
    toast(`${el.dataset.source} set up.`);
  },
  // Top bar
  settings: () => {
    ui.pop = null;
    render();
    settingsDialog();
  },
  archive: () => {
    ui.pop = null;
    dialog("Archive this project?", `${esc(p.name)} leaves Home. Its releases keep working.`, "", btn("Keep it", "close") + btn("Archive", "archive-confirm", "btn danger"));
  },
  "archive-confirm": () => {
    p.archived = true;
    save();
    goHome();
    toast("Project archived.");
  },
  "commit-push": () => {
    p.git.committedRevision = p.revision;
    p.git.syncedRevision = p.revision;
    p.git.lastMessage = p.versions.at(-1).label;
    p.git.lastCommit = uid().slice(0, 7);
    save();
    render();
    toast(`Pushed to ${p.git.branch}.`);
  },
  "open-pr": () => toast(`Opened a pull request from ${p.git.branch} (demo).`),
  branch: () =>
    dialog("Work on a branch", "New versions are committed to this branch.", `<form id="branch-form" class="stack"><label class="sr" for="new-branch">Branch</label><input id="new-branch" required value="${esc(p.git.branch)}"><div class="dlg-actions">${btn("Cancel", "close")}<button class="btn primary" type="submit">Use branch</button></div></form>`),
  "git-disconnect": () => {
    p.git.connected = false;
    save();
    render();
    toast("Disconnected from GitHub. The repository stays as it is.");
  },
  "copy-preview": () => copy(`${location.origin}${location.pathname}?preview=${p.id}`, "Preview link copied."),
  "copy-link": (el) => copy(el.dataset.link, "Link copied."),
  qr: () => dialog("Scan to open", "", `<div style="display:flex;justify-content:center;padding:10px">${qrArt()}</div><p class="hint" style="text-align:center">${esc(slug(p.name))}.architect.app</p>`),
  release: () => startPublish(),
  domain: () =>
    dialog("Add a custom domain", "Point your domain at Architect and we handle the certificate.", `<form id="domain-form" class="stack"><label class="sr" for="domain">Domain</label><input id="domain" placeholder="help.yourcompany.com" pattern="[a-z0-9.\\-]+\\.[a-z]{2,}" required><p class="hint">Then add a CNAME record pointing to <code>apps.architect.app</code>.</p><div class="dlg-actions">${btn("Cancel", "close")}<button class="btn primary" type="submit">Add domain</button></div></form>`),
  rollback: (el) => {
    const r = p.releases.find((x) => x.id === el.dataset.id);
    dialog(`Roll back to release ${r.number}?`, `Visitors get release ${r.number} again, published as a new release. Nothing is deleted.`, "", btn("Cancel", "close") + btn("Roll back", "rollback-confirm", "btn primary", `data-id="${r.id}"`));
  },
  "rollback-confirm": (el) => {
    const r = p.releases.find((x) => x.id === el.dataset.id);
    const n = rollback(p, r);
    checkpoint(p, `Rolled back to release ${r.number}`);
    save();
    closeModal();
    ui.result = null;
    ui.pubStep = "live";
    render();
    toast(`Release ${n.number} now serves what release ${r.number} did.`);
  },
  "deploy-log": (el) => {
    const r = p.releases.find((x) => x.id === el.dataset.id);
    const t = new Date(r.at);
    const line = (s, msg) => `${new Date(t.getTime() + s * 1000).toLocaleTimeString()}  ${msg}`;
    dialog(`Release ${r.number}`, `Published ${ago(r.at)}`, `<pre class="pre">${esc([line(0, `Froze version at revision ${r.revision} (${r.sourceName})`), line(1, `Access: ${r.settings.audience === "team" ? r.settings.signin || "sign-in required" : "anyone with the link"}`), line(2, `Agents: ${[A(r).agent.name, ...(r.agents || []).map((x) => x.name)].join(", ")} on ${r.settings.framework}`), line(3, `Checks: ${runChecks(r).passed} of ${runChecks(r).total} sample questions`), line(4, `Live at ${slug(r.name)}.architect.app`)].join("\n"))}</pre>`);
  },
  "recipient-login": () => {
    sessionStorage.setItem("recipient-" + releaseId, "yes");
    render();
  },
};
function qrArt() {
  let cells = "";
  let seed = [...(p?.id || "x")].reduce((s, c) => s + c.charCodeAt(0), 7);
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      seed = (seed * 9301 + 49297) % 233280;
      const on = finder ? (x % 14 === 0 || x % 14 === 6 || y % 14 === 0 || y % 14 === 6 || (x % 14 > 1 && x % 14 < 5 && y % 14 > 1 && y % 14 < 5)) : seed / 233280 > 0.52;
      if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  return `<svg width="180" height="180" viewBox="-1 -1 23 23" fill="#1F2420" role="img" aria-label="QR code">${cells}</svg>`;
}
function settingsDialog() {
  const s = p.settings;
  const me = { email: db.account?.email || "aman@demo.architect", role: "Owner" };
  const members = [me, ...(p.members || []).filter((m) => m.role !== "Owner")];
  dialog(
    "Project settings",
    esc(p.name),
    `<div class="card"><h3>General</h3><form id="rename-form" class="field" style="margin-top:12px"><label class="field-label" for="rename">Name</label><div class="row"><input id="rename" value="${esc(p.name)}" maxlength="50"><button class="btn sm" type="submit">Save</button></div></form><div class="toggle-row"><span>Who can open it</span><div class="seg sm">${[["public", "Anyone with the link"], ["team", "Signed-in people"]].map(([v, l]) => `<button type="button" data-action="set" data-key="audience" data-val="${v}" class="${s.audience === v ? "on" : ""}">${l}</button>`).join("")}</div></div><div class="toggle-row"><span>Look</span><div class="row">${Object.entries(THEMES).map(([k, th]) => `<button type="button" class="swatch ${s.theme === k ? "on" : ""}" data-action="theme" data-theme="${k}" aria-label="${th.label} theme" title="${th.label}" style="--sw:${th.accent};--sw-bg:${th.bg}"></button>`).join("")}</div></div><div class="toggle-row"><span>Starting point<small>${esc(A().label)}</small></span>${btn("Change", "switch-start", "btn sm")}</div></div>
<div class="card"><div class="row between"><h3>Environment variables</h3>${btn(`${icon("plus", 13)}Add`, "add-env", "btn sm")}</div><p class="hint" style="margin:6px 0">Names only in this prototype. Don’t paste real keys.</p>${envVars(p).map((v) => `<div class="toggle-row"><code>${esc(v.name)}</code><span class="status ${v.status === "Not set" ? "" : "live"}"><span class="dot ${v.status === "Not set" ? "amber" : "live"}"></span>${esc(v.status)}</span></div>`).join("")}</div>
<div class="card"><div class="row between"><h3>People</h3>${btn("Invite", "pop", "btn sm", 'data-pop="share"')}</div>${members.map((m) => `<div class="toggle-row"><span>${esc(m.email)}${m.status ? `<small>${esc(m.status)}</small>` : ""}</span><span class="small muted">${esc(m.role)}</span></div>`).join("")}</div>
<div class="card"><h3>Export</h3><div class="row wrap" style="margin-top:10px">${btn(`${icon("download", 13)}Source (.zip)`, "download-zip", "btn sm")}${btn(`${icon("file", 13)}Project (.json)`, "export", "btn sm")}</div></div>
<div class="card"><div class="row between"><div><h3>Archive</h3><p class="hint">Hides it from Home. Releases keep working.</p></div>${btn("Archive", "archive", "btn danger sm")}</div></div>`,
    "",
    { wide: true, kind: "settings" },
  );
}
act["add-env"] = () =>
  dialog("Add an environment variable", "", `<form id="env-form" class="stack"><label class="sr" for="env-name">Name</label><input id="env-name" required placeholder="OPENAI_API_KEY"><p class="hint">Only the name is saved in this prototype.</p><div class="dlg-actions">${btn("Cancel", "settings")}<button class="btn primary" type="submit">Add</button></div></form>`);

// ---------- Events ----------
document.addEventListener("click", (e) => {
  // Select to edit: clicks inside the app pick an element instead of using it
  if (ui.selecting && p && !releaseId && !previewId) {
    const inApp = e.target.closest("#viewport .appview");
    if (inApp && !e.target.closest(".inspector")) {
      e.preventDefault();
      const el = e.target.closest("[data-el]");
      ui.sel = el ? el.dataset.el : "";
      ui.pop = null;
      render();
      return;
    }
  }
  const t = e.target.closest("[data-action]");
  if (ui.pop && !e.target.closest(".pop") && !(t && ["pop", "pop-account"].includes(t.dataset.action))) {
    ui.pop = null;
    if (!t) return render();
  }
  if (ui.mention && !e.target.closest(".mention") && !(t && t.dataset.action === "mention")) {
    ui.mention = false;
    if (!t) return render();
  }
  if (t && !t.disabled) {
    if (t.tagName !== "INPUT") e.preventDefault();
    act[t.dataset.action]?.(t, e);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (modal.open) return;
    if (ui.pop || ui.mention || ui.sel) {
      ui.pop = null;
      ui.mention = false;
      ui.sel = "";
      render();
    } else if (ui.selecting) {
      ui.selecting = false;
      render();
    }
  }
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && ["chat-input", "brief"].includes(e.target.id)) {
    e.preventDefault();
    e.target.form?.requestSubmit();
  }
});
const onChange = {
  setting: (el) => quickChange([{ type: "settings", change: { [el.dataset.key]: el.checked } }]),
  tool: (el) => {
    const tools = new Set(p.tools || ["read_source"]);
    el.checked ? tools.add(el.dataset.id) : tools.delete(el.dataset.id);
    quickChange([{ type: "tools", tools: [...tools] }], `${el.checked ? "Allowed" : "Turned off"}: ${TOOLS.find((x) => x[0] === el.dataset.id)[1].toLowerCase()}`);
  },
  model: (el) => quickChange([{ type: "framework", change: { model: el.value } }]),
  "git-auto": (el) => {
    p.git.auto = el.checked;
    if (el.checked) autoCommit(p, p.versions.at(-1).label);
    save();
    render();
  },
  "builder-model": (el) => (ui.model = el.value),
  noop: () => {},
};
document.addEventListener("change", async (e) => {
  const t = e.target.closest("[data-change]");
  if (t) return onChange[t.dataset.change]?.(t, e);
  if (e.target.id === "zip-file") {
    const file = e.target.files[0];
    if (!file) return;
    importFlow.archive = { name: file.name, size: file.size };
    importFlow.repo = "northstar/support-app";
    runImportScan();
  }
  if (e.target.id === "attach-file") {
    const file = e.target.files[0];
    if (!file) return;
    const isText = /\.(txt|md|csv)$/i.test(file.name);
    if (isText && file.size > 100000) return toast("Use a text file under 100 KB.");
    const text = isText ? await file.text() : "";
    if (ui.view === "workspace" && p) {
      closeModal();
      if (text) {
        recordSource(p, text.trim(), file.name.replace(/\.[^.]+$/, ""));
        checkpoint(p, `Loaded ${file.name}`);
        p.chat.push({ role: "user", text: `Attached ${file.name}` }, { role: "assistant", kind: "text", text: `${A().agent.name} now answers from ${file.name}. Check the sample questions in Data.`, action: { label: "Open Data", do: "tab-arg", arg: "data" } });
      } else p.chat.push({ role: "user", text: `Attached ${file.name}` }, { role: "assistant", kind: "text", text: `Kept ${file.name} as a reference for this project. Tell me what to take from it.` });
      save();
      return render();
    }
    ui.attachments.push({ name: file.name, kind: "file", text });
    closeModal();
    render();
  }
  if (e.target.id === "source-file") {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100000) return toast("Use a text file under 100 KB.");
    document.querySelector("#source-text").value = await file.text();
    document.querySelector("#source-name").value = file.name.replace(/\.[^.]+$/, "");
    toast("Loaded. Review it, then save.");
  }
});
document.addEventListener("submit", (e) => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement)) return;
  e.preventDefault();
  const val = (id) => document.querySelector(id)?.value.trim() ?? "";
  if (f.id === "home-form") {
    brief = val("#brief");
    sessionStorage.setItem("architect-draft-brief", brief);
    if (!brief) {
      document.querySelector("#brief")?.focus();
      return toast("Describe what you want to build first.");
    }
    if (!requireAccount({ type: "build", brief })) return;
    return startProject(brief);
  }
  if (f.id === "email-form") {
    auth.email = val("#email");
    auth.step = "sent";
    return signinDialog();
  }
  if (f.id === "code-form") return finishSignIn("Email", auth.email);
  if (f.id === "link-form") {
    const url = val("#attach-link");
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {}
    if (ui.view === "workspace" && p) {
      closeModal();
      (p.references ||= []).push({ name: host, kind: "link" });
      p.chat.push({ role: "user", text: `Reference: ${url}` }, { role: "assistant", kind: "text", text: `Added ${host} as a reference. Tell me what to take from it: the layout, the colours or the copy.` });
      save();
      return render();
    }
    ui.attachments.push({ name: host, kind: "link" });
    closeModal();
    return render();
  }
  if (f.id === "chat-form") {
    const text = val("#chat-input");
    if (!text || build) return;
    return sendMessage(text);
  }
  if (f.id === "question-form") {
    const q = val("#question");
    if (!q) return;
    if (releaseId || previewId) {
      const t = releaseId ? findRelease(releaseId) : byId(previewId);
      ui.q = q;
      ui.result = answer(t, q);
      return render();
    }
    recordPreview(q);
    return render();
  }
  if (f.id === "app-contact") return toast("Message sent.");
  if (f.id === "ins-name" || f.id === "rename-form") {
    const name = val(f.id === "ins-name" ? "#ins-name-input" : "#rename");
    if (!name || name === p.name) return;
    ui.pop = null;
    closeModal();
    return quickChange([{ type: "rename", name }]);
  }
  if (f.id === "ins-hero") {
    const ops = [];
    if (val("#ins-h2") && val("#ins-h2") !== p.copy.h2) ops.push({ type: "copy", field: "h2", value: val("#ins-h2") });
    if (val("#ins-intro") && val("#ins-intro") !== p.copy.intro) ops.push({ type: "copy", field: "intro", value: val("#ins-intro") });
    return ops.length && quickChange(ops, "Updated the text");
  }
  if (f.id === "ins-form") {
    const ops = [];
    if (val("#ins-ph") && val("#ins-ph") !== p.copy.placeholder) ops.push({ type: "copy", field: "placeholder", value: val("#ins-ph") });
    if (val("#ins-btn") && val("#ins-btn") !== p.copy.button) ops.push({ type: "copy", field: "button", value: val("#ins-btn") });
    return ops.length && quickChange(ops, "Updated the form");
  }
  if (f.id === "ins-page") {
    const name = val("#ins-page-name");
    if (!name) return;
    const page = { id: slug(name) + "-" + uid().slice(0, 4), name: cap(name), kind: pageKind(name) };
    ui.page = page.id;
    return quickChange([{ type: "page", page }]);
  }
  if (f.id === "instructions-form") {
    const v = val("#instructions");
    if (!v || v === p.instructions) return toast("No changes to save.");
    return quickChange([{ type: "instructionsSet", value: v }], "Instructions saved");
  }
  if (f.id === "custom-entry") return quickChange([{ type: "framework", change: { customFramework: val("#entry") } }], "Entry point saved");
  if (f.id === "test-form") {
    ui.testInput = val("#test-input");
    if (!ui.testInput) return;
    const r = answer(p, ui.testInput);
    ui.testResult = { ...r, steps: recordRun(p, ui.testInput, r).steps };
    save();
    return render();
  }
  if (f.id === "source-form") {
    const text = val("#source-text"),
      name = val("#source-name");
    if (!text || !name) return toast("Add a name and some content.");
    recordSource(p, text, name);
    const v = checkpoint(p, `Updated ${name}`);
    autoCommit(p, v.label);
    ui.result = null;
    save();
    render();
    return toast(`Saved. ${A().agent.name} now answers from ${name} · version ${v.n}`);
  }
  if (f.id === "git-form") {
    const repo = val("#git-repo");
    ui.gitStep = "auth";
    render();
    setTimeout(() => {
      ui.gitStep = null;
      Object.assign(p.git, { connected: true, repo, branch: p.git.branch || "main", auto: true });
      autoCommit(p, "Initial commit from Architect");
      save();
      render();
      toast(`Connected. Every version now lands in ${repo}.`);
    }, 1100);
    return;
  }
  if (f.id === "branch-form") {
    p.git.branch = val("#new-branch");
    save();
    closeModal();
    return render();
  }
  if (f.id === "invite-form") {
    p.members ||= [];
    p.members.push({ email: val("#invite-email"), role: document.querySelector("#invite-role").value, status: "Invited" });
    save();
    render();
    return toast("Invite sent.");
  }
  if (f.id === "domain-form") {
    p.customDomain = { name: val("#domain").toLowerCase(), status: "pending" };
    save();
    closeModal();
    render();
    toast("Domain added. Checking DNS…");
    setTimeout(() => {
      if (!p?.customDomain) return;
      p.customDomain.status = "verified";
      save();
      render();
      toast(`${p.customDomain.name} is verified.`);
    }, 2200);
    return;
  }
  if (f.id === "env-form") {
    const name = addEnv(p, val("#env-name"));
    if (!name) return toast("Use a new variable name.");
    save();
    settingsDialog();
    return toast(`${name} added.`);
  }
  if (f.id === "agent-form" || f.id === "custom-agent-form") {
    const custom = f.id === "custom-agent-form";
    const e2 = addAgent(p, custom ? { name: val("#ca-name"), responsibility: val("#ca-job"), origin: `Custom · ${val("#ca-framework")}`, entry: val("#ca-entry"), status: "Not verified" } : { name: val("#agent-name"), responsibility: document.querySelector("#agent-job").value, trigger: document.querySelector("#agent-trigger").value });
    checkpoint(p, `Added ${e2.name}`);
    autoCommit(p, `Added ${e2.name}`);
    save();
    closeModal();
    ui.agentSel = e2.id;
    render();
    return toast(`${e2.name} added.`);
  }
});
function bind() {
  document.querySelector("#brief")?.addEventListener("input", (e) => {
    brief = e.target.value;
    sessionStorage.setItem("architect-draft-brief", brief);
    grow(e.target);
  });
  const ci = document.querySelector("#chat-input");
  ci?.addEventListener("input", (e) => {
    p.unsent = e.target.value;
    if (e.target.value.endsWith("@") && !ui.mention) {
      ui.mention = true;
      render();
    }
    grow(e.target);
  });
  document.querySelector("#msgs")?.addEventListener("scroll", (e) => {
    const m = e.target;
    ui.stick = m.scrollHeight - m.scrollTop - m.clientHeight < 40;
  });
  for (const t of document.querySelectorAll("#brief, #chat-input")) grow(t);
}
const regrow = () => {
  for (const t of document.querySelectorAll("#brief, #chat-input")) grow(t);
  placeInspector();
};
window.addEventListener("load", regrow);
document.fonts?.ready.then(regrow);
function grow(t) {
  const max = t.id === "brief" ? 220 : 180;
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight, max) + "px";
  t.style.overflowY = t.scrollHeight > max ? "auto" : "hidden";
}
window.addEventListener("resize", regrow);
window.addEventListener("beforeunload", () => save());

window.addEventListener("hashchange", () => {
  const [id, tab] = location.hash.slice(1).split("/");
  if (!id) return ui.view === "workspace" && goHome();
  if (!db.signedIn || !byId(id)) return;
  if (p?.id !== id || ui.view !== "workspace") openProject(id, ["preview", "code", "agents", "data"].includes(tab) ? tab : "preview");
  else if (tab && tab !== ui.tab && ["preview", "code", "agents", "data"].includes(tab)) {
    ui.tab = tab;
    render();
  }
});

// ---------- Boot ----------
const hash = location.hash.slice(1).split("/");
if (hash[0] && byId(hash[0]) && db.signedIn) {
  p = byId(hash[0]);
  resetWorkspaceUi();
  ui.view = "workspace";
  ui.tab = ["preview", "code", "agents", "data"].includes(hash[1]) ? hash[1] : "preview";
  // A build interrupted by a reload finishes as built.
  for (const m of p.chat)
    if (m.kind === "build" && !m.done && !m.cancelled && m.paused == null) {
      if (m.first) (m.done = true), (p.stage = "built");
      else (m.cancelled = true), (m.stoppedAt = 0), delete m.ops;
    }
}
render();
