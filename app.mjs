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
} from "./model.mjs";
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
  readTimer;
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
function toast(t) {
  const el = document.querySelector("#toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.style.display = "none"), 4000);
}
function dialog(title, body, actions = "") {
  modal.innerHTML = `<div class="row between"><h2>${title}</h2>${btn("×", "close", "quiet", 'aria-label="Close dialog"')}</div>${body}${actions === null ? "" : `<div class="actions">${actions || btn("Close", "close")}</div>`}`;
  modal.showModal();
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
  render();
  window.scrollTo({ top: 0 });
  if (p) history.replaceState(null, "", `#${p.id}/${view}`);
}
function openProject(id, to) {
  proposal = null;
  previewQuestion = "";
  showSource = false;
  chatOpen = false;
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
function top() {
  return `<header class="top"><div class="row">${btn('<span class="brand"><span class="brandmark">A</span>architect</span>', "home", "quiet")}${p && view !== "home" ? `<span class="muted">/</span><strong class="project-title">${esc(p.name)}</strong>` : ""}</div><div class="row">${p && view !== "home" ? `${tag(p.releases.length ? (p.releases.at(-1).revision === p.revision ? "Published snapshot" : "Unpublished changes") : "Draft", "blue")}${btn("Conversation", "toggle-chat", "small mobilechat")}${btn(p.stage === "built" ? "Publish" : "Build this version", p.stage === "built" ? "publish" : "build", "primary small", view === "building" ? "disabled" : "")}` : ""}${protoTag()}<span class="account-icon" title="Demo workspace">${db.signedIn ? "AM" : "↗"}</span></div></header>`;
}
function home() {
  return `${top()}<main class="welcome"><span class="tag blue">Your ideas, made useful</span><h1 style="margin-top:18px">What would you like<br>to build or improve?</h1><p class="muted">Start with what people need. We’ll shape the app, its agents, and how everything works together.</p><div class="promptbox"><label for="brief" class="sr">Describe your app</label><textarea id="brief">${esc(brief)}</textarea><div class="row between wrap"><div class="row">${btn("+ Reference", "reference", "quiet small")}${tag("Example brief")}</div>${btn("Shape this idea ↗", "start", "primary")}</div></div><div class="examples">${btn("↥ Import a project", "import")}${btn("Explore examples", "examples", "quiet")}${btn("Help me choose", "consult", "quiet")}</div><p class="footer-note">Your brief is read into one of three starting patterns you can change. No model is called in this prototype.</p>${db.projects.length ? `<section class="projects"><div class="row between"><h3>Your projects</h3><small>Saved on this browser</small></div>${db.projects.map((x) => `<div class="project-card"><div><h3>${esc(x.name)}</h3><small>${x.imported ? "Imported example · " : `${A(x).label} · `}${x.stage === "built" ? "Preview ready" : "Plan in progress"} · v${x.revision}</small></div>${btn("Continue", "open", "small", `data-id="${x.id}"`)}</div>`).join("")}</section>` : ""}</main>`;
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
const destinations = [
  ["plan", "◇", "Plan"],
  ["app", "▣", "App"],
  ["agents", "⌘", "Agents"],
  ["data", "▤", "Knowledge"],
  ["review", "⑂", "Changes"],
  ["activity", "◷", "Activity"],
];
function side() {
  return `<nav class="sidebar" aria-label="Project navigation">${destinations.map(([v, i, t]) => btn(`<span class="navicon">${i}</span>${t}`, "nav", v === view ? "active" : "", `data-view="${v}" ${v === view ? 'aria-current="page"' : ""}`)).join("")}<div class="spacer"></div>${btn('<span class="navicon">⚙</span>Project settings', "nav", "secondary", `data-view="settings"`)}${btn('<span class="navicon">←</span>All projects', "home", "secondary")}</nav>`;
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
    )}${proposal ? `<div class="pending"><strong>Proposed change</strong><p>${esc(summary({ ...s, ...proposal }))}</p>${btn("Review change", "review-proposal", "small")}</div>` : ""}</div><form class="chat-form" id="chat-form">${selection ? `<div class="context">Selected: ${esc(stepTitle(selection))} ${btn("×", "clear-select", "quiet small", 'aria-label="Clear selection"')}</div>` : ""}<div class="chips"><small>Try an example change</small><div class="row wrap" style="margin-top:7px">${btn(s.length === "short" ? "More detail" : "Less detail", "suggest-short", "chip")}${btn(cap(a.bits.unknown[s.unknown === "ask" ? "explain" : "ask"]), "suggest-ask", "chip")}${!s.citations ? btn(a.settings.citations, "suggest-citations", "chip") : ""}</div></div><label class="sr" for="chat-input">Describe a change</label><textarea id="chat-input" placeholder="Describe a change to this step…">${esc(p.unsent || "")}</textarea><div class="row between"><small>Context stays with your project</small><button class="primary small" type="submit" aria-label="Save change request">↑</button></div></form></aside>`;
}
const slots = ["Question", "Answer", "Source"];
const stepTitle = (slot) => A().steps[slots.indexOf(slot)] || slot;
function plan() {
  const a = A(),
    s = p.settings,
    who = people(s),
    sample = a.chips[0][1],
    res = answer(p, sample);
  return `<div class="canvas-head"><div class="row between"><span class="tag blue">${p.imported ? "Imported project" : "Your first version"}</span>${btn("Undo last settings change", "undo", "quiet small", p.history.length ? "" : "disabled")}</div><h2 style="margin-top:16px">${a.headline}</h2><p>${a.promise(who, a.material)}</p><details style="margin-top:8px;padding:10px 0"><summary>${p.imported ? "Import notes" : "Your original idea"}</summary><p>${p.imported ? `Imported as a React app with team sign-in and a ${esc(p.baselineFramework || "LangGraph")} workflow. Baseline behavior: detailed answers, no source links.` : esc(p.brief)}</p></details></div><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">The experience, step by step</h3><small>Select a step to shape it</small></div><div class="plan-flow">${flowCard("Question", "1", a.steps[0], `<h4>${esc(p.name)}</h4><p>${a.app.h2}</p><div class="mini-input">${esc(sample)}</div><span class="mini-action">${a.app.button}</span>`, a.foot1(who))}${flowCard("Answer", "2", a.steps[1], `<div class="mini-answer">${res.team ? `<div class="mini-status">${esc(res.team)} · ${esc(res.priority)} priority</div>` : ""}${esc(res.text)}${s.citations && res.citation ? `<span class="mini-link">↗ ${esc(a.evidenceLabel(res))}</span>` : ""}</div><p style="margin:10px 0 0">${cap(a.bits.unknown[s.unknown])}.</p>`, a.foot2[s.length])}${flowCard("Source", "3", a.steps[2], `${a.id === "triage" ? `<div class="mini-status">Received ✓ · Sorted${res.team ? " to " + esc(res.team) : ""} ✓ · Reply drafted</div>` : ""}<h4>${s.citations ? a.app.evidence : a.app.evidenceOff}</h4><p class="source-quote" style="white-space:pre-line">${esc(res.citation || "No supporting detail is displayed for this answer.")}</p><span class="mini-link">${s.citations ? a.app.inspect : "Select to change this"}</span>`, a.foot3[s.citations])}</div>${selection ? editor() : ""}<div class="decision-row"><div class="decision"><div class="row between"><h4>Who is this for?</h4>${btn("Change", "access", "quiet small")}</div><p>${s.audience === "team" ? "Your team · sign-in required" : "Anyone with the link · no sign-in"}.</p></div><div class="decision"><div class="row between"><h4>What will it know?</h4>${btn("Manage", "nav", "quiet small", 'data-view="data"')}</div><p>${esc(p.sourceName)} · ${p.sourceKind === "sample" ? "example data" : "local text"}.</p></div></div>${p.imported ? `<div class="callout">Original import: React, team sign-in and ${esc(p.baselineFramework || "LangGraph")}. Current agent framework: ${esc(s.framework)}. Setup changes are recorded in Changes.</div>` : ""}<details><summary>Agent, framework and technical details</summary><p>One ${a.agent.name} ${a.agent.does.charAt(0).toLowerCase() + a.agent.does.slice(1)} Current setup: <strong>${esc(s.framework)}</strong>.</p>${btn("Open agent setup", "nav", "small", 'data-view="agents"')}</details><div class="build-footer"><div><strong>You can change this as you go.</strong><p class="muted" style="font-size:13px;margin:5px 0">Example content is ready. Live integrations can be connected later.</p></div>${btn(p.stage === "built" ? "Try this version" : "Build this version", p.stage === "built" ? "preview" : "build", "primary")}</div>`;
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
  return `<section class="editor"><div class="editor-top"><div><h3>How should ${a.steps[1].toLowerCase()} behave?</h3><p class="muted" style="font-size:13px">Powered by your ${a.agent.name}. Changes apply across the plan and app.</p></div>${btn("Close", "clear-select", "quiet small")}</div><form id="behavior-form"><div class="settings-grid"><div><label for="length">${L.length.label}</label>${select("length", L.length)}</div><div><label for="unknown">${L.unknown.label}</label>${select("unknown", L.unknown)}</div></div><label class="checkrow"><input type="checkbox" id="citations" ${s.citations ? "checked" : ""}> ${L.citations}</label><div class="row between" style="margin-top:18px"><small>Review before applying. You can undo.</small><button class="primary small" type="submit">Review change</button></div></form></section>`;
}
function building() {
  const a = A();
  const names = [
    ["Prepare the screens", a.steps.join(", ") + " views"],
    ["Wire the example workflow", `Connect your ${a.agent.name} with the current settings`],
    ["Prepare the preview", "Make your configured example app available"],
  ];
  return `<div class="panel" style="max-width:760px;margin:35px auto"><span class="tag blue">Preparing your prototype</span><h2 style="margin-top:20px">Your plan is becoming an app.</h2><p class="muted">This local demonstration assembles the example screens and the choices you made.</p><ol class="progress-list">${names.map(([t, d], i) => `<li class="${i < buildStep ? "done" : i === buildStep ? "current" : ""}"><span class="progress-icon">${i < buildStep ? "✓" : i + 1}</span><div><strong>${t}</strong><small>${esc(d)}</small></div></li>`).join("")}</ol><div class="row between">${btn(buildStep >= 3 ? "Open your app" : "Pause build", buildStep >= 3 ? "preview" : "pause-build", buildStep >= 3 ? "primary" : "")}<small>No external build is running</small></div><div class="callout"><strong>While you wait</strong><p style="margin:5px 0">Try an input your app can handle, and one it cannot. Both are part of a useful app.</p></div></div>`;
}
function chart(c) {
  const max = Math.max(...c.data.map((d) => d.values.at(-1)), 1);
  return `<div class="bars">${c.data.map((d) => `<div class="bar-row ${c.highlight.includes(d.label) ? "hi" : ""}"><span>${esc(d.label)}</span><div class="bar"><i style="width:${Math.round((d.values.at(-1) / max) * 100)}%"></i></div><b>${d.values.at(-1)}</b></div>`).join("")}<small>${esc(c.header.at(-1))}</small></div>`;
}
function resultCard(target, a, r, recipient) {
  return `<div class="answer ${selection === "Answer" ? "selected-answer" : ""}"><div class="row between"><strong>${r.supported ? a.app.found : a.app.missing}</strong>${!recipient ? btn("Edit behavior", "edit-behavior", "quiet small") : ""}</div>${r.team ? `<div class="row" style="margin-top:10px">${tag(r.team, "blue")}${tag(r.priority + " priority", r.priority === "High" ? "warn" : "")}</div>` : ""}<p style="margin-top:12px">${esc(r.text)}</p>${r.chart ? chart(r.chart) : ""}${r.citation ? btn(showSource ? "Hide" : a.app.view, "citation", "quiet small") : ""}${showSource && r.citation ? `<div class="source-quote" style="margin-top:15px"><strong>${esc(target.sourceName)}</strong><p style="margin:8px 0;white-space:pre-line">${esc(r.citation)}</p><small>${target.sourceKind === "sample" ? "Synthetic example content" : "Local source text"}</small></div>` : ""}</div>`;
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
  return `<div class="canvas-head row between wrap"><div><h2>Your app, ready to try</h2><p style="margin:0">Try it, inspect what it used, then shape the behavior.</p></div><div class="row">${btn("Appearance", "appearance", "small")}${btn("Edit behavior", "edit-behavior", "small")}</div></div>${p.imported ? `<div class="callout">Imported example: React + existing sign-in + ${esc(p.baselineFramework || "LangGraph")}. Your original stack remains visible in agent setup.</div>` : ""}<div class="app-frame"><div class="frame-bar"><span>${esc(p.name)} / preview</span><span>Draft v${p.revision} · ${p.sourceKind === "sample" ? "Example data" : "Local data"}</span></div>${sampleApp()}</div>${selection === "Answer" ? editor() : ""}<p class="footer-note">Sample inputs use keyword matching against local source text. This demonstrates the flow, not model quality.</p>`;
}
function agents() {
  const a = A(),
    s = p.settings;
  return `<div class="canvas-head"><h2>Agents that do a clear job</h2><p>Start with what the app needs. Open implementation details when you need them.</p></div><div class="agent-layout"><div><button class="agent-item" data-action="edit-behavior"><strong>${a.agent.name}</strong><small>${a.agent.job}<br>Used by: ${a.steps[0]}</small></button>${btn("+ Reuse an agent", "reuse", "quiet small", 'style="margin-top:15px"')}</div><div><div class="panel"><div class="row between"><h3>${a.agent.name}</h3>${tag(s.framework, "blue")}</div><p>${a.agent.does}</p><div class="listrow"><div><strong>Behavior</strong><p>${esc(summary(s))}</p></div>${btn("Edit", "edit-behavior", "small")}</div><div class="listrow"><div><strong>Knowledge</strong><p>${esc(p.sourceName)} · ${p.sourceKind === "sample" ? "sample" : "local"}</p></div>${btn("Manage", "nav", "small", 'data-view="data"')}</div><div class="listrow"><div><strong>Used in your app</strong><p>${a.agent.used}</p></div>${btn("Try it", "preview", "small")}</div></div>${selection === "Answer" ? editor() : ""}<div class="panel"><h3>Framework and model</h3><p class="muted">Keep your preferred stack. The prototype records this setup; it does not run these frameworks.</p><form id="framework-form"><label for="framework">Agent framework</label><select id="framework">${["Lyzr managed", "LangGraph", "CrewAI", "OpenAI Agents SDK", "Custom framework"].map((x) => `<option ${s.framework === x ? "selected" : ""}>${x}</option>`).join("")}</select><label for="custom-framework">Custom framework or entry point (optional)</label><input id="custom-framework" value="${esc(s.customFramework || "")}" placeholder="For example: agents/policy.py"><label for="model">Model configuration</label><select id="model">${["Managed default", "OpenAI · bring your key", "Anthropic · bring your key"].map((x) => `<option ${s.model === x ? "selected" : ""}>${x}</option>`).join("")}</select><div style="margin-top:18px"><button class="primary small">Save setup</button></div></form><div class="callout">${s.framework === "Lyzr managed" ? "Managed path: configure your agent and connect the source." : `Repository path: add a runtime, entry point and credentials for ${esc(s.framework)}. Compatibility is unverified in this prototype.`}${p.imported ? ` Original import framework: ${esc(p.baselineFramework || "LangGraph")}.` : ""}</div></div></div></div>`;
}
function data() {
  const a = A();
  return `<div class="canvas-head"><h2>Give your app something to know.</h2><p>Start with sample content, or edit the local source. Keep data setup separate from the app’s appearance.</p></div><div class="panel"><div class="row between"><h3>${esc(p.sourceName)}</h3>${tag(p.sourceKind === "sample" ? "Sample content" : "Local content")}</div><form id="source-form"><label for="source-name">Source name</label><input id="source-name" required value="${esc(p.sourceName)}"><label for="source-text">${a.source.label}</label><textarea id="source-text" rows="9">${esc(p.source)}</textarea><p class="footer-note">${a.source.hint}</p><div class="row between wrap"><label class="quiet" style="margin:0">Import local .txt or .csv <input id="source-file" type="file" accept=".txt,.csv,text/plain,text/csv" style="max-width:230px"></label><button class="primary small">Save source</button></div></form></div><div class="panel"><h3>Connect where your ${people(p.settings) === "customers" ? "data lives" : "team works"}</h3>${a.source.connectors.map((x) => `<div class="listrow"><div><strong>${x}</strong><p>${p.connections?.includes(x) ? "Demo setup saved · no live data access" : "Not connected"}</p></div>${btn(p.connections?.includes(x) ? "Review" : "Set up", "connect-source", "small", `data-source="${x}"`)}</div>`).join("")}</div>`;
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
  const changes = pendingChanges(p);
  return `<div class="canvas-head"><h2>Understand what changed.</h2><p>Review the result, then decide what belongs in your repository.</p></div><div class="panel"><div class="row between"><h3>GitHub</h3>${tag(p.git.connected ? "Demo connection" : "Not connected", p.git.connected ? "good" : "")}</div>${p.git.connected ? `<div class="row between wrap"><div><strong>${esc(p.git.repo)}</strong><p class="muted">Branch: <code>${esc(p.git.branch)}</code></p></div>${btn("Change branch", "branch", "small")}</div><div class="row wrap">${tag("Working version " + p.revision)}${tag("Committed " + p.git.committedRevision)}${tag("Synced " + p.git.syncedRevision)}</div>` : `<p>Choose a repository and branch. This demonstration will show connection, commit and sync states without accessing GitHub.</p>${btn("Connect GitHub", "github", "primary small")}`}</div><div class="panel"><div class="row between"><h3>${changes.length ? "Changes to review" : "No uncommitted changes"}</h3>${p.history.length ? btn("Undo last settings change", "undo", "small") : ""}</div>${p.imported ? '<p class="muted">Preserved from import: React UI, existing sign-in and original framework baseline.</p>' : ""}${changes.length ? changes.map((c) => `<div class="sectionline"><strong>${esc(c.reason)}</strong><small> · v${c.revision}</small>${c.before ? `${configDiff(c.before, c.after)}` : ""}</div>`).join("") : '<p class="muted">The current configuration matches your latest local demo commit.</p>'}<details><summary>Configuration represented by this change</summary><pre class="codeblock">${esc(JSON.stringify({ archetype: p.archetype, ...p.settings }, null, 2))}</pre></details><div class="row wrap">${btn("Check this version", "check", "small")}${btn("Commit changes", "commit", "primary small", !p.git.connected || !changes.length ? "disabled" : "")}${btn("Sync to GitHub", "sync", "small", !p.git.connected || p.git.committedRevision <= p.git.syncedRevision ? "disabled" : "")}</div>${p.check ? `<p class="footer-note">Local configuration check v${p.check.revision}: ${esc(p.check.result)}${p.check.revision !== p.revision ? " · stale, run again for this draft" : ""}. No production tests executed.</p>` : ""}</div>`;
}
function activity() {
  return `<div class="canvas-head"><h2>Your project’s story</h2><p>Every revision remains understandable. Published versions stay separate from your draft.</p></div><div class="panel"><h3>Draft changes</h3>${
    p.changes.length
      ? p.changes
          .slice()
          .reverse()
          .map(
            (c) =>
              `<div class="listrow"><div><strong>${esc(c.reason)}</strong><p>${new Date(c.at).toLocaleString()}</p></div>${tag("v" + c.revision)}</div>`,
          )
          .join("")
      : "<p>No changes yet. Select a plan step to begin.</p>"
  }</div><div class="panel releases"><h3>Released snapshots</h3>${
    p.releases.length
      ? p.releases
          .slice()
          .reverse()
          .map(
            (r) =>
              `<div class="listrow"><div><strong>Release ${r.number} · draft v${r.revision}</strong><p>${esc(describe(r))}</p></div><a target="_blank" rel="noopener" href="?release=${r.id}">Open app ↗</a></div>`,
          )
          .join("")
      : "<p>No releases yet. Publishing creates a working recipient view of this browser’s saved snapshot.</p>"
  }</div>`;
}
function settings() {
  return `<div class="canvas-head"><h2>Project settings</h2><p>Manage how this app looks, who it is for, and how you keep your work.</p></div><div class="panel"><div class="listrow"><div><strong>App access</strong><p>${p.settings.audience === "team" ? "Team members · sign-in required" : "Anyone with the link"}</p></div>${btn("Edit", "access", "small")}</div><div class="listrow"><div><strong>Appearance</strong><p>${p.settings.theme === "forest" ? "Forest" : "Ocean"} app theme</p></div>${btn("Change", "appearance", "small")}</div><div class="listrow"><div><strong>Starting pattern</strong><p>${A().label} · chosen when the idea was shaped</p></div>${tag(A().agent.name)}</div><div class="listrow"><div><strong>Project export</strong><p>Download actual saved configuration, history and source text as JSON.</p></div>${btn("Export project", "export", "small")}</div><div class="listrow"><div><strong>Workspace</strong><p>Demo account · local browser storage</p></div>${btn("Prototype details", "about", "small")}</div></div>`;
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
  } else if (view === "reading") {
    p = null;
    app.innerHTML = reading();
  } else if (view === "shape") {
    p = null;
    app.innerHTML = shapeView();
  } else {
    app.innerHTML = `${top()}<div class="workspace">${side()}${chat()}<main class="canvas" id="main">${view === "plan" ? plan() : view === "building" ? building() : view === "app" ? preview() : view === "agents" ? agents() : view === "data" ? data() : view === "review" ? review() : view === "activity" ? activity() : settings()}</main></div>`;
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
    "Review the behavior change",
    `<p>The same choice will update your plan, preview and ${a.agent.name}.</p><div class="diff"><div><strong>Current</strong>${esc(summary(p.settings))}</div><div><strong>Proposed</strong>${esc(summary(next))}</div></div><h4>${a.settings.unknown.label}</h4><p>${esc(answer({ ...p, settings: next }, a.unmatched).text)}</p>`,
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
function startShaping() {
  const read = interpret(brief);
  shape = {
    brief,
    archetype: read.archetype,
    name: read.name,
    audience: read.audience,
    autoNamed: true,
  };
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
  p = createProject(brief, imported, opts);
  if (imported) {
    p.baselineFramework = "LangGraph";
    p.settings.length = "detailed";
    p.settings.citations = false;
    p.importedAt = new Date().toISOString();
  }
  db.projects.unshift(p);
  save();
  shape = null;
  openProject(p.id, imported ? "app" : "plan");
}
function needAccount(next) {
  dialog(
    "Keep your idea and keep going",
    `<p>Use the demo workspace to try the full flow. Your brief stays with you.</p><div class="stack">${btn("Continue with Google", "provider")}${btn("Continue with GitHub", "provider")}${btn("Continue with email", "provider")}</div><p class="footer-note">Live account providers are not connected. The demo saves projects locally.</p>`,
    btn("Continue in demo workspace", next, "primary"),
  );
}
const act = {
  home: () => {
    clearInterval(buildTimer);
    clearInterval(readTimer);
    proposal = null;
    selection = "";
    previewQuestion = "";
    previewResult = null;
    shape = null;
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
      `<p><strong>Real, local interactions:</strong> brief interpretation into three starting patterns, saved projects, plan edits, undo, source-text editing, deterministic example answers, revision history, configuration export and immutable release snapshots.</p><p><strong>Simulated services:</strong> sign-in, AI generation, repository import, agent runtimes, GitHub sync and deployment. No credentials are requested or sent.</p><p>Each pattern uses keyword matching against local source text; other inputs demonstrate the no-answer path. Local releases are available only in this browser.</p>`,
    ),
  start: () => {
    brief = document.querySelector("#brief")?.value.trim() ?? brief;
    sessionStorage.setItem("architect-draft-brief", brief);
    if (!brief) return toast("Describe what you want to build first.");
    if (!db.signedIn) return needAccount("demo-start");
    startShaping();
  },
  "demo-start": () => {
    db.signedIn = true;
    save();
    modal.close();
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
  provider: () =>
    toast("Live sign-in is not connected. Continue in the demo workspace."),
  import: () => {
    dialog(
      "Continue an existing project",
      `<p>Choose how you would bring your work into Architect.</p><div class="stack">${btn("Connect a GitHub repository", "import-github")}${btn("Import a ZIP or codebase", "import-zip")}</div><div class="callout"><strong>Try the imported-project example</strong><p>Northstar Support: an existing React app, team sign-in and LangGraph workflow. Inspect it before changing it.</p></div>`,
      btn("Inspect sample project", "inspect-import", "primary"),
    );
  },
  "import-github": () =>
    dialog(
      "Import from GitHub",
      `<label for="repo-url">Repository URL</label><input id="repo-url" placeholder="https://github.com/team/project" style="width:100%"><p class="footer-note">Demo form only. No GitHub access is requested.</p><div class="callout">The working example uses Northstar Support. Your original branch, authentication and framework are shown before changes.</div>`,
      btn("Inspect sample project", "inspect-import", "primary"),
    ),
  "import-zip": () =>
    dialog(
      "Import a codebase",
      `<p>In the proposed flow, select a ZIP, inspect detected frameworks and start commands, then confirm what to preserve.</p><p>No ZIP importer is connected in this prototype. Use the imported example to try the continuation flow.</p>`,
      btn("Inspect sample project", "inspect-import", "primary"),
    ),
  "inspect-import": () =>
    dialog(
      "Understand before changing",
      `<div class="listrow"><strong>App</strong><span>Northstar Support · React</span></div><div class="listrow"><strong>Agent framework</strong><span>LangGraph</span></div><div class="listrow"><strong>Keep intact</strong><span>Team sign-in and app structure</span></div><div class="listrow"><strong>Current behavior</strong><span>Detailed answers · no source links</span></div><div class="callout">Suggested first change: add supporting sources. This is a prepared fixture, not a repository scan.</div>`,
      btn("Continue with this project", "create-import", "primary"),
    ),
  "create-import": () => {
    db.signedIn = true;
    modal.close();
    create(true);
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
    if (!db.signedIn) {
      render();
      return needAccount("demo-start");
    }
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
        text: `Plan, preview and ${A().agent.name} updated. ` + summary(p.settings),
      });
      save();
      previewResult = null;
      render();
      toast("Behavior updated across your project.");
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
    previewResult = answer(p, previewQuestion);
    showSource = false;
    render();
  },
  citation: () => {
    showSource = !showSource;
    render();
  },
  access: () =>
    dialog(
      "Who should use this app?",
      `<form id="access-form"><label for="audience">App audience</label><select id="audience"><option value="team" ${p.settings.audience === "team" ? "selected" : ""}>Invited teammates · sign-in required</option><option value="public" ${p.settings.audience === "public" ? "selected" : ""}>Anyone with the link</option></select><p class="footer-note">The recipient demo will show the selected entry flow. This is not real access control.</p><div class="actions"><button class="primary">Save audience</button></div></form>`,
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
  reuse: () =>
    dialog(
      "Reuse an agent you already have",
      `<p>Choose an existing agent from Lyzr Studio, where agents are configured and tested.</p><div class="panel"><strong>Example policy assistant</strong><p>Reads approved sources and answers policy questions.</p>${tag("Demo catalog entry")}</div><p>This prototype uses the existing ${A().agent.name}. It does not access a Studio account or import a second agent.</p>`,
      btn("Inspect current agent", "reuse-current", "primary"),
    ),
  "reuse-current": () => {
    modal.close();
    nav("agents");
  },
  "connect-source": (el) => {
    const source = el.dataset.source;
    dialog(
      `Set up ${esc(source)}`,
      `<p>Choose which content the agent can read. A real connection would request access before reading anything.</p><label for="source-scope">Example folder, table or collection</label><input id="source-scope" placeholder="Company handbook"><p class="footer-note">Demo setup only. No account is connected or content retrieved.</p>`,
      btn(
        "Save demo setup",
        "save-connection",
        "primary",
        `data-source="${source}"`,
      ),
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
      `<p>Choose where this project belongs. This is a simulated connection; no repository will be created.</p><form id="github-form"><label for="repo-name">Repository</label><input id="repo-name" required pattern="[\\w.\\-]+/[\\w.\\-]+" value="${esc(p.git.repo || "demo/" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}" placeholder="owner/repository"><label for="branch">Working branch</label><input id="branch" required value="${esc(p.git.branch)}"><div class="actions">${btn("Cancel", "close", "quiet")}<button class="primary">Connect demo repository</button></div></form>`,
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
    dialog(
      "Publish a version people can use",
      `<h3>${esc(p.name)} · draft v${p.revision}</h3><div class="listrow"><strong>Audience</strong><span>${p.settings.audience === "team" ? "Team sign-in" : "Anyone with the link"}</span></div><div class="listrow"><strong>Behavior</strong><span>${esc(summary(p.settings))}</span></div><div class="listrow"><strong>Knowledge</strong><span>${esc(p.sourceName)}</span></div><div class="callout">Creates a saved local release with a working recipient view. It is available only in this browser; no external deployment occurs.</div><p class="footer-note">${p.sourceKind === "sample" ? "This release includes synthetic example content." : ""} Current framework: ${esc(p.settings.framework)}. External runtime is simulated.</p>`,
      btn("Keep editing", "close") +
        btn("Create demo release", "release", "primary"),
    );
  },
  "publish-plan": () => {
    modal.close();
    nav("plan");
  },
  release: () => {
    const r = publish(p);
    save();
    modal.close();
    render();
    dialog(
      "Your demo release is ready",
      `<span class="tag good">Release ${r.number} · v${r.revision}</span><h3 style="margin-top:18px">Try it as a ${people(p.settings) === "customers" ? "visitor" : "teammate"}.</h3><p>The released behavior and source are saved as a snapshot. Further edits remain in your draft.</p><a class="primary" style="display:inline-block;text-decoration:none;border-radius:7px;padding:10px 16px" target="_blank" rel="noopener" href="?release=${r.id}">Open released app ↗</a><p class="footer-note">Local browser link, not a public live URL. Real hosting remains a submission task.</p>`,
      btn("View release history", "release-history"),
    );
  },
  "release-history": () => {
    modal.close();
    nav("activity");
  },
  "recipient-login": () => {
    sessionStorage.setItem("recipient-" + releaseId, "yes");
    render();
  },
  export: () => {
    const blob = new Blob([JSON.stringify(p, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
  if (f.id === "shape-form") {
    const name = document.querySelector("#shape-name").value.trim();
    if (!name) return toast("Give your app a name.");
    create(false, {
      archetype: shape.archetype,
      name,
      audience: document.querySelector("#shape-audience").value,
    });
    return;
  }
  if (f.id === "chat-form") {
    const input = document.querySelector("#chat-input"),
      text = input.value.trim();
    if (!text) return;
    p.chat.push(
      {
        role: "user",
        text: (selection ? "[" + stepTitle(selection) + "] " : "") + text,
      },
      {
        role: "assistant",
        text:
          "Request saved with this project" +
          (selection ? " and selected step" : "") +
          ". This prototype demonstrates the example changes below. Use a suggested change or edit behavior directly.",
      },
    );
    p.unsent = "";
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
    const name = document.querySelector("#project-name").value.trim();
    if (!name) return;
    p.name = name;
    p.revision++;
    p.changes.push({
      revision: p.revision,
      reason: "Renamed app to " + name,
      at: new Date().toISOString(),
    });
    save();
    render();
    toast("App name updated. Existing releases keep their name.");
  }
  if (f.id === "question-form") {
    previewQuestion = document.querySelector("#question").value.trim();
    previewResult = answer(p, previewQuestion);
    showSource = false;
    render();
  }
  if (f.id === "access-form") {
    settingsChange(
      p,
      { audience: document.querySelector("#audience").value },
      "Updated app audience",
    );
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
        customFramework: document.querySelector("#custom-framework").value,
      },
      "Updated agent setup",
    );
    save();
    render();
    toast("Setup saved. Runtime compatibility remains unverified.");
  }
  if (f.id === "source-form") {
    const text = document.querySelector("#source-text").value.trim(),
      name = document.querySelector("#source-name").value.trim();
    if (!text || !name) return toast("Add a source name and content.");
    recordSource(p, text, name);
    save();
    render();
    toast("Local source saved. Future answers use this content.");
  }
  if (f.id === "github-form") {
    p.git.connected = true;
    p.git.repo = document.querySelector("#repo-name").value;
    p.git.branch = document.querySelector("#branch").value;
    save();
    modal.close();
    render();
  }
  if (f.id === "branch-form") {
    p.git.branch = document.querySelector("#new-branch").value;
    save();
    modal.close();
    render();
  }
  if (f.id === "commit-form") {
    p.git.committedRevision = p.revision;
    p.git.lastMessage = document.querySelector("#commit-message").value;
    save();
    modal.close();
    render();
    toast("Demo commit saved. Sync is a separate action.");
  }
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
    "review",
    "activity",
    "settings",
  ].includes(hash[1])
    ? hash[1]
    : "plan";
}
render();
