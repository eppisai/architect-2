import {
  STORE,
  clone,
  createProject,
  settingsChange,
  undo,
  answer,
  publish,
  recordSource,
  pendingChanges,
  ARCHETYPES,
  archetypeOf,
  interpret,
  subjectFor,
  describe,
  slug,
  chatIntent,
  recordRun,
  envVars,
  frameworkSetup,
  generateFiles,
  changedAreas,
  rollback,
  addAgent,
  removeAgent,
  TOOLS,
  setTools,
  addEnv,
} from "./model.mjs";
import { zipBytes } from "./zip.mjs";
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let db;
try {
  db = JSON.parse(localStorage.getItem(STORE));
} catch {}
if (!db?.projects) db = { projects: [], signedIn: false };
if (db.signedIn && !db.account)
  db.account = { name: "Aman", email: "aman@demo.architect", method: "Demo" };
for (const x of db.projects) {
  x.archetype ||= "knowledge";
  for (const r of x.releases || []) r.archetype ||= x.archetype;
}
let p = null,
  view = "home",
  selection = "",
  chatOpen = false,
  proposal = null,
  buildStep = 0,
  buildTimer,
  previewQuestion = "",
  previewResult = null,
  showSource = false,
  shape = null,
  readStep = 0,
  readTimer,
  auth = { step: "choose", provider: "", email: "" },
  pending = null,
  codeFile = "",
  importFlow = null,
  publishStep = 0,
  publishTimer,
  agentSel = "main",
  testResult = null,
  testInput = "";
let brief =
  sessionStorage.getItem("architect-draft-brief") ||
  "My team repeatedly asks questions about our internal policies. Build an app where they can ask a question, get an answer from our handbook, and see the source.";
const params = new URLSearchParams(location.search),
  releaseId = params.get("release");
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(db));
  } catch {
    toast("Storage is full. Export your project before leaving.");
  }
};
const byId = (id) => db.projects.find((x) => x.id === id);
const tag = (t, kind = "") => `<span class="tag ${kind}">${esc(t)}</span>`;
const btn = (t, a, cls = "", extra = "") =>
  `<button class="${cls}" data-action="${a}" ${extra}>${t}</button>`;
const A = (x = p) => archetypeOf(x);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const people = (s) => (s.audience === "team" ? "teammates" : "customers");
const when = (iso) => new Date(iso).toLocaleString();
const appUrl = (x = p) => `https://${slug(x.name)}.architect.app`;
const recipientUrl = (r) => `${location.origin}${location.pathname}?release=${r.id}`;
const EXAMPLES = [
  [
    "Policy assistant",
    "Turn your handbook into answers people can verify.",
    "Build an internal policy assistant that answers from our handbook and shows the source.",
  ],
  [
    "Support triage",
    "Sort incoming requests to the right team with a first reply.",
    "Build a support triage app where customers describe a request, it gets routed to billing, access or engineering, and they can track it.",
  ],
  [
    "Sales insights",
    "Ask questions about a sales table and see the rows behind each answer.",
    "Build a sales dashboard where my team can ask which region grew the most and see the numbers behind it.",
  ],
];
const IMPORT_BRIEF =
  "Northstar Support: an existing React app with team sign-in and a LangGraph workflow, imported from northstar/support-app.";
function toast(t) {
  const el = document.querySelector("#toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.style.display = "none"), 4000);
}
function dialog(title, body, actions = "") {
  modal.innerHTML = `<div class="row between"><h2>${title}</h2>${btn("×", "close", "quiet", 'aria-label="Close dialog"')}</div>${body}${actions === null ? "" : `<div class="actions">${actions || btn("Close", "close")}</div>`}`;
  if (!modal.open) modal.showModal();
}
function summary(s) {
  return describe({ settings: s, archetype: p.archetype });
}
function nav(to) {
  view = to;
  proposal = null;
  selection = "";
  previewResult = null;
  showSource = false;
  chatOpen = false;
  testResult = null;
  render();
  window.scrollTo({ top: 0 });
  if (p) history.replaceState(null, "", `#${p.id}/${view}`);
}
function openProject(id, to) {
  proposal = null;
  previewQuestion = "";
  showSource = false;
  chatOpen = false;
  agentSel = "main";
  testResult = null;
  clearInterval(buildTimer);
  p = byId(id);
  selection = "";
  previewResult = null;
  view = to || (p.stage === "built" ? "app" : "plan");
  history.replaceState(null, "", `#${p.id}/${view}`);
  render();
  window.scrollTo({ top: 0 });
}
function protoTag() {
  return btn("Prototype · what works?", "about", "proto-tag");
}
function accountControl() {
  return db.signedIn
    ? btn(
        (db.account?.name || "AM").slice(0, 2).toUpperCase(),
        "account",
        "account-icon",
        'aria-label="Account menu" title="Account"',
      )
    : btn("Sign in", "signin", "small");
}
function top() {
  const inProject = p && !["home", "signin", "reading", "shape"].includes(view);
  return `<header class="top"><div class="row">${btn('<span class="brand"><span class="brandmark">A</span>architect</span>', "home", "quiet")}${inProject ? `<span class="muted">/</span><strong class="project-title">${esc(p.name)}</strong>` : ""}</div><div class="row">${inProject ? `${tag(p.releases.length ? (p.releases.at(-1).revision === p.revision ? "Published snapshot" : "Unpublished changes") : "Draft", "blue")}${btn("Conversation", "toggle-chat", "small mobilechat")}${btn(p.stage === "built" ? "Publish" : "Build this version", p.stage === "built" ? "publish" : "build", "primary small", ["building", "publishing"].includes(view) ? "disabled" : "")}` : ""}${protoTag()}${accountControl()}</div></header>`;
}
function projectCard(x) {
  const last = x.changes.at(-1);
  return `<div class="project-card"><div><div class="row wrap"><h3 style="margin:0">${esc(x.name)}</h3>${x.releases.length ? tag("Live", "good") : tag("Draft")}</div><small>${x.imported ? "Imported · " : `${A(x).label} · `}${x.stage === "built" ? "Preview ready" : "Plan in progress"} · v${x.revision}<br>Last: ${esc(last ? last.reason : "Created")} · ${when(last ? last.at : x.createdAt)}</small></div>${btn("Continue", "open", "small", `data-id="${x.id}"`)}</div>`;
}
function home() {
  const projects = db.projects.filter((x) => !x.archived);
  return `${top()}<main class="welcome"><span class="tag blue">Your ideas, made useful</span><h1 style="margin-top:18px">What would you like<br>to build or improve?</h1><p class="muted">Start with what people need. We’ll shape the app, its agents, and how everything works together.</p><div class="promptbox"><label for="brief" class="sr">Describe your app</label><textarea id="brief">${esc(brief)}</textarea><div class="row between wrap"><div class="row">${btn("+ Reference", "reference", "quiet small")}${tag("Example brief")}</div>${btn("Shape this idea ↗", "start", "primary")}</div></div><div class="examples">${btn("↥ Import a project", "import")}${btn("Explore examples", "examples", "quiet")}${btn("Help me choose", "consult", "quiet")}</div><p class="footer-note">Your brief is read into one of three starting patterns you can change. No model is called in this prototype.</p>${
    db.signedIn
      ? projects.length
        ? `<section class="projects"><div class="row between"><h3>Your projects</h3><small>Saved on this browser</small></div>${projects.map(projectCard).join("")}</section>`
        : ""
      : `<section class="projects"><div class="panel row between wrap"><div><strong>Have projects here already?</strong><p class="muted" style="margin:4px 0 0">Sign in to see and continue them.</p></div>${btn("Sign in", "signin", "small")}</div></section>`
  }</main>`;
}
function signin() {
  const s = auth.step;
  const card =
    s === "email"
      ? `<h3>Continue with email</h3><form id="email-form"><label for="email">Work email</label><input id="email" type="email" required placeholder="you@company.com" value="${esc(auth.email || "")}" style="width:100%"><div class="row between" style="margin-top:16px">${btn("Back", "auth-choose", "quiet small")}<button class="primary">Send sign-in link</button></div></form><p class="footer-note">Demo account. No email is sent.</p>`
      : s === "sent"
        ? `<h3>Check your inbox</h3><p>We sent a sign-in link to <strong>${esc(auth.email)}</strong>. It expires in 15 minutes.</p><div class="row wrap">${btn("Resend link", "auth-resend", "small")}${btn("Use a different email", "auth-email", "quiet small")}</div><div class="callout">Demo: no email can arrive here. Enter the demo code instead.</div><form id="code-form"><label for="code">Demo code</label><input id="code" value="ARCHITECT" style="width:100%"><div class="row between" style="margin-top:16px">${btn("Back", "auth-choose", "quiet small")}<button class="primary">Continue</button></div></form>`
        : s === "provider"
          ? `<h3>Choose an account</h3><p class="muted">${esc(auth.provider)} · simulated account chooser</p><div class="stack">${btn("<strong>Aman</strong><br><small>aman@demo.architect</small>", "auth-account", "", 'data-email="aman@demo.architect" style="text-align:left"')}${btn("Use another account", "auth-account", "quiet", 'data-email="you@demo.architect"')}</div><div class="row between" style="margin-top:16px">${btn("Cancel", "auth-choose", "quiet small")}<small>Nothing is sent to ${esc(auth.provider)}.</small></div>`
          : `<h3>Continue to Architect</h3><div class="stack">${btn("Continue with Google", "auth-provider", "", 'data-provider="Google"')}${btn("Continue with GitHub", "auth-provider", "", 'data-provider="GitHub"')}${btn("Continue with email", "auth-email")}</div><div class="or"><span>or</span></div>${btn("Try the demo workspace", "auth-demo", "primary")}<p class="footer-note">Demo account: no password, nothing sent. Sign-in for the apps you build is configured separately, per app.</p>`;
  return `${top()}<main class="signin"><div class="two-col"><div><span class="tag blue">Architect</span><h1 style="margin-top:16px">Build an app that does a job.</h1><p class="muted" style="font-size:17px">Describe what people need. Architect shapes the app, its agents and how everything connects, then helps you ship it.</p><div class="panel"><small>Example</small><p style="margin:6px 0 0">“My team asks about leave policy every week.” → <strong>Policy Desk</strong>: ask a question, get an answer, check the source.</p></div>${pending ? `<div class="callout">Your ${pending.action === "import" ? "import" : "idea"} is saved and continues after you sign in.</div>` : ""}</div><div class="panel">${card}</div></div></main>`;
}
function reading() {
  const lines = [
    [
      "Understanding what people need",
      "Reading your brief for who it serves and what they do",
    ],
    ["Choosing a starting pattern", "Matching it to a proven app shape"],
    ["Drafting the steps", "Writing a first version you can shape"],
  ];
  return `${top()}<main class="welcome"><div class="panel" style="max-width:640px;margin:auto"><span class="tag blue">Reading your idea</span><h2 style="margin-top:20px">One moment.</h2><p class="muted">“${esc(shape.brief.slice(0, 180))}${shape.brief.length > 180 ? "…" : ""}”</p><ol class="progress-list">${lines.map(([t, d], i) => `<li class="${i < readStep ? "done" : i === readStep ? "current" : ""}"><span class="progress-icon">${i < readStep ? "✓" : i + 1}</span><div><strong>${t}</strong><small>${d}</small></div></li>`).join("")}</ol><div class="row between"><small>Deterministic interpretation · no model call</small>${btn("Skip", "shape-now", "quiet small")}</div></div></main>`;
}
function shapeView() {
  const read = interpret(shape.brief);
  const chosen = ARCHETYPES[shape.archetype];
  return `${top()}<main class="shape"><div class="row between wrap"><span class="tag blue">${read.confident ? "Closest starting pattern" : "No clear match yet · pick a pattern"}</span>${btn("← Edit brief", "home", "quiet small")}</div><h1 style="margin-top:16px">Here’s how I’d start.</h1><p class="muted">“${esc(shape.brief)}”</p><div class="pattern-grid">${Object.values(
    ARCHETYPES,
  )
    .map(
      (a) =>
        `<section class="pattern-card ${a.id === shape.archetype ? "selected" : ""}"><div class="row between"><h3>${a.label}</h3>${a.id === read.archetype && read.confident ? tag("Closest match", "blue") : ""}</div><p>${a.blurb}</p><ol class="steps">${a.steps.map((s) => `<li>${s}</li>`).join("")}</ol>${a.id === shape.archetype ? tag("Selected", "good") : btn("Use this pattern", "pick-pattern", "small", `data-archetype="${a.id}"`)}</section>`,
    )
    .join(
      "",
    )}</div><form id="shape-form" class="panel"><div class="settings-grid"><div><label for="shape-name">App name</label><input id="shape-name" required maxlength="50" value="${esc(shape.name)}"></div><div><label for="shape-audience">Who is it for?</label><select id="shape-audience"><option value="team" ${shape.audience === "team" ? "selected" : ""}>Invited teammates · sign-in required</option><option value="public" ${shape.audience === "public" ? "selected" : ""}>Anyone with the link</option></select></div></div><div class="listrow" style="margin-top:14px"><div><strong>What it will know</strong><p>${chosen.source.name} to start. Replace it with your own ${chosen.source.label.toLowerCase()} once the plan opens.</p></div>${tag("Sample content")}</div><div class="listrow"><div><strong>Agent</strong><p>${chosen.agent.name}: ${chosen.agent.does}</p></div>${tag("Lyzr managed", "blue")}</div><div class="row between wrap" style="margin-top:20px"><small>You can change any of this later.</small><button class="primary">Create the plan</button></div></form></main>`;
}
const sections = [
  [
    "Build",
    [
      ["plan", "◇", "Plan"],
      ["app", "▣", "App"],
      ["agents", "⌘", "Agents"],
      ["data", "▤", "Knowledge"],
    ],
  ],
  [
    "Developer",
    [
      ["code", "{}", "Code"],
      ["runs", "≡", "Runs"],
      ["review", "⑂", "Changes"],
    ],
  ],
  [
    "Ship",
    [
      ["deploy", "↗", "Deploy"],
      ["activity", "◷", "Activity"],
    ],
  ],
];
function side() {
  return `<nav class="sidebar" aria-label="Project navigation">${sections.map(([label, items]) => `<small class="navsection">${label}</small>${items.map(([v, i, t]) => btn(`<span class="navicon">${i}</span>${t}`, "nav", v === view ? "active" : "", `data-view="${v}" ${v === view ? 'aria-current="page"' : ""}`)).join("")}`).join("")}<div class="spacer"></div>${btn('<span class="navicon">⚙</span>Project settings', "nav", "secondary", `data-view="settings"`)}${btn('<span class="navicon">←</span>All projects', "home", "secondary")}</nav>`;
}
function chat() {
  const a = A(),
    s = p.settings;
  return `<aside class="chat ${chatOpen ? "visible" : ""}" aria-label="Project conversation"><div class="chat-head row between"><h3>Build together</h3>${btn("Close", "toggle-chat", "small mobilechat")}</div><div class="messages">${p.chat
    .slice(-8)
    .map(
      (m) =>
        `<div class="message ${m.role}"><small>${m.role === "user" ? "You" : "Architect"}</small>${esc(m.text)}</div>`,
    )
    .join(
      "",
    )}${proposal ? `<div class="pending"><strong>Proposed change</strong><p>${esc(summary({ ...s, ...proposal }))}</p>${btn("Review change", "review-proposal", "small")}</div>` : ""}</div><form class="chat-form" id="chat-form">${selection ? `<div class="context">Selected: ${esc(stepTitle(selection))} ${btn("×", "clear-select", "quiet small", 'aria-label="Clear selection"')}</div>` : ""}<div class="chips"><small>Try an example change</small><div class="row wrap" style="margin-top:7px">${btn(s.length === "short" ? "More detail" : "Less detail", "suggest-short", "chip")}${btn(cap(a.bits.unknown[s.unknown === "ask" ? "explain" : "ask"]), "suggest-ask", "chip")}${!s.citations ? btn(a.settings.citations, "suggest-citations", "chip") : ""}</div></div><label class="sr" for="chat-input">Describe a change</label><textarea id="chat-input" placeholder="Describe a change, e.g. “shorter answers and show sources”">${esc(p.unsent || "")}</textarea><div class="row between"><small>Changes are reviewed before they apply</small><button class="primary small" type="submit" aria-label="Send change request">↑</button></div></form></aside>`;
}
const slots = ["Question", "Answer", "Source"];
const stepTitle = (slot) => A().steps[slots.indexOf(slot)] || slot;
function plan() {
  const a = A(),
    s = p.settings,
    who = people(s),
    sample = a.chips[0][1],
    res = answer(p, sample);
  return `<div class="canvas-head"><div class="row between"><span class="tag blue">${p.imported ? "Imported project" : "Your first version"}</span>${btn("Undo last settings change", "undo", "quiet small", p.history.length ? "" : "disabled")}</div><h2 style="margin-top:16px">${a.headline}</h2><p>${a.promise(who, a.material)}</p><details style="margin-top:8px;padding:10px 0"><summary>${p.imported ? "Import notes" : "Your original idea"}</summary><p>${p.imported ? `Imported from <code>${esc(p.git.repo)}</code>: React app, team sign-in and a ${esc(p.baselineFramework || "LangGraph")} workflow. Baseline behavior: detailed answers, no source links.` : esc(p.brief)}</p></details></div><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">The experience, step by step</h3><small>Select a step to shape it</small></div><div class="plan-flow">${flowCard("Question", "1", a.steps[0], `<h4>${esc(p.name)}</h4><p>${a.app.h2}</p><div class="mini-input">${esc(sample)}</div><span class="mini-action">${a.app.button}</span>`, a.foot1(who))}${flowCard("Answer", "2", a.steps[1], `<div class="mini-answer">${res.team ? `<div class="mini-status">${esc(res.team)} · ${esc(res.priority)} priority</div>` : ""}${esc(res.text)}${s.citations && res.citation ? `<span class="mini-link">↗ ${esc(a.evidenceLabel(res))}</span>` : ""}</div><p style="margin:10px 0 0">${cap(a.bits.unknown[s.unknown])}.</p>`, a.foot2[s.length])}${flowCard("Source", "3", a.steps[2], `${a.id === "triage" ? `<div class="mini-status">Received ✓ · Sorted${res.team ? " to " + esc(res.team) : ""} ✓ · Reply drafted</div>` : ""}<h4>${s.citations ? a.app.evidence : a.app.evidenceOff}</h4><p class="source-quote" style="white-space:pre-line">${esc(res.citation || "No supporting detail is displayed for this answer.")}</p><span class="mini-link">${s.citations ? a.app.inspect : "Select to change this"}</span>`, a.foot3[s.citations])}</div>${selection ? editor() : ""}<div class="decision-row"><div class="decision"><div class="row between"><h4>Who is this for?</h4>${btn("Change", "access", "quiet small")}</div><p>${s.audience === "team" ? "Your team · sign-in required" : "Anyone with the link · no sign-in"}.</p></div><div class="decision"><div class="row between"><h4>What will it know?</h4>${btn("Manage", "nav", "quiet small", 'data-view="data"')}</div><p>${esc(p.sourceName)} · ${p.sourceKind === "sample" ? "example data" : "local text"}.</p></div></div>${p.imported ? `<div class="callout">Original import: React, team sign-in and ${esc(p.baselineFramework || "LangGraph")}. Current agent framework: ${esc(s.framework)}. Setup changes are recorded in Changes.</div>` : ""}<details><summary>Agent, framework and technical details</summary><p>One ${a.agent.name} ${a.agent.does.charAt(0).toLowerCase() + a.agent.does.slice(1)}${(p.agents || []).length ? ` Then ${p.agents.map((x) => `${esc(x.name)} (${esc(x.responsibility.toLowerCase())})`).join(", ")}.` : ""} Current setup: <strong>${esc(s.framework)}</strong> · ${esc(frameworkSetup(p).status)}.</p><div class="row wrap">${btn("Open agent setup", "nav", "small", 'data-view="agents"')}${btn("View generated code", "nav", "small", 'data-view="code"')}</div></details><div class="build-footer"><div><strong>You can change this as you go.</strong><p class="muted" style="font-size:13px;margin:5px 0">Example content is ready. Live integrations can be connected later.</p></div>${btn(p.stage === "built" ? "Try this version" : "Build this version", p.stage === "built" ? "preview" : "build", "primary")}</div>`;
}
function flowCard(target, n, title, visual, foot) {
  return `<section class="flow-card ${selection === target ? "selected" : ""}"><button data-action="select" data-target="${target}" aria-pressed="${selection === target}"><span class="stepnum">${n} / 3</span>${esc(title)} <span style="float:right;color:#8194ae">↗</span></button><div class="mini">${visual}</div><div class="flow-foot">${foot}</div></section>`;
}
function editor() {
  const a = A(),
    s = p.settings,
    L = a.settings;
  if (selection === "Question")
    return `<section class="editor"><div class="editor-top"><div><h3>Make the first impression yours</h3><p class="muted">The app name carries into preview and future releases.</p></div>${btn("Close", "clear-select", "quiet small")}</div><form id="name-form"><label for="project-name">App name</label><input id="project-name" required maxlength="50" value="${esc(p.name)}"> <button class="primary small">Save name</button></form></section>`;
  if (selection === "Source")
    return `<section class="editor"><div class="editor-top"><h3>Show what the answer is based on</h3>${btn("Close", "clear-select", "quiet small")}</div><p>${a.app.evidence} appears next to each result when enabled. Current source: ${esc(p.sourceName)}.</p>${btn("Edit behavior and evidence", "select", "small", 'data-target="Answer"')} ${btn("Open knowledge", "nav", "small", 'data-view="data"')}</section>`;
  const select = (id, def) =>
    `<select id="${id}">${def.options.map(([v, l]) => `<option value="${v}" ${s[id] === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  return `<section class="editor"><div class="editor-top"><div><h3>How should ${a.steps[1].toLowerCase()} behave?</h3><p class="muted" style="font-size:13px">Powered by your ${a.agent.name}. Changes apply across the plan, app, agent and generated code.</p></div>${btn("Close", "clear-select", "quiet small")}</div><form id="behavior-form"><div class="settings-grid"><div><label for="length">${L.length.label}</label>${select("length", L.length)}</div><div><label for="unknown">${L.unknown.label}</label>${select("unknown", L.unknown)}</div></div><label class="checkrow"><input type="checkbox" id="citations" ${s.citations ? "checked" : ""}> ${L.citations}</label><div class="row between" style="margin-top:18px"><small>Review before applying. You can undo.</small><button class="primary small" type="submit">Review change</button></div></form></section>`;
}
function progressPanel(tagText, title, intro, names, step, footer) {
  return `<div class="panel" style="max-width:760px;margin:35px auto"><span class="tag blue">${tagText}</span><h2 style="margin-top:20px">${title}</h2><p class="muted">${intro}</p><ol class="progress-list">${names.map(([t, d], i) => `<li class="${i < step ? "done" : i === step ? "current" : ""}"><span class="progress-icon">${i < step ? "✓" : i + 1}</span><div><strong>${t}</strong><small>${esc(d)}</small></div></li>`).join("")}</ol>${footer}</div>`;
}
function building() {
  const a = A();
  return progressPanel(
    "Preparing your prototype",
    "Your plan is becoming an app.",
    "This local demonstration assembles the example screens and the choices you made.",
    [
      ["Prepare the screens", a.steps.join(", ") + " views"],
      ["Wire the example workflow", `Connect your ${a.agent.name} with the current settings`],
      ["Prepare the preview", "Make your configured example app available"],
    ],
    buildStep,
    `<div class="row between">${btn(buildStep >= 3 ? "Open your app" : "Pause build", buildStep >= 3 ? "preview" : "pause-build", buildStep >= 3 ? "primary" : "")}<small>No external build is running</small></div><div class="callout"><strong>While you wait</strong><p style="margin:5px 0">Try an input your app can handle, and one it cannot. Both are part of a useful app.</p></div>`,
  );
}
function publishing() {
  return progressPanel(
    "Publishing",
    "Releasing a version people can use.",
    "Freezing the current draft into a snapshot. Later edits stay in your draft.",
    [
      ["Freeze the snapshot", `Settings, source and name at draft v${p.revision}`],
      ["Apply access settings", p.settings.audience === "team" ? "Team sign-in required" : "Anyone with the link"],
      ["Release to production", `${appUrl()} · simulated`],
    ],
    publishStep,
    `<div class="row between"><small>No external deployment is running</small></div>`,
  );
}
function chart(c) {
  const max = Math.max(...c.data.map((d) => d.values.at(-1)), 1);
  return `<div class="bars">${c.data.map((d) => `<div class="bar-row ${c.highlight.includes(d.label) ? "hi" : ""}"><span>${esc(d.label)}</span><div class="bar"><i style="width:${Math.round((d.values.at(-1) / max) * 100)}%"></i></div><b>${d.values.at(-1)}</b></div>`).join("")}<small>${esc(c.header.at(-1))}</small></div>`;
}
function resultCard(target, a, r, recipient) {
  const handoffs = (target.agents || []).filter((x) => x.enabled !== false);
  return `<div class="answer ${selection === "Answer" ? "selected-answer" : ""}"><div class="row between"><strong>${r.blocked ? "Setup needed" : r.supported ? a.app.found : a.app.missing}</strong>${!recipient ? btn("Edit behavior", "edit-behavior", "quiet small") : ""}</div>${r.team ? `<div class="row" style="margin-top:10px">${tag(r.team, "blue")}${tag(r.priority + " priority", r.priority === "High" ? "warn" : "")}</div>` : ""}<p style="margin-top:12px">${esc(r.text)}</p>${r.chart ? chart(r.chart) : ""}${r.citation ? btn(showSource ? "Hide" : a.app.view, "citation", "quiet small") : ""}${showSource && r.citation ? `<div class="source-quote" style="margin-top:15px"><strong>${esc(target.sourceName)}</strong><p style="margin:8px 0;white-space:pre-line">${esc(r.citation)}</p><small>${target.sourceKind === "sample" ? "Synthetic example content" : "Local source text"}</small></div>` : ""}${handoffs.length && !recipient ? `<p class="footer-note">Then: ${handoffs.map((x) => `${esc(x.name)} · ${esc(x.responsibility.toLowerCase())}`).join(" → ")} (configured, not run)</p>` : ""}</div>`;
}
function sampleApp(target = p, recipient = false) {
  const a = A(target),
    s = target.settings,
    result = previewResult;
  return `<section class="sample-app ${s.theme === "ocean" ? "ocean" : ""}"><header><strong>${esc(target.name)}</strong><small>${s.audience === "team" ? "Team workspace" : "Open workspace"}</small></header><div class="app-content"><h2>${a.app.h2}</h2><p>${a.app.intro}</p><form id="question-form"><label class="sr" for="question">${a.app.placeholder}</label><textarea id="question" placeholder="${a.app.placeholder}" required>${esc(previewQuestion)}</textarea><div class="row between" style="margin-top:10px"><small>Deterministic example · no live model</small><button class="primary small">${a.app.button}</button></div></form><div class="row wrap" style="margin-top:15px">${a.chips.map(([l, q]) => btn(l, "sample-question", "small", `data-q="${esc(q)}"`)).join("")}</div>${result ? resultCard(target, a, result, recipient) : ""}</div></section>`;
}
function preview() {
  if (p.stage !== "built")
    return `<div class="panel"><h2>Start with a version you understand.</h2><p>Review the plan, then build the interactive example.</p>${btn("Review the plan", "nav", "primary", 'data-view="plan"')}</div>`;
  return `<div class="canvas-head row between wrap"><div><h2>Your app, ready to try</h2><p style="margin:0">Try it, inspect what it used, then shape the behavior. Each input is recorded in Runs.</p></div><div class="row">${btn("Appearance", "appearance", "small")}${btn("Edit behavior", "edit-behavior", "small")}</div></div>${p.imported ? `<div class="callout">Imported example: React + existing sign-in + ${esc(p.baselineFramework || "LangGraph")}. Your original stack remains visible in agent setup.</div>` : ""}<div class="app-frame"><div class="frame-bar"><span>${esc(p.name)} / preview</span><span>Draft v${p.revision} · ${p.sourceKind === "sample" ? "Example data" : "Local data"}</span></div>${sampleApp()}</div>${selection === "Answer" ? editor() : ""}<p class="footer-note">Sample inputs use keyword matching against local source text. This demonstrates the flow, not model quality.</p>`;
}
function agents() {
  const a = A(),
    s = p.settings,
    setup = frameworkSetup(p),
    extra = p.agents || [],
    sel = extra.find((x) => x.id === agentSel),
    tools = p.tools || ["read_source"];
  const list = `<div><button class="agent-item ${!sel ? "active" : ""}" data-action="agent-select" data-id="main"><strong>${a.agent.name}</strong><small>${a.agent.job}<br>Used by: ${a.steps[0]}</small></button>${extra.map((x) => `<button class="agent-item ${sel?.id === x.id ? "active" : ""}" data-action="agent-select" data-id="${x.id}"><strong>${esc(x.name)}</strong><small>${esc(x.responsibility)}<br>${esc(x.trigger)}</small></button>`).join("")}${btn("+ Add agent", "add-agent", "small", 'style="margin-top:15px"')}</div>`;
  const head = `<div class="canvas-head"><h2>Agents that do a clear job</h2><p>Start with what the app needs. Open implementation details when you need them.</p></div>`;
  if (sel)
    return `${head}<div class="agent-layout">${list}<div><div class="panel"><div class="row between"><h3>${esc(sel.name)}</h3>${tag(sel.status, /not verified|needs/i.test(sel.status) ? "warn" : "")}</div><div class="listrow"><div><strong>Responsibility</strong><p>${esc(sel.responsibility)}</p></div></div><div class="listrow"><div><strong>Runs</strong><p>${esc(sel.trigger)}</p></div></div><div class="listrow"><div><strong>Origin</strong><p>${esc(sel.origin)}${sel.entry ? ` · <code>${esc(sel.entry)}</code>` : ""}</p></div></div><div class="listrow"><div><strong>Handoff</strong><p>${a.agent.name} → ${esc(sel.name)}. Visible in Runs, the generated prompt and the app’s result card.</p></div>${btn("See in Runs", "nav", "small", 'data-view="runs"')}</div><div class="row wrap" style="margin-top:14px">${btn("Remove agent", "remove-agent", "danger small", `data-id="${sel.id}"`)}</div></div></div></div>`;
  return `${head}<div class="agent-layout">${list}<div><div class="panel"><div class="row between"><h3>${a.agent.name}</h3>${tag(s.framework, "blue")}</div><p>${a.agent.does}</p><div class="listrow"><div><strong>Behavior</strong><p>${esc(summary(s))}</p></div>${btn("Edit", "edit-behavior", "small")}</div><div class="listrow"><div><strong>Knowledge</strong><p>${esc(p.sourceName)} · ${p.sourceKind === "sample" ? "sample" : "local"}</p></div>${btn("Manage", "nav", "small", 'data-view="data"')}</div><div class="listrow"><div><strong>Used in your app</strong><p>${a.agent.used}</p></div>${btn("Try it", "preview", "small")}</div></div>${selection === "Answer" ? editor() : ""}<div class="panel"><h3>Tools and actions</h3><p class="muted">What this agent is allowed to do. Turn off source reading and the app answers with a setup message instead; actions stay off until you enable them.</p><form id="tools-form">${TOOLS.map(([id, label]) => `<label class="checkrow" style="margin:8px 0"><input type="checkbox" name="tool" value="${id}" ${tools.includes(id) ? "checked" : ""}> ${label}${id !== "read_source" ? ' <small class="muted">· demo action, not executed</small>' : ""}</label>`).join("")}<div style="margin-top:14px"><button class="primary small">Save tools</button></div></form></div><div class="panel"><h3>Test this agent</h3><form id="test-form"><label for="test-input">Input</label><textarea id="test-input" rows="2">${esc(testInput || a.chips[0][1])}</textarea><div class="row between" style="margin-top:10px"><small>Runs the deterministic example and records it in Runs</small><button class="primary small">Run test</button></div></form>${testResult ? `<div class="source-quote" style="margin-top:16px"><strong>${testResult.supported ? "Output" : "No match"}</strong><p style="margin:6px 0">${esc(testResult.text)}</p><ol class="trace">${testResult.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}</div><div class="panel"><div class="row between"><h3>Framework and model</h3>${tag(setup.status, /needs|not/i.test(setup.status) ? "warn" : "good")}</div><p class="muted">Keep your preferred stack. The prototype records this setup and generates matching scaffold files; it does not run these frameworks.</p><form id="framework-form"><label for="framework">Agent framework</label><select id="framework">${["Lyzr managed", "LangGraph", "CrewAI", "OpenAI Agents SDK", "Custom framework"].map((x) => `<option ${s.framework === x ? "selected" : ""}>${x}</option>`).join("")}</select><label for="custom-framework">Custom framework or entry point (optional)</label><input id="custom-framework" value="${esc(s.customFramework || "")}" placeholder="For example: agents/policy.py"><label for="model">Model configuration</label><select id="model">${["Managed default", "OpenAI · bring your key", "Anthropic · bring your key"].map((x) => `<option ${s.model === x ? "selected" : ""}>${x}</option>`).join("")}</select><div style="margin-top:18px"><button class="primary small">Save setup</button></div></form><div class="callout"><strong>${esc(s.framework)} setup</strong> · entry <code>${esc(setup.entry)}</code> · ${esc(setup.runtime)}<ol style="margin:8px 0 0;padding-left:18px">${setup.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${p.imported ? `<p style="margin:8px 0 0">Original import framework: ${esc(p.baselineFramework || "LangGraph")}.</p>` : ""}</div><div class="row wrap">${btn("View generated agent file", "code-open", "small", `data-path="${esc(setup.entry)}"`)}${btn("Environment variables", "nav", "small", 'data-view="settings"')}</div></div></div></div>`;
}
function data() {
  const a = A();
  return `<div class="canvas-head"><h2>Give your app something to know.</h2><p>Start with sample content, or edit the local source. Keep data setup separate from the app’s appearance.</p></div><div class="panel"><div class="row between"><h3>${esc(p.sourceName)}</h3>${tag(p.sourceKind === "sample" ? "Sample content" : "Local content")}</div><form id="source-form"><label for="source-name">Source name</label><input id="source-name" required value="${esc(p.sourceName)}"><label for="source-text">${a.source.label}</label><textarea id="source-text" rows="9">${esc(p.source)}</textarea><p class="footer-note">${a.source.hint}</p><div class="row between wrap"><label class="quiet" style="margin:0">Import local .txt or .csv <input id="source-file" type="file" accept=".txt,.csv,text/plain,text/csv" style="max-width:230px"></label><button class="primary small">Save source</button></div></form></div><div class="panel"><h3>Connect where your ${people(p.settings) === "customers" ? "data lives" : "team works"}</h3>${a.source.connectors.map((x) => `<div class="listrow"><div><strong>${x}</strong><p>${p.connections?.includes(x) ? "Demo setup saved · no live data access" : "Not connected"}</p></div>${btn(p.connections?.includes(x) ? "Review" : "Set up", "connect-source", "small", `data-source="${x}"`)}</div>`).join("")}</div>`;
}
function code() {
  const files = generateFiles(p),
    changed = changedAreas(p);
  if (!files.some((f) => f.path === codeFile)) codeFile = files[0].path;
  const f = files.find((x) => x.path === codeFile);
  const tree = files
    .map(
      (x) =>
        `<button class="file ${x.path === codeFile ? "active" : ""}" data-action="code-file" data-path="${esc(x.path)}"><span>${esc(x.path)}</span>${changed.has(x.area) ? '<i class="dot-changed" title="Changed since last commit"></i>' : ""}</button>`,
    )
    .join("");
  return `<div class="canvas-head row between wrap"><div><h2>Your project as code.</h2><p style="margin:0">Every file is generated from the plan and settings. Change either side; Architect keeps them together.</p></div><div class="row wrap">${btn("Copy file", "copy-file", "small")}${btn("Download source (.zip)", "download-zip", "primary small")}</div></div><div class="code-layout"><nav class="filetree" aria-label="Files">${tree}<p class="footer-note">${changed.size ? `${changed.size} area${changed.size === 1 ? "" : "s"} changed since the last demo commit.` : "Matches the last demo commit."}</p></nav><div class="codepane"><div class="frame-bar"><span>${esc(codeFile)}</span><span>${changed.has(f.area) ? tag("Changed", "warn") : tag("Committed")}</span></div><pre class="codeblock code">${esc(f.text)}</pre></div></div><p class="footer-note">The archive contains exactly these files. Framework files are scaffolds for ${esc(p.settings.framework)}; runtime execution is not part of this prototype. Editing files in place is a planned developer feature.</p>`;
}
function runs() {
  const list = p.runs || [];
  return `<div class="canvas-head"><h2>What the agent actually did.</h2><p>Every preview input and agent test is recorded with the steps taken and the settings in force. Runs are local and deterministic.</p></div>${
    list.length
      ? list
          .map(
            (r, i) =>
              `<details class="panel run" ${i === 0 ? "open" : ""}><summary><span class="row between wrap"><span><strong>${esc(r.input)}</strong><br><small>${when(r.at)} · v${r.revision} · ${r.ms} ms local</small></span>${tag(r.supported ? "Answered" : "No match", r.supported ? "good" : "warn")}</span></summary><ol class="trace">${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><div class="source-quote"><strong>Output</strong><p style="margin:6px 0 0">${esc(r.output)}</p></div><div class="row" style="margin-top:12px">${btn("Re-run with current settings", "rerun", "small", `data-input="${esc(r.input)}"`)}</div></details>`,
          )
          .join("")
      : `<div class="panel empty">No runs yet. Try an input in the App preview or test the agent.</div>`
  }`;
}
function configDiff(before, after) {
  const labels = {
    length: A().settings.length.label,
    unknown: A().settings.unknown.label,
    citations: A().settings.citations,
    audience: "App audience",
    framework: "Framework",
    model: "Model",
    customFramework: "Entry point",
    theme: "Theme",
  };
  const changed = Object.keys(after).filter((k) => before[k] !== after[k]);
  return `<div class="diff"><div><strong>Before</strong>${changed.map((k) => `<p>${labels[k] || k}: ${esc(before[k] ?? "Not set")}</p>`).join("")}</div><div><strong>After</strong>${changed.map((k) => `<p>${labels[k] || k}: ${esc(after[k] ?? "Not set")}</p>`).join("")}</div></div>`;
}
function review() {
  const changes = pendingChanges(p),
    changed = changedAreas(p),
    files = generateFiles(p).filter((f) => changed.has(f.area));
  return `<div class="canvas-head"><h2>Understand what changed.</h2><p>Review the result, then decide what belongs in your repository.</p></div><div class="panel"><div class="row between"><h3>GitHub</h3>${tag(p.git.connected ? "Demo connection" : "Not connected", p.git.connected ? "good" : "")}</div>${p.git.connected ? `<div class="row between wrap"><div><strong>${esc(p.git.repo)}</strong><p class="muted">Branch: <code>${esc(p.git.branch)}</code></p></div>${btn("Change branch", "branch", "small")}</div><div class="row wrap">${tag("Working version " + p.revision)}${tag("Committed " + p.git.committedRevision)}${tag("Synced " + p.git.syncedRevision)}</div>` : `<p>Choose a repository and branch. This demonstration will show connection, commit and sync states without accessing GitHub.</p>${btn("Connect GitHub", "github", "primary small")}`}</div><div class="panel"><div class="row between"><h3>${changes.length ? "Changes to review" : "No uncommitted changes"}</h3>${p.history.length ? btn("Undo last settings change", "undo", "small") : ""}</div>${p.imported ? '<p class="muted">Preserved from import: React UI, existing sign-in and original framework baseline.</p>' : ""}${changes.length ? changes.map((c) => `<div class="sectionline"><strong>${esc(c.reason)}</strong><small> · v${c.revision}</small>${c.before ? `${configDiff(c.before, c.after)}` : ""}</div>`).join("") : '<p class="muted">The current configuration matches your latest local demo commit.</p>'}${files.length ? `<details><summary>Files affected (${files.length})</summary><ul class="filelist">${files.map((f) => `<li>${btn(esc(f.path), "code-open", "link-button", `data-path="${esc(f.path)}"`)}</li>`).join("")}</ul></details>` : ""}<details><summary>Configuration represented by this change</summary><pre class="codeblock">${esc(JSON.stringify({ archetype: p.archetype, ...p.settings }, null, 2))}</pre></details><div class="row wrap">${btn("Check this version", "check", "small")}${btn("Commit changes", "commit", "primary small", !p.git.connected || !changes.length ? "disabled" : "")}${btn("Sync to GitHub", "sync", "small", !p.git.connected || p.git.committedRevision <= p.git.syncedRevision ? "disabled" : "")}</div>${p.check ? `<p class="footer-note">Local configuration check v${p.check.revision}: ${esc(p.check.result)}${p.check.revision !== p.revision ? " · stale, run again for this draft" : ""}. No production tests executed.</p>` : ""}</div>`;
}
function deploy() {
  const latest = p.releases.at(-1),
    url = appUrl(),
    upToDate = latest && latest.revision === p.revision;
  return `<div class="canvas-head"><h2>Ship it to people.</h2><p>Preview is your draft. Production is the last release. Publishing freezes a snapshot; later edits stay in the draft until you publish again.</p></div><div class="two-col"><div class="panel"><div class="row between"><h3>Preview</h3>${tag("Draft v" + p.revision, "blue")}</div><p class="muted">Latest build of your draft, visible only to you.</p>${btn(p.stage === "built" ? "Open preview" : "Build first", p.stage === "built" ? "preview" : "build", "small")}</div><div class="panel"><div class="row between"><h3>Production</h3>${latest ? tag(`Release ${latest.number} · v${latest.revision}`, "good") : tag("Not published")}</div>${latest ? `<p class="muted">${esc(describe(latest))}${(latest.agents || []).length ? ` · ${latest.agents.length} extra agent${latest.agents.length === 1 ? "" : "s"}` : ""}</p><div class="row wrap"><a class="button-link" target="_blank" rel="noopener" href="?release=${latest.id}">Open released app ↗</a>${btn("Copy link", "copy-link", "small", `data-link="${esc(recipientUrl(latest))}"`)}</div><p class="footer-note">The link works in this browser only. Production address would be <code>${esc(url)}</code> ${btn("copy simulated address", "copy-sim", "link-button", `data-link="${esc(url)}"`)}</p>` : `<p class="muted">Publish to create a working recipient view and a release record.</p>`}<div style="margin-top:12px">${btn(upToDate ? "Production is up to date" : latest ? "Publish update" : "Publish", "publish", "primary small", upToDate ? "disabled" : "")}</div></div></div><div class="panel"><h3>Releases</h3>${p.releases.length ? p.releases.slice().reverse().map((r) => `<div class="listrow"><div><strong>Release ${r.number} · v${r.revision}</strong><p>${when(r.at)} · ${esc(describe(r))}${(r.agents || []).length ? ` · agents: ${esc(r.agents.map((x) => x.name).join(", "))}` : ""}${r.tools && r.tools.length !== 1 ? ` · tools: ${esc(r.tools.join(", ") || "none")}` : ""}</p></div><div class="row wrap">${r === latest ? tag("Live", "good") : tag("Superseded")}<a target="_blank" rel="noopener" href="?release=${r.id}">Open ↗</a>${btn("Deploy log", "deploy-log", "quiet small", `data-id="${r.id}"`)}${r !== latest ? btn("Roll back", "rollback", "small", `data-id="${r.id}"`) : ""}</div></div>`).join("") : '<p class="muted">No releases yet.</p>'}</div><div class="panel"><div class="row between"><h3>Custom domain</h3>${p.domain ? tag(p.domain.status === "verified" ? "Verified (demo)" : "Pending DNS · simulated", p.domain.status === "verified" ? "good" : "warn") : tag("Not set")}</div>${p.domain ? `<p><strong>${esc(p.domain.name)}</strong></p><p class="muted">Add a CNAME record pointing <code>${esc(p.domain.name)}</code> to <code>apps.architect.app</code>, then verify. No DNS is changed by this prototype.</p><div class="row wrap">${p.domain.status !== "verified" ? btn("Verify", "verify-domain", "small") : ""}${btn("Remove", "remove-domain", "quiet small")}</div>` : `<form id="domain-form" class="row wrap"><label class="sr" for="domain">Domain</label><input id="domain" placeholder="help.yourcompany.com" pattern="[a-z0-9.\\-]+\\.[a-z]{2,}" required style="min-width:260px"><button class="primary small">Add domain</button></form><p class="footer-note">Validation only. No DNS is changed.</p>`}</div>`;
}
function activity() {
  return `<div class="canvas-head"><h2>Your project’s story</h2><p>Every revision remains understandable. Published versions stay separate from your draft.</p></div><div class="panel"><h3>Draft changes</h3>${
    p.changes.length
      ? p.changes
          .slice()
          .reverse()
          .map(
            (c) =>
              `<div class="listrow"><div><strong>${esc(c.reason)}</strong><p>${when(c.at)}</p></div>${tag("v" + c.revision)}</div>`,
          )
          .join("")
      : "<p>No changes yet. Select a plan step to begin.</p>"
  }</div><div class="panel"><div class="row between"><h3>Releases</h3>${btn("Open Deploy", "nav", "small", 'data-view="deploy"')}</div>${p.releases.length ? p.releases.slice().reverse().map((r) => `<div class="listrow"><div><strong>Release ${r.number} · draft v${r.revision}</strong><p>${when(r.at)} · ${esc(describe(r))}</p></div><a target="_blank" rel="noopener" href="?release=${r.id}">Open app ↗</a></div>`).join("") : "<p>No releases yet. Publishing creates a working recipient view of this browser’s saved snapshot.</p>"}</div><div class="panel"><div class="row between"><h3>Runs</h3>${btn("Open Runs", "nav", "small", 'data-view="runs"')}</div><p class="muted">${(p.runs || []).length} recorded run${(p.runs || []).length === 1 ? "" : "s"} in this browser.</p></div>`;
}
function settings() {
  const members = p.members || [{ name: db.account?.name || "Aman", email: db.account?.email || "aman@demo.architect", role: "Owner" }];
  return `<div class="canvas-head"><h2>Project settings</h2><p>Manage how this app looks, who it is for, who works on it, and how you keep your work.</p></div><div class="panel"><div class="listrow"><div><strong>App access</strong><p>${p.settings.audience === "team" ? "Team members · sign-in required" : "Anyone with the link"}</p></div>${btn("Edit", "access", "small")}</div><div class="listrow"><div><strong>Appearance</strong><p>${p.settings.theme === "forest" ? "Forest" : "Ocean"} app theme</p></div>${btn("Change", "appearance", "small")}</div><div class="listrow"><div><strong>Starting pattern</strong><p>${A().label} · chosen when the idea was shaped</p></div>${tag(A().agent.name)}</div><div class="listrow"><div><strong>Project export</strong><p>Download the generated source as a ZIP, or the saved configuration and history as JSON.</p></div><div class="row wrap">${btn("Source (.zip)", "download-zip", "small")}${btn("Config (.json)", "export", "small")}</div></div></div><div class="panel"><div class="row between"><h3>Environment variables</h3>${btn("Add variable", "add-env", "small")}</div><p class="muted">Names only in this demo. Values are never stored or sent; do not paste real keys.</p>${envVars(p).map((v) => `<div class="listrow"><div><strong><code>${esc(v.name)}</code></strong></div>${tag(v.status, v.status === "Not set" ? "warn" : v.status === "Managed" ? "blue" : "good")}</div>`).join("")}</div><div class="panel"><div class="row between"><h3>Members</h3>${btn("Invite", "invite", "small")}</div>${members.map((m) => `<div class="listrow"><div><strong>${esc(m.name || m.email)}</strong><p>${esc(m.email)}${m.status ? ` · ${esc(m.status)}` : ""}</p></div>${tag(m.role)}</div>`).join("")}</div><div class="panel"><h3>Workspace</h3><div class="listrow"><div><strong>Demo account</strong><p>${esc(db.account?.email || "aman@demo.architect")} · local browser storage</p></div>${btn("Prototype details", "about", "small")}</div><div class="listrow"><div><strong>Archive project</strong><p>Hides it from Home. Releases stay available in this browser.</p></div>${btn("Archive", "archive", "danger small")}</div></div>`;
}
function recipientView() {
  let r;
  for (const project of db.projects) {
    r = project.releases.find((x) => x.id === releaseId);
    if (r) break;
  }
  const bar = `<div class="prototype-note"><span>Released from Architect</span>${protoTag()}</div>`;
  if (!r) {
    app.innerHTML = `${bar}<main class="recipient"><h1>This local release isn’t available here.</h1><p>Prototype releases are stored in the browser that created them. They are not public deployments.</p><a href="./">Open Architect</a></main>`;
    return;
  }
  p = r;
  const a = A(r);
  if (
    r.settings.audience === "team" &&
    !sessionStorage.getItem("recipient-" + r.id)
  ) {
    app.innerHTML = `${bar}<main class="recipient"><div class="panel"><span class="tag">${esc(r.name)}</span><h1 style="margin-top:24px">${a.headline}</h1><p>This release requires team sign-in. Enter as a sample employee to try the flow.</p>${btn("Continue as sample employee", "recipient-login", "primary")}<p class="footer-note">Demo access only. No real account or access protection.</p></div></main>`;
    return;
  }
  app.innerHTML = `${bar}<main class="recipient"><div class="row between" style="margin-bottom:15px"><a href="./">← Back to Architect</a>${tag("Release " + r.number + " · v" + r.revision)}</div><div class="app-frame">${sampleApp(r, true)}</div><p class="footer-note">Saved release snapshot. Later draft edits do not change this version. Local to this browser.</p></main>`;
  bind();
}
function render() {
  if (releaseId) {
    recipientView();
    return;
  }
  if (view === "home") {
    p = null;
    app.innerHTML = home();
  } else if (view === "signin") {
    p = null;
    app.innerHTML = signin();
  } else if (view === "reading") {
    p = null;
    app.innerHTML = reading();
  } else if (view === "shape") {
    p = null;
    app.innerHTML = shapeView();
  } else {
    const body =
      view === "plan"
        ? plan()
        : view === "building"
          ? building()
          : view === "publishing"
            ? publishing()
            : view === "app"
              ? preview()
              : view === "agents"
                ? agents()
                : view === "data"
                  ? data()
                  : view === "code"
                    ? code()
                    : view === "runs"
                      ? runs()
                      : view === "review"
                        ? review()
                        : view === "deploy"
                          ? deploy()
                          : view === "activity"
                            ? activity()
                            : settings();
    app.innerHTML = `${top()}<div class="workspace">${side()}${chat()}<main class="canvas" id="main">${body}</main></div>`;
  }
  bind();
}
function propose(next) {
  proposal = next;
  selection = "Answer";
  render();
  proposalDialog();
}
function proposalDialog() {
  if (!proposal) return;
  const a = A();
  const next = { ...p.settings, ...proposal };
  dialog(
    "Review the change",
    `<p>The same choice will update your plan, preview, ${a.agent.name} and generated code.</p>${configDiff(p.settings, next)}<h4>${a.settings.unknown.label}</h4><p>${esc(answer({ ...p, settings: next }, a.unmatched).text)}</p>`,
    btn("Keep current version", "cancel-proposal") +
      btn("Apply change", "apply-proposal", "primary"),
  );
}
function startBuild() {
  view = "building";
  buildStep = 0;
  render();
  clearInterval(buildTimer);
  buildTimer = setInterval(() => {
    if (view !== "building") {
      clearInterval(buildTimer);
      return;
    }
    buildStep++;
    if (buildStep >= 3) {
      clearInterval(buildTimer);
      p.stage = "built";
      save();
    }
    render();
  }, 1100);
}
function startPublish() {
  view = "publishing";
  publishStep = 0;
  render();
  window.scrollTo({ top: 0 });
  clearInterval(publishTimer);
  publishTimer = setInterval(() => {
    if (view !== "publishing") {
      clearInterval(publishTimer);
      return;
    }
    publishStep++;
    if (publishStep >= 3) {
      clearInterval(publishTimer);
      const r = publish(p);
      save();
      view = "deploy";
      render();
      dialog(
        "Your release is live in this browser",
        `<span class="tag good">Release ${r.number} · v${r.revision}</span><h3 style="margin-top:18px">Try it as a ${people(p.settings) === "customers" ? "visitor" : "teammate"}.</h3><p>The released behavior and source are saved as a snapshot. Further edits remain in your draft.</p><a class="button-link" target="_blank" rel="noopener" href="?release=${r.id}">Open released app ↗</a><p class="footer-note" style="margin-top:14px">Production URL would be <code>${esc(appUrl())}</code>. That address is simulated; the link above is the working recipient view for this browser.</p>`,
        btn("Done", "close", "primary"),
      );
      return;
    }
    render();
  }, 600);
}
function startShaping() {
  const read = interpret(brief);
  shape = {
    brief,
    archetype: read.archetype,
    name: read.name,
    audience: read.audience,
    autoNamed: true,
  };
  pending = null;
  readStep = 0;
  view = "reading";
  render();
  window.scrollTo({ top: 0 });
  clearInterval(readTimer);
  readTimer = setInterval(() => {
    if (view !== "reading") {
      clearInterval(readTimer);
      return;
    }
    readStep++;
    if (readStep >= 3) {
      clearInterval(readTimer);
      view = "shape";
    }
    render();
  }, 450);
}
function create(imported = false, opts = {}) {
  p = createProject(imported ? IMPORT_BRIEF : brief, imported, opts);
  if (imported) {
    p.baselineFramework = "LangGraph";
    p.settings.length = "detailed";
    p.settings.citations = false;
    p.importedAt = new Date().toISOString();
    p.git.repo = importFlow?.repo || "northstar/support-app";
    p.git.branch = importFlow?.branch || "feature/citations";
    p.git.connected = true;
    p.git.committedRevision = 1;
    p.git.syncedRevision = 1;
  }
  db.projects.unshift(p);
  save();
  shape = null;
  openProject(p.id, imported ? "app" : "plan");
}
function finishSignIn(method, email) {
  db.signedIn = true;
  db.account = {
    name: email.startsWith("aman") ? "Aman" : method === "Demo" ? "Aman" : "You",
    email,
    method,
  };
  save();
  auth = { step: "choose", provider: "", email: "" };
  toast(`Signed in with ${method} · demo account`);
  continuePending();
}
function continuePending() {
  const next = pending;
  pending = null;
  if (next?.action === "shape") return startShaping();
  view = "home";
  render();
  if (next?.action === "import") act.import();
}
function requireAccount(action) {
  if (db.signedIn) return true;
  pending = { action };
  auth = { step: "choose", provider: "", email: "" };
  view = "signin";
  render();
  window.scrollTo({ top: 0 });
  return false;
}
function importDialog() {
  const f = importFlow;
  if (f.step === "pick")
    return dialog(
      "Import from GitHub",
      `<p class="muted">Architect asks for read access to the repositories you choose. Nothing is written until you sync.</p><div class="stack">${[
        ["northstar/support-app", "React · LangGraph · team sign-in", true],
        ["acme/inventory-bot", "Private · no demo fixture", false],
        ["team/website", "Private · no demo fixture", false],
      ]
        .map(
          ([repo, desc, ok]) =>
            `<button class="listrow choice ${f.repo === repo ? "active" : ""}" data-action="import-repo" data-repo="${repo}" ${ok ? "" : "disabled"} style="width:100%;text-align:left"><div><strong>${repo}</strong><p>${desc}</p></div>${f.repo === repo ? tag("Selected", "good") : ok ? tag("Demo fixture", "blue") : ""}</button>`,
        )
        .join("")}</div><label for="import-branch">Branch</label><select id="import-branch"><option ${f.branch === "main" ? "selected" : ""}>main</option><option ${f.branch === "feature/citations" ? "selected" : ""}>feature/citations</option></select><p class="footer-note">Demo: only the Northstar fixture can be inspected. No GitHub access is requested.</p>`,
      btn("Inspect repository", "import-scan", "primary", f.repo ? "" : "disabled"),
    );
  if (f.step === "zip")
    return dialog(
      "Import a codebase",
      `<p>Select a ZIP of your project. Architect inspects frameworks, start commands and sign-in before anything changes.</p><label for="zip-file">Project archive</label><input id="zip-file" type="file" accept=".zip,application/zip"><p class="footer-note">Archive contents are not read in this prototype. After you choose a file, the Northstar fixture stands in for the inspection.</p>`,
      null,
    );
  if (f.step === "scan")
    return dialog(
      "Inspecting " + esc(f.archive ? f.archive.name : f.repo),
      `<ol class="progress-list">${[
        ["Reading the project", f.archive ? `${f.archive.name} · ${Math.round(f.archive.size / 1024)} KB` : `${f.repo} · ${f.branch}`],
        ["Detecting frameworks and sign-in", "package.json, requirements.txt, auth providers"],
        ["Finding agents and data", "Workflows, prompts and knowledge files"],
      ]
        .map(([t, d], i) => `<li class="${i < f.scanStep ? "done" : i === f.scanStep ? "current" : ""}"><span class="progress-icon">${i < f.scanStep ? "✓" : i + 1}</span><div><strong>${t}</strong><small>${esc(d)}</small></div></li>`)
        .join("")}</ol><p class="footer-note">Simulated inspection. Nothing is cloned or uploaded.</p>`,
      null,
    );
  return dialog(
    "What I found",
    `<div class="listrow"><strong>App</strong><span>Northstar Support · React 18 + Vite</span></div><div class="listrow"><strong>Agent</strong><span>LangGraph workflow · <code>agents/graph.py</code></span></div><div class="listrow"><strong>Sign-in</strong><span>Team sign-in (Clerk)</span></div><div class="listrow"><strong>Data</strong><span><code>docs/handbook.md</code></span></div><div class="listrow"><strong>Deployed</strong><span>Vercel · production</span></div><div class="callout"><strong>We’ll keep</strong> your branding, sign-in, framework and data. Changes go to a working branch you review before syncing.</div><h4>What do you want to change first?</h4><div class="row wrap">${btn("Add supporting sources", "import-go", "small", 'data-change="citations"')}${btn("Shorter answers", "import-go", "small", 'data-change="length"')}${btn("Route unmatched to a person", "import-go", "small", 'data-change="none"')}${btn("Just look around", "import-go", "quiet small", 'data-change=""')}</div><p class="footer-note">${f.archive ? "Archive not read; " : ""}prepared fixture, not a repository scan.</p>`,
    null,
  );
}
function runImportScan() {
  importFlow.step = "scan";
  importFlow.scanStep = 0;
  importDialog();
  clearInterval(importFlow.timer);
  importFlow.timer = setInterval(() => {
    if (!importFlow || !modal.open) return clearInterval(importFlow.timer);
    importFlow.scanStep++;
    if (importFlow.scanStep >= 3) {
      clearInterval(importFlow.timer);
      importFlow.step = "found";
    }
    importDialog();
  }, 500);
}
function recordPreview(question) {
  previewResult = answer(p, question);
  showSource = false;
  recordRun(p, question, previewResult);
  save();
}
function downloadBlob(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
const act = {
  home: () => {
    clearInterval(buildTimer);
    clearInterval(readTimer);
    clearInterval(publishTimer);
    proposal = null;
    selection = "";
    previewQuestion = "";
    previewResult = null;
    shape = null;
    pending = null;
    view = "home";
    p = null;
    history.replaceState(null, "", location.pathname);
    render();
    window.scrollTo({ top: 0 });
  },
  open: (el) => openProject(el.dataset.id),
  nav: (el) => nav(el.dataset.view),
  preview: () => nav("app"),
  "toggle-chat": () => {
    chatOpen = !chatOpen;
    render();
  },
  close: () => modal.close(),
  about: () =>
    dialog(
      "What works in this prototype?",
      `<p><strong>Real, local interactions:</strong> brief interpretation into three starting patterns, saved projects, plan edits with review and undo, a chat that proposes changes, source editing, deterministic example answers, recorded runs with traces, generated source files and a real ZIP download, revision history, release snapshots with rollback, and a working recipient view.</p><p><strong>Simulated:</strong> sign-in providers, AI generation, repository inspection, agent runtimes, GitHub commit and sync, deployment URLs and DNS. No credentials are requested or sent.</p><p>Each pattern uses keyword matching against local source text; other inputs demonstrate the no-answer path. Releases are available only in this browser.</p>`,
    ),
  signin: () => {
    auth = { step: "choose", provider: "", email: "" };
    view = "signin";
    render();
    window.scrollTo({ top: 0 });
  },
  "auth-choose": () => {
    auth.step = "choose";
    render();
  },
  "auth-email": () => {
    auth.step = "email";
    render();
    document.querySelector("#email")?.focus();
  },
  "auth-provider": (el) => {
    auth.provider = el.dataset.provider;
    auth.step = "provider";
    render();
  },
  "auth-account": (el) => finishSignIn(auth.provider, el.dataset.email),
  "auth-resend": () => toast("Demo: link resent (nothing is actually sent)."),
  "auth-demo": () => finishSignIn("Demo", "aman@demo.architect"),
  account: () =>
    dialog(
      "Account",
      `<div class="listrow"><div><strong>${esc(db.account?.name || "Aman")}</strong><p>${esc(db.account?.email || "aman@demo.architect")} · ${esc(db.account?.method || "Demo")} sign-in</p></div>${tag("Demo account")}</div><div class="listrow"><div><strong>Workspace</strong><p>Demo workspace · projects saved in this browser</p></div></div><div class="listrow"><div><strong>Reset demo data</strong><p>Removes every project and release stored in this browser.</p></div>${btn("Reset…", "reset-demo", "danger small")}</div>`,
      btn("Prototype details", "about") + btn("Sign out", "signout", "primary"),
    ),
  signout: () => {
    db.signedIn = false;
    db.account = null;
    save();
    modal.close();
    act.home();
    toast("Signed out. Your projects stay in this browser.");
  },
  "reset-demo": () =>
    dialog(
      "Reset demo data?",
      `<p>This removes ${db.projects.length} project${db.projects.length === 1 ? "" : "s"} and every release saved in this browser. It cannot be undone.</p>`,
      btn("Keep everything", "close") + btn("Reset demo data", "reset-confirm", "danger"),
    ),
  "reset-confirm": () => {
    db = { projects: [], signedIn: false };
    save();
    modal.close();
    act.home();
    toast("Demo data reset.");
  },
  start: () => {
    brief = document.querySelector("#brief")?.value.trim() ?? brief;
    sessionStorage.setItem("architect-draft-brief", brief);
    if (!brief) return toast("Describe what you want to build first.");
    if (!requireAccount("shape")) return;
    startShaping();
  },
  "shape-now": () => {
    clearInterval(readTimer);
    view = "shape";
    render();
  },
  "pick-pattern": (el) => {
    shape.archetype = el.dataset.archetype;
    if (shape.autoNamed)
      shape.name = ARCHETYPES[shape.archetype].nameFor(
        subjectFor(shape.archetype, shape.brief),
      );
    render();
  },
  import: () => {
    if (!requireAccount("import")) return;
    importFlow = { step: "choose", repo: "", branch: "main", scanStep: 0 };
    dialog(
      "Continue an existing project",
      `<p>Choose how you would bring your work into Architect. Nothing changes until you pick a change after inspection.</p><div class="stack">${btn("Connect a GitHub repository", "import-github")}${btn("Import a ZIP or codebase", "import-zip")}</div><div class="callout"><strong>Try the imported-project example</strong><p>Northstar Support: an existing React app, team sign-in and LangGraph workflow. Inspect it before changing it.</p></div>`,
      btn("Inspect sample project", "import-sample", "primary"),
    );
  },
  "import-github": () => {
    importFlow = { ...importFlow, step: "pick", repo: "", branch: "main" };
    importDialog();
  },
  "import-repo": (el) => {
    importFlow.repo = el.dataset.repo;
    importFlow.branch = document.querySelector("#import-branch")?.value || "main";
    importDialog();
  },
  "import-scan": () => {
    importFlow.branch = document.querySelector("#import-branch")?.value || importFlow.branch;
    runImportScan();
  },
  "import-zip": () => {
    importFlow = { ...importFlow, step: "zip" };
    importDialog();
  },
  "import-sample": () => {
    importFlow = { ...importFlow, repo: "northstar/support-app", branch: "feature/citations" };
    runImportScan();
  },
  "import-go": (el) => {
    const change = el.dataset.change;
    modal.close();
    create(true);
    const first =
      change === "citations"
        ? { citations: true }
        : change === "length"
          ? { length: "short" }
          : change === "none"
            ? { unknown: "explain" }
            : null;
    if (first) {
      p.chat.push({
        role: "user",
        text: el.textContent.trim(),
      });
      p.chat.push({
        role: "assistant",
        text: "Here’s the focused change on top of the imported baseline. Review it before it applies.",
      });
      save();
      propose(first);
    }
  },
  examples: () =>
    dialog(
      "Start from a useful example",
      `<div class="stack">${EXAMPLES.map(([t, d], i) => `<div class="panel" style="margin:0"><div class="row between wrap"><div><h3 style="margin-bottom:4px">${t}</h3><p style="margin:0" class="muted">${d}</p></div>${btn("Use this example", "use-example", "primary small", `data-example="${i}"`)}</div></div>`).join("")}</div>`,
    ),
  "use-example": (el) => {
    brief = EXAMPLES[+el.dataset.example][2];
    sessionStorage.setItem("architect-draft-brief", brief);
    modal.close();
    if (!requireAccount("shape")) return;
    startShaping();
  },
  consult: () =>
    dialog(
      "Start with the repeated task",
      `<p>A good first app helps someone finish a recurring task.</p><label for="task-idea">What question or task keeps coming back?</label><textarea id="task-idea" placeholder="For example: teammates ask about leave policies"></textarea>`,
      btn("Use this as my brief", "use-task", "primary"),
    ),
  "use-task": () => {
    const t = document.querySelector("#task-idea").value.trim();
    if (!t) return toast("Add a task first.");
    brief = t;
    sessionStorage.setItem("architect-draft-brief", brief);
    modal.close();
    render();
  },
  reference: () =>
    dialog(
      "Add context to your idea",
      `<p>Source text can be edited or imported as a local .txt or .csv file once the project opens. No documents are sent to a model.</p><p>For the demo, begin with the included sample content, then open Knowledge to change it.</p>`,
    ),
  select: (el) => {
    selection = el.dataset.target;
    render();
    document
      .querySelector(".editor")
      ?.scrollIntoView({ block: "nearest", behavior: "auto" });
  },
  "clear-select": () => {
    selection = "";
    render();
  },
  "edit-behavior": () => {
    selection = "Answer";
    agentSel = "main";
    if (!["plan", "app", "agents"].includes(view)) view = "agents";
    render();
    document
      .querySelector(".editor")
      ?.scrollIntoView({ block: "nearest", behavior: "auto" });
  },
  "suggest-short": () =>
    propose({ length: p.settings.length === "short" ? "detailed" : "short" }),
  "suggest-ask": () =>
    propose({ unknown: p.settings.unknown === "ask" ? "explain" : "ask" }),
  "suggest-citations": () => propose({ citations: true }),
  "review-proposal": () => proposalDialog(),
  "cancel-proposal": () => {
    proposal = null;
    modal.close();
    render();
  },
  "apply-proposal": () => {
    const changed = settingsChange(p, proposal, "Updated behavior");
    proposal = null;
    modal.close();
    if (changed) {
      p.chat.push({
        role: "assistant",
        text: `Plan, preview, ${A().agent.name} and generated code updated. ` + summary(p.settings),
      });
      save();
      previewResult = null;
      render();
      toast("Change applied across your project.");
    } else {
      render();
      toast("These settings already match your project.");
    }
  },
  undo: () => {
    if (undo(p)) {
      save();
      previewResult = null;
      render();
      toast("Last settings change undone. Existing releases are unchanged.");
    }
  },
  build: () => startBuild(),
  "pause-build": () => {
    clearInterval(buildTimer);
    view = "plan";
    render();
    toast("Build paused. Your plan and edits are saved.");
  },
  "sample-question": (el) => {
    previewQuestion = el.dataset.q;
    recordPreview(previewQuestion);
    render();
  },
  rerun: (el) => {
    previewQuestion = el.dataset.input;
    recordPreview(previewQuestion);
    render();
    toast("Re-ran with the current settings.");
  },
  citation: () => {
    showSource = !showSource;
    render();
  },
  "agent-select": (el) => {
    agentSel = el.dataset.id;
    selection = "";
    render();
  },
  "add-agent": () =>
    dialog(
      "Add an agent",
      `<p class="muted">Add a second responsibility only when the app needs one. The handoff becomes visible in Runs and the generated prompt.</p><div class="stack">${btn("<strong>Create a new agent</strong><br><small>Name it and give it one job after the main agent</small>", "add-agent-new", "", 'style="text-align:left"')}${btn("<strong>Use an existing Lyzr Studio agent</strong><br><small>Keeps its identity and owner</small>", "add-agent-studio", "", 'style="text-align:left"')}${btn("<strong>Duplicate from this project</strong><br><small>Start from the current agent</small>", "add-agent-dup", "", 'style="text-align:left"')}${btn("<strong>Custom framework agent</strong><br><small>Point at your own entry point</small>", "add-agent-custom", "", 'style="text-align:left"')}</div>`,
    ),
  "add-agent-new": () =>
    dialog(
      "Create a new agent",
      `<form id="agent-form"><label for="agent-name">Name</label><input id="agent-name" required placeholder="Summarizer" style="width:100%"><label for="agent-job">Responsibility</label><select id="agent-job">${["Summarize the answer", "Draft a reply", "Escalate to a person", "Translate the answer"].map((x) => `<option>${x}</option>`).join("")}</select><label for="agent-trigger">Runs</label><select id="agent-trigger">${["After the main agent answers", "When no answer is found", "On request"].map((x) => `<option>${x}</option>`).join("")}</select><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Add agent</button></div></form>`,
      null,
    ),
  "add-agent-studio": () =>
    dialog(
      "Use an existing Studio agent",
      `<p class="muted">Agents configured in Lyzr Studio keep their owner and settings. Architect attaches them to an app step.</p><div class="stack">${[
        ["Policy summarizer", "Summarize the answer", "Owned by Ops"],
        ["Escalation router", "Escalate to a person", "Owned by Support"],
      ]
        .map(
          ([n, r, o]) =>
            `<div class="listrow"><div><strong>${n}</strong><p>${r} · ${o}</p></div>${btn("Attach", "attach-studio", "small", `data-name="${n}" data-job="${r}" data-owner="${o}"`)}</div>`,
        )
        .join("")}</div><p class="footer-note">Demo catalog. No Studio account is accessed.</p>`,
    ),
  "attach-studio": (el) => {
    addAgent(p, {
      name: el.dataset.name,
      responsibility: el.dataset.job,
      origin: `Lyzr Studio · ${el.dataset.owner}`,
      status: "Managed in Studio",
    });
    save();
    modal.close();
    agentSel = p.agents.at(-1).id;
    render();
    toast("Agent attached. Its settings stay managed in Studio.");
  },
  "add-agent-dup": () => {
    const a = A();
    const entry = addAgent(p, {
      name: `${a.agent.name} (copy)`,
      responsibility: a.agent.job,
      origin: "Duplicated from this project",
    });
    save();
    modal.close();
    agentSel = entry.id;
    render();
    toast("Duplicated. Give it a distinct responsibility.");
  },
  "add-agent-custom": () =>
    dialog(
      "Custom framework agent",
      `<form id="custom-agent-form"><label for="ca-name">Name</label><input id="ca-name" required placeholder="Ranker" style="width:100%"><label for="ca-framework">Framework</label><input id="ca-framework" required placeholder="For example: Semantic Kernel" style="width:100%"><label for="ca-entry">Entry point exposing run(input) → output</label><input id="ca-entry" required placeholder="agents/ranker.py" style="width:100%"><label for="ca-job">Responsibility</label><input id="ca-job" required placeholder="Rank candidate answers" style="width:100%"><p class="footer-note">Saved as “Not verified” until a test run succeeds. Nothing is executed in this prototype.</p><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Add agent</button></div></form>`,
      null,
    ),
  "remove-agent": (el) => {
    removeAgent(p, el.dataset.id);
    save();
    agentSel = "main";
    render();
    toast("Agent removed. Recorded in Changes.");
  },
  "code-file": (el) => {
    codeFile = el.dataset.path;
    render();
  },
  "code-open": (el) => {
    codeFile = el.dataset.path;
    nav("code");
  },
  "copy-file": async () => {
    const f = generateFiles(p).find((x) => x.path === codeFile) || generateFiles(p)[0];
    try {
      await navigator.clipboard.writeText(f.text);
      toast(`Copied ${f.path}.`);
    } catch {
      toast("Clipboard unavailable here. Select the text to copy it.");
    }
  },
  "download-zip": () => {
    downloadBlob(new Blob([zipBytes(generateFiles(p))], { type: "application/zip" }), `${slug(p.name)}-source.zip`);
    toast("Downloaded the generated source as a ZIP.");
  },
  "copy-link": async (el) => {
    try {
      await navigator.clipboard.writeText(el.dataset.link);
      toast("Copied the working link. It opens the released app in this browser.");
    } catch {
      toast(el.dataset.link);
    }
  },
  "copy-sim": async (el) => {
    try {
      await navigator.clipboard.writeText(el.dataset.link);
      toast("Copied the simulated production address. It does not resolve anywhere.");
    } catch {
      toast(el.dataset.link);
    }
  },
  access: () =>
    dialog(
      "Who should use this app?",
      `<form id="access-form"><label for="audience">App audience</label><select id="audience"><option value="team" ${p.settings.audience === "team" ? "selected" : ""}>Invited teammates · sign-in required</option><option value="public" ${p.settings.audience === "public" ? "selected" : ""}>Anyone with the link</option></select><p class="footer-note">The recipient demo will show the selected entry flow. This is not real access control.</p><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Save audience</button></div></form>`,
      null,
    ),
  appearance: () =>
    dialog(
      "Make the app feel like yours",
      `<p>Architect keeps its own interface. Your app can have a different visual identity.</p><div class="row">${btn("Forest", "theme", "", `data-theme="forest"`)}${btn("Ocean", "theme", "", `data-theme="ocean"`)}</div>`,
    ),
  theme: (el) => {
    settingsChange(p, { theme: el.dataset.theme }, "Changed app appearance");
    save();
    modal.close();
    render();
  },
  "connect-source": (el) => {
    const source = el.dataset.source;
    dialog(
      `Set up ${esc(source)}`,
      `<p>Choose which content the agent can read. A real connection would request access before reading anything.</p><label for="source-scope">Example folder, table or collection</label><input id="source-scope" placeholder="Company handbook"><p class="footer-note">Demo setup only. No account is connected or content retrieved.</p>`,
      btn("Save demo setup", "save-connection", "primary", `data-source="${source}"`),
    );
  },
  "save-connection": (el) => {
    p.connections = [...new Set([...(p.connections || []), el.dataset.source])];
    save();
    modal.close();
    render();
    toast("Demo setup saved. Live connection remains unavailable.");
  },
  github: () =>
    dialog(
      "Connect your project to GitHub",
      `<p>Choose where this project belongs. This is a simulated connection; no repository will be created.</p><form id="github-form"><label for="repo-name">Repository</label><input id="repo-name" required pattern="[\\w.\\-]+/[\\w.\\-]+" value="${esc(p.git.repo || "demo/" + slug(p.name))}" placeholder="owner/repository"><label for="branch">Working branch</label><input id="branch" required value="${esc(p.git.branch)}"><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Connect demo repository</button></div></form>`,
      null,
    ),
  branch: () =>
    dialog(
      "Work in a branch",
      `<form id="branch-form"><label for="new-branch">Branch name</label><input id="new-branch" required value="${esc(p.git.branch)}"><p class="footer-note">Updates this demo’s working-branch label. No remote branch is created.</p><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Use branch</button></div></form>`,
      null,
    ),
  check: () => {
    p.check = {
      revision: p.revision,
      result: p.source.trim()
        ? "Source text and behavior settings present"
        : "Source text missing",
    };
    save();
    render();
  },
  commit: () =>
    dialog(
      "Commit reviewed changes",
      `<p>Save a demo checkpoint for draft v${p.revision}. Review the changes before committing.</p><form id="commit-form"><label for="commit-message">Commit message</label><input id="commit-message" required value="Update ${esc(A().steps[1].toLowerCase())} behavior" style="width:100%"><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Commit locally in demo</button></div></form>`,
      null,
    ),
  sync: () => {
    p.git.syncedRevision = p.git.committedRevision;
    save();
    render();
    toast("Demo sync complete. No data was pushed to GitHub.");
  },
  publish: () => {
    if (p.stage !== "built")
      return dialog(
        "Try your app before publishing",
        `<p>Build the configured example first, then try an input it handles and one it cannot.</p>`,
        btn("Review plan", "publish-plan", "primary"),
      );
    const latest = p.releases.at(-1);
    const since = latest ? p.changes.filter((c) => c.revision > latest.revision) : [];
    dialog(
      latest ? "Publish an update" : "Publish a version people can use",
      `<h3>${esc(p.name)} · draft v${p.revision}</h3><div class="listrow"><strong>Environment</strong><span>Production · <code>${esc(appUrl())}</code></span></div><div class="listrow"><strong>Audience</strong><span>${p.settings.audience === "team" ? "Team sign-in" : "Anyone with the link"}</span></div><div class="listrow"><strong>Behavior</strong><span>${esc(summary(p.settings))}</span></div><div class="listrow"><strong>Knowledge</strong><span>${esc(p.sourceName)}</span></div>${latest ? `<div class="listrow"><strong>Since release ${latest.number}</strong><span>${since.length ? since.map((c) => esc(c.reason)).join(" · ") : "No recorded changes"}</span></div>` : ""}<div class="callout">Creates a saved release with a working recipient view in this browser. The production address is simulated; no external deployment occurs.</div><p class="footer-note">${p.sourceKind === "sample" ? "This release includes synthetic example content. " : ""}Framework: ${esc(p.settings.framework)} · ${esc(frameworkSetup(p).status)}.</p>`,
      btn("Keep editing", "close") + btn(latest ? "Publish update" : "Publish", "release", "primary"),
    );
  },
  "publish-plan": () => {
    modal.close();
    nav("plan");
  },
  release: () => {
    modal.close();
    startPublish();
  },
  rollback: (el) => {
    const r = p.releases.find((x) => x.id === el.dataset.id);
    if (!r) return;
    dialog(
      `Roll back to release ${r.number}?`,
      `<p>Your draft becomes a copy of release ${r.number} (${esc(describe(r))}) and a new release is published from it. Release ${p.releases.at(-1).number} stays in history.</p>`,
      btn("Cancel", "close") + btn("Roll back and publish", "rollback-confirm", "primary", `data-id="${r.id}"`),
    );
  },
  "rollback-confirm": (el) => {
    const r = p.releases.find((x) => x.id === el.dataset.id);
    const n = rollback(p, r);
    save();
    modal.close();
    previewResult = null;
    render();
    toast(`Rolled back. Release ${n.number} now serves the configuration of release ${r.number}.`);
  },
  "deploy-log": (el) => {
    const r = p.releases.find((x) => x.id === el.dataset.id);
    const t = new Date(r.at);
    const line = (s, msg) => `${new Date(t.getTime() + s * 1000).toLocaleTimeString()}  ${msg}`;
    dialog(
      `Deploy log · release ${r.number}`,
      `<pre class="codeblock">${esc([line(0, `Snapshot v${r.revision} frozen (${r.sourceName})`), line(1, `Access: ${r.settings.audience === "team" ? "team sign-in" : "anyone with the link"}`), line(2, `Agents: ${[A(r).agent.name, ...(r.agents || []).map((x) => x.name)].join(", ")} on ${r.settings.framework}`), line(3, `Tools: ${(r.tools || ["read_source"]).join(", ") || "none"} · assets prepared (simulated)`), line(4, `Release ${r.number} live at ${appUrl(r)} (simulated)`)].join("\n"))}</pre><p class="footer-note">Illustrative log. No external deployment ran.</p>`,
    );
  },
  "verify-domain": () => {
    p.domain.status = "verified";
    save();
    render();
    toast("Domain marked verified (demo). No DNS was checked.");
  },
  "remove-domain": () => {
    p.domain = null;
    save();
    render();
  },
  "add-env": () =>
    dialog(
      "Add an environment variable",
      `<form id="env-form"><label for="env-name">Name</label><input id="env-name" required placeholder="OPENAI_API_KEY" style="width:100%"><p class="footer-note">Only the name is stored. Do not paste real keys into this demo.</p><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Add</button></div></form>`,
      null,
    ),
  invite: () =>
    dialog(
      "Invite a member",
      `<form id="invite-form"><label for="invite-email">Email</label><input id="invite-email" type="email" required placeholder="teammate@company.com" style="width:100%"><label for="invite-role">Role</label><select id="invite-role"><option>Editor</option><option>Reviewer</option><option>App user</option></select><p class="footer-note">Demo invite. No email is sent. Reviewer access is read-only; App user only gets the released app.</p><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Send invite</button></div></form>`,
      null,
    ),
  archive: () =>
    dialog(
      "Archive this project?",
      `<p>${esc(p.name)} disappears from Home. Its releases stay available in this browser, and you can restore it from an export.</p>`,
      btn("Keep it", "close") + btn("Archive", "archive-confirm", "danger"),
    ),
  "archive-confirm": () => {
    p.archived = true;
    save();
    modal.close();
    act.home();
    toast("Project archived.");
  },
  "recipient-login": () => {
    sessionStorage.setItem("recipient-" + releaseId, "yes");
    render();
  },
  export: () => {
    downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }), slug(p.name) + ".json");
    toast("Downloaded your saved project configuration.");
  },
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el && !el.disabled) {
    e.preventDefault();
    act[el.dataset.action]?.(el);
  }
});
document.addEventListener("submit", (e) => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement)) return;
  e.preventDefault();
  const val = (id) => document.querySelector(id)?.value.trim() ?? "";
  if (f.id === "email-form") {
    auth.email = val("#email");
    auth.step = "sent";
    render();
    return;
  }
  if (f.id === "code-form") return finishSignIn("Email", auth.email);
  if (f.id === "shape-form") {
    const name = val("#shape-name");
    if (!name) return toast("Give your app a name.");
    create(false, {
      archetype: shape.archetype,
      name,
      audience: document.querySelector("#shape-audience").value,
    });
    return;
  }
  if (f.id === "chat-form") {
    const text = val("#chat-input");
    if (!text) return;
    const { change, rename } = chatIntent(text);
    p.chat.push({
      role: "user",
      text: (selection ? "[" + stepTitle(selection) + "] " : "") + text,
    });
    p.unsent = "";
    if (rename) {
      const old = p.name;
      p.name = rename;
      p.revision++;
      p.changes.push({ revision: p.revision, reason: "Renamed app to " + rename, at: new Date().toISOString() });
      p.chat.push({ role: "assistant", text: `Renamed ${old} to ${rename}. Existing releases keep their name.` });
    }
    if (change) {
      const next = { ...p.settings, ...change };
      if (JSON.stringify(next) === JSON.stringify(p.settings))
        p.chat.push({ role: "assistant", text: "That already matches the current setup: " + summary(p.settings) + "." });
      else {
        p.chat.push({ role: "assistant", text: "Here’s what I’d change: " + summary(next) + ". Review it before it applies." });
        save();
        render();
        propose(change);
        return;
      }
    } else if (!rename)
      p.chat.push({
        role: "assistant",
        text: `Saved as a request. In this prototype I can change ${A().settings.length.label.toLowerCase()}, what happens when there’s no answer, whether evidence is shown, the app name, appearance and audience. Try “shorter answers and show sources”.`,
      });
    save();
    render();
  }
  if (f.id === "behavior-form")
    propose({
      length: document.querySelector("#length").value,
      unknown: document.querySelector("#unknown").value,
      citations: document.querySelector("#citations").checked,
    });
  if (f.id === "name-form") {
    const name = val("#project-name");
    if (!name) return;
    p.name = name;
    p.revision++;
    p.changes.push({ revision: p.revision, reason: "Renamed app to " + name, at: new Date().toISOString() });
    save();
    render();
    toast("App name updated. Existing releases keep their name.");
  }
  if (f.id === "question-form") {
    previewQuestion = val("#question");
    recordPreview(previewQuestion);
    render();
  }
  if (f.id === "test-form") {
    testInput = val("#test-input");
    if (!testInput) return;
    const r = answer(p, testInput);
    const run = recordRun(p, testInput, r);
    testResult = { ...r, steps: run.steps };
    save();
    render();
  }
  if (f.id === "tools-form") {
    const tools = [...f.querySelectorAll("input[name=tool]:checked")].map((x) => x.value);
    if (setTools(p, tools)) {
      save();
      render();
      toast("Tools updated. Recorded in Changes and the generated agent file.");
    } else toast("Tools already match.");
  }
  if (f.id === "agent-form") {
    const entry = addAgent(p, {
      name: val("#agent-name"),
      responsibility: document.querySelector("#agent-job").value,
      trigger: document.querySelector("#agent-trigger").value,
    });
    save();
    modal.close();
    agentSel = entry.id;
    render();
    toast("Agent added. The handoff is now visible in Runs.");
  }
  if (f.id === "custom-agent-form") {
    const entry = addAgent(p, {
      name: val("#ca-name"),
      responsibility: val("#ca-job"),
      origin: `Custom · ${val("#ca-framework")}`,
      entry: val("#ca-entry"),
      status: "Not verified",
    });
    save();
    modal.close();
    agentSel = entry.id;
    render();
  }
  if (f.id === "env-form") {
    const name = addEnv(p, val("#env-name"));
    if (!name) return toast("Use a new, valid variable name.");
    save();
    modal.close();
    render();
    toast(`${name} added (name only).`);
  }
  if (f.id === "invite-form") {
    p.members ||= [{ name: db.account?.name || "Aman", email: db.account?.email || "aman@demo.architect", role: "Owner" }];
    p.members.push({ email: val("#invite-email"), role: document.querySelector("#invite-role").value, status: "Invited (demo)" });
    save();
    modal.close();
    render();
    toast("Invite recorded. No email is sent in this demo.");
  }
  if (f.id === "domain-form") {
    p.domain = { name: val("#domain").toLowerCase(), status: "pending" };
    save();
    render();
    toast("Domain added. Follow the CNAME instructions, then verify.");
  }
  if (f.id === "access-form") {
    settingsChange(p, { audience: document.querySelector("#audience").value }, "Updated app audience");
    save();
    modal.close();
    render();
  }
  if (f.id === "framework-form") {
    settingsChange(
      p,
      {
        framework: document.querySelector("#framework").value,
        model: document.querySelector("#model").value,
        customFramework: val("#custom-framework"),
      },
      "Updated agent setup",
    );
    save();
    render();
    toast("Setup saved. Generated agent file and variables updated.");
  }
  if (f.id === "source-form") {
    const text = val("#source-text"),
      name = val("#source-name");
    if (!text || !name) return toast("Add a source name and content.");
    recordSource(p, text, name);
    save();
    render();
    toast("Local source saved. Future answers use this content.");
  }
  if (f.id === "github-form") {
    p.git.connected = true;
    p.git.repo = val("#repo-name");
    p.git.branch = val("#branch");
    save();
    modal.close();
    render();
  }
  if (f.id === "branch-form") {
    p.git.branch = val("#new-branch");
    save();
    modal.close();
    render();
  }
  if (f.id === "commit-form") {
    p.git.committedRevision = p.revision;
    p.git.lastMessage = val("#commit-message");
    save();
    modal.close();
    render();
    toast("Demo commit saved. Sync is a separate action.");
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "zip-file") {
    const file = e.target.files[0];
    if (!file) return;
    importFlow.archive = { name: file.name, size: file.size };
    importFlow.repo = "northstar/support-app";
    runImportScan();
  }
  if (e.target.id === "import-branch" && importFlow) importFlow.branch = e.target.value;
});
function bind() {
  document.querySelector("#brief")?.addEventListener("input", (e) => {
    brief = e.target.value;
    sessionStorage.setItem("architect-draft-brief", brief);
  });
  document.querySelector("#shape-name")?.addEventListener("input", (e) => {
    shape.name = e.target.value;
    shape.autoNamed = false;
  });
  document
    .querySelector("#shape-audience")
    ?.addEventListener("change", (e) => (shape.audience = e.target.value));
  document.querySelector("#chat-input")?.addEventListener("input", (e) => {
    p.unsent = e.target.value;
    save();
  });
  document
    .querySelector("#source-file")
    ?.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 100000)
        return toast("Use a text file smaller than 100 KB.");
      document.querySelector("#source-text").value = await file.text();
      document.querySelector("#source-name").value = file.name;
      toast("Text loaded locally. Review it, then save.");
    });
}
const hash = location.hash.slice(1).split("/");
if (hash[0] && byId(hash[0])) {
  p = byId(hash[0]);
  view = [
    "plan",
    "app",
    "agents",
    "data",
    "code",
    "runs",
    "review",
    "deploy",
    "activity",
    "settings",
  ].includes(hash[1])
    ? hash[1]
    : "plan";
}
render();
