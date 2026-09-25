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
let p = null,
  view = "home",
  selection = "",
  chatOpen = false,
  proposal = null,
  buildStep = 0,
  buildTimer,
  previewQuestion = "",
  previewResult = null,
  showSource = false;
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
function toast(t) {
  const el = document.querySelector("#toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.style.display = "none"), 4000);
}
function dialog(title, body, actions = "") {
  modal.innerHTML = `<div class="row between"><h2>${title}</h2>${btn("×", "close", "quiet", 'aria-label="Close dialog"')}</div>${body}<div class="actions">${actions || btn("Close", "close")}</div>`;
  modal.showModal();
}
function summary(s) {
  return `${s.length === "short" ? "Short" : "Detailed"} answers · ${s.citations ? "sources visible" : "no source links"} · ${s.unknown === "ask" ? "ask a follow-up when unsure" : "explain when no answer is available"}`;
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
function disclosure() {
  return `<div class="prototype-note"><span>Interactive prototype · AI and external services are simulated</span>${btn("What works?", "about")}</div>`;
}
function top() {
  return `<header class="top"><div class="row">${btn('<span class="brand"><span class="brandmark">A</span>architect</span>', "home", "quiet")}${p && view !== "home" ? `<span class="muted">/</span><strong class="project-title">${esc(p.name)}</strong>` : ""}</div><div class="row">${p && view !== "home" ? `${tag(p.releases.length ? (p.releases.at(-1).revision === p.revision ? "Published snapshot" : "Unpublished changes") : "Draft", "blue")}${btn("Conversation", "toggle-chat", "small mobilechat")}${btn(p.stage === "built" ? "Publish" : "Build this version", p.stage === "built" ? "publish" : "build", "primary small", view === "building" ? "disabled" : "")}` : ""}<span class="account-icon" title="Demo workspace">${db.signedIn ? "AM" : "↗"}</span></div></header>${disclosure()}`;
}
function home() {
  return `${top()}<main class="welcome"><span class="tag blue">Your ideas, made useful</span><h1 style="margin-top:18px">What would you like<br>to build or improve?</h1><p class="muted">Start with what people need. We’ll shape the app, its agents, and how everything works together.</p><div class="promptbox"><label for="brief" class="sr">Describe your app</label><textarea id="brief">${esc(brief)}</textarea><div class="row between wrap"><div class="row">${btn("+ Reference", "reference", "quiet small")}${tag("Policy app example")}</div>${btn("Shape this idea ↗", "start", "primary")}</div></div><div class="examples">${btn("↥ Import a project", "import")}${btn("Explore examples", "examples", "quiet")}${btn("Help me choose", "consult", "quiet")}</div><p class="footer-note">This prototype uses a policy-app example. Your brief is saved; arbitrary app generation is not connected.</p>${db.projects.length ? `<section class="projects"><div class="row between"><h3>Your projects</h3><small>Saved on this browser</small></div>${db.projects.map((x) => `<div class="project-card"><div><h3>${esc(x.name)}</h3><small>${x.imported ? "Imported example · " : "From an idea · "}${x.stage === "built" ? "Preview ready" : "Plan in progress"} · v${x.revision}</small></div>${btn("Continue", "open", "small", `data-id="${x.id}"`)}</div>`).join("")}</section>` : ""}</main>`;
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
  return `<aside class="chat ${chatOpen ? "visible" : ""}" aria-label="Project conversation"><div class="chat-head row between"><h3>Build together</h3>${btn("Close", "toggle-chat", "small mobilechat")}</div><div class="messages">${p.chat
    .slice(-8)
    .map(
      (m) =>
        `<div class="message ${m.role}"><small>${m.role === "user" ? "You" : "Architect"}</small>${esc(m.text)}</div>`,
    )
    .join(
      "",
    )}${proposal ? `<div class="pending"><strong>Proposed change</strong><p>${esc(summary({ ...p.settings, ...proposal }))}</p>${btn("Review change", "review-proposal", "small")}</div>` : ""}</div><form class="chat-form" id="chat-form">${selection ? `<div class="context">Selected: ${esc(selection)} ${btn("×", "clear-select", "quiet small", 'aria-label="Clear selection"')}</div>` : ""}<div class="chips"><small>Try an example change</small><div class="row wrap" style="margin-top:7px">${btn(p.settings.length === "short" ? "More detail" : "Shorter answers", "suggest-short", "chip")}${btn(p.settings.unknown === "ask" ? "Explain gaps" : "Ask when unsure", "suggest-ask", "chip")}${!p.settings.citations ? btn("Show sources", "suggest-citations", "chip") : ""}</div></div><label class="sr" for="chat-input">Describe a change</label><textarea id="chat-input" placeholder="Describe a change to this step…">${esc(p.unsent || "")}</textarea><div class="row between"><small>Context stays with your project</small><button class="primary small" type="submit" aria-label="Save change request">↑</button></div></form></aside>`;
}
function plan() {
  return `<div class="canvas-head"><div class="row between"><span class="tag blue">Your first version</span>${btn("Undo last settings change", "undo", "quiet small", p.history.length ? "" : "disabled")}</div><h2 style="margin-top:16px">A clear answer. A source you can trust.</h2><p>Your teammates ask a question, get an answer from your handbook, and see where it came from.</p><details style="margin-top:8px;padding:10px 0"><summary>Your original idea</summary><p>${esc(p.brief)}</p></details></div><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">The experience, step by step</h3><small>Select a step to shape it</small></div><div class="plan-flow">${flowCard("Question", "1", "Ask a question", `<h4>${esc(p.name)}</h4><p>What would you like to know?</p><div class="mini-input">Can I carry over my leave?</div><span class="mini-action">Ask a question</span>`, "A simple starting point for your team.")}${flowCard("Answer", "2", "Get a useful answer", `<div class="mini-answer">${esc(answer(p, "leave").text)}${p.settings.citations ? '<span class="mini-link">↗ Leave policy</span>' : ""}</div><p style="margin:10px 0 0">${p.settings.unknown === "ask" ? "Ask a follow-up when unsure." : "Explain when the handbook has no answer."}</p>`, p.settings.length === "short" ? "Short answers, with room to go deeper." : "Detailed answers with supporting context.")}${flowCard("Source", "3", "Check the source", `<h4>${p.settings.citations ? "Supporting passage" : "Source links are off"}</h4><p class="source-quote">${esc(answer(p, "leave").citation || "No source passage is displayed for this answer.")}</p><span class="mini-link">${p.settings.citations ? "Inspect the policy text" : "Select to change citation behavior"}</span>`, p.settings.citations ? "Make every answer understandable." : "People cannot open a source from the answer.")}</div>${selection ? editor() : ""}<div class="decision-row"><div class="decision"><div class="row between"><h4>Who is this for?</h4>${btn("Change", "access", "quiet small")}</div><p>${p.settings.audience === "team" ? "Your team · sign-in required" : "Anyone with the link · no sign-in"}.</p></div><div class="decision"><div class="row between"><h4>What will it know?</h4>${btn("Manage", "nav", "quiet small", 'data-view="data"')}</div><p>${esc(p.sourceName)} · ${p.sourceKind === "sample" ? "example data" : "local text"}.</p></div></div>${p.imported ? `<div class="callout">Original import: React, team sign-in and ${esc(p.baselineFramework || "LangGraph")}. Current agent framework: ${esc(p.settings.framework)}. Setup changes are recorded in Changes.</div>` : ""}<details><summary>Agent, framework and technical details</summary><p>One Handbook assistant finds relevant policy passages, answers the question and explains gaps. Current setup: <strong>${esc(p.settings.framework)}</strong>.</p>${btn("Open agent setup", "nav", "small", 'data-view="agents"')}</details><div class="build-footer"><div><strong>You can change this as you go.</strong><p class="muted" style="font-size:13px;margin:5px 0">Example content is ready. Live integrations can be connected later.</p></div>${btn(p.stage === "built" ? "Try this version" : "Build this version", p.stage === "built" ? "preview" : "build", "primary")}</div>`;
}
function flowCard(target, n, title, visual, foot) {
  return `<section class="flow-card ${selection === target ? "selected" : ""}"><button data-action="select" data-target="${target}" aria-pressed="${selection === target}"><span class="stepnum">${n} / 3</span>${title} <span style="float:right;color:#8194ae">↗</span></button><div class="mini">${visual}</div><div class="flow-foot">${foot}</div></section>`;
}
function editor() {
  if (selection === "Question")
    return `<section class="editor"><div class="editor-top"><div><h3>Make the first impression yours</h3><p class="muted">The app name carries into preview and future releases.</p></div>${btn("Close", "clear-select", "quiet small")}</div><form id="name-form"><label for="project-name">App name</label><input id="project-name" required maxlength="50" value="${esc(p.name)}"> <button class="primary small">Save name</button></form></section>`;
  if (selection === "Source")
    return `<section class="editor"><div class="editor-top"><h3>Help people verify the answer</h3>${btn("Close", "clear-select", "quiet small")}</div><p>Show the supporting passage next to the answer. Current source: ${esc(p.sourceName)}.</p>${btn("Edit answer and citation behavior", "select", "small", 'data-target="Answer"')} ${btn("Open knowledge", "nav", "small", 'data-view="data"')}</section>`;
  return `<section class="editor"><div class="editor-top"><div><h3>How should the answer behave?</h3><p class="muted" style="font-size:13px">Powered by your Handbook assistant. Changes apply across the plan and app.</p></div>${btn("Close", "clear-select", "quiet small")}</div><form id="behavior-form"><div class="settings-grid"><div><label for="length">Answer length</label><select id="length"><option value="short" ${p.settings.length === "short" ? "selected" : ""}>Short and direct</option><option value="detailed" ${p.settings.length === "detailed" ? "selected" : ""}>Detailed with context</option></select></div><div><label for="unknown">When the handbook has no answer</label><select id="unknown"><option value="explain" ${p.settings.unknown === "explain" ? "selected" : ""}>Explain the gap and suggest the policy owner</option><option value="ask" ${p.settings.unknown === "ask" ? "selected" : ""}>Ask a follow-up question</option></select></div></div><label class="checkrow"><input type="checkbox" id="citations" ${p.settings.citations ? "checked" : ""}> Show supporting sources</label><div class="row between" style="margin-top:18px"><small>Review before applying. You can undo.</small><button class="primary small" type="submit">Review change</button></div></form></section>`;
}
function building() {
  const names = [
    ["Prepare the screens", "Question, answer and source views"],
    [
      "Wire the example workflow",
      "Use your current answer and source settings",
    ],
    ["Prepare the preview", "Make your configured example app available"],
  ];
  return `<div class="panel" style="max-width:760px;margin:35px auto"><span class="tag blue">Preparing your prototype</span><h2 style="margin-top:20px">Your plan is becoming an app.</h2><p class="muted">This local demonstration assembles the example screens and the choices you made.</p><ol class="progress-list">${names.map(([t, d], i) => `<li class="${i < buildStep ? "done" : i === buildStep ? "current" : ""}"><span class="progress-icon">${i < buildStep ? "✓" : i + 1}</span><div><strong>${t}</strong><small>${d}</small></div></li>`).join("")}</ol><div class="row between">${btn(buildStep >= 3 ? "Open your app" : "Pause build", buildStep >= 3 ? "preview" : "pause-build", buildStep >= 3 ? "primary" : "")}<small>No external build is running</small></div><div class="callout"><strong>While you wait</strong><p style="margin:5px 0">Try a question your handbook can answer—and one it cannot. Both are part of a useful app.</p></div></div>`;
}
function sampleApp(target = p, recipient = false) {
  const result = previewResult;
  return `<section class="sample-app ${target.settings.theme === "ocean" ? "ocean" : ""}"><header><strong>${esc(target.name)}</strong><small>${target.settings.audience === "team" ? "Team workspace" : "Open workspace"}</small></header><div class="app-content"><h2>What would you like to know?</h2><p>Ask about your policies. See the passage behind each answer.</p><form id="question-form"><label class="sr" for="question">Ask the handbook</label><textarea id="question" placeholder="Ask a question about your handbook…" required>${esc(previewQuestion)}</textarea><div class="row between" style="margin-top:10px"><small>Deterministic example · no live model</small><button class="primary small">Ask question</button></div></form><div class="row wrap" style="margin-top:15px">${btn("Carryover leave", "sample-question", "small", 'data-q="Can I carry over my leave?"')}${btn("Replacement laptop", "sample-question", "small", 'data-q="How do I request a replacement laptop?"')}${btn("Uncovered question", "sample-question", "small", 'data-q="Can I bring my dog to the office?"')}</div>${result ? `<div class="answer ${selection === "Answer" ? "selected-answer" : ""}"><div class="row between"><strong>${result.supported ? "From your handbook" : "No matching policy"}</strong>${!recipient ? btn("Edit behavior", "edit-behavior", "quiet small") : ""}</div><p style="margin-top:12px">${esc(result.text)}</p>${result.citation ? btn(showSource ? "Hide source" : "View supporting source", "citation", "quiet small") : ""}${showSource && result.citation ? `<div class="source-quote" style="margin-top:15px"><strong>${esc(target.sourceName)}</strong><p style="margin:8px 0">${esc(result.citation)}</p><small>${target.sourceKind === "sample" ? "Synthetic example policy" : "Local source text"}</small></div>` : ""}</div>` : ""}</div></section>`;
}
function preview() {
  if (p.stage !== "built")
    return `<div class="panel"><h2>Start with a version you understand.</h2><p>Review the plan, then build the interactive example.</p>${btn("Review the plan", "nav", "primary", 'data-view="plan"')}</div>`;
  return `<div class="canvas-head row between wrap"><div><h2>Your app, ready to try</h2><p style="margin:0">Try a question, inspect its source, then shape the behavior.</p></div><div class="row">${btn("Appearance", "appearance", "small")}${btn("Edit answer behavior", "edit-behavior", "small")}</div></div>${p.imported ? `<div class="callout">Imported example: React + existing sign-in + ${esc(p.baselineFramework || "LangGraph")}. Your original stack remains visible in agent setup.</div>` : ""}<div class="app-frame"><div class="frame-bar"><span>${esc(p.name)} / preview</span><span>Draft v${p.revision} · ${p.sourceKind === "sample" ? "Example data" : "Local data"}</span></div>${sampleApp()}</div>${selection === "Answer" ? editor() : ""}<p class="footer-note">Sample questions use keyword matching against local source text. This demonstrates the flow, not model quality.</p>`;
}
function agents() {
  return `<div class="canvas-head"><h2>Agents that do a clear job</h2><p>Start with what the app needs. Open implementation details when you need them.</p></div><div class="agent-layout"><div><button class="agent-item" data-action="edit-behavior"><strong>Handbook assistant</strong><small>Answers policy questions<br>Used by: Ask a question</small></button>${btn("+ Reuse an agent", "reuse", "quiet small", 'style="margin-top:15px"')}</div><div><div class="panel"><div class="row between"><h3>Handbook assistant</h3>${tag(p.settings.framework, "blue")}</div><p>Find a relevant passage, answer clearly, and explain when the handbook does not cover the question.</p><div class="listrow"><div><strong>Answer behavior</strong><p>${esc(summary(p.settings))}</p></div>${btn("Edit", "edit-behavior", "small")}</div><div class="listrow"><div><strong>Knowledge</strong><p>${esc(p.sourceName)} · ${p.sourceKind === "sample" ? "sample" : "local"}</p></div>${btn("Manage", "nav", "small", 'data-view="data"')}</div><div class="listrow"><div><strong>Used in your app</strong><p>Question form → answer card → source passage</p></div>${btn("Try it", "preview", "small")}</div></div>${selection === "Answer" ? editor() : ""}<div class="panel"><h3>Framework and model</h3><p class="muted">Keep your preferred stack. The prototype records this setup; it does not run these frameworks.</p><form id="framework-form"><label for="framework">Agent framework</label><select id="framework">${["Lyzr managed", "LangGraph", "CrewAI", "OpenAI Agents SDK", "Custom framework"].map((x) => `<option ${p.settings.framework === x ? "selected" : ""}>${x}</option>`).join("")}</select><label for="custom-framework">Custom framework or entry point (optional)</label><input id="custom-framework" value="${esc(p.settings.customFramework || "")}" placeholder="For example: agents/policy.py"><label for="model">Model configuration</label><select id="model">${["Managed default", "OpenAI · bring your key", "Anthropic · bring your key"].map((x) => `<option ${p.settings.model === x ? "selected" : ""}>${x}</option>`).join("")}</select><div style="margin-top:18px"><button class="primary small">Save setup</button></div></form><div class="callout">${p.settings.framework === "Lyzr managed" ? "Managed path: configure your agent and connect the source." : `Repository path: add a runtime, entry point and credentials for ${esc(p.settings.framework)}. Compatibility is unverified in this prototype.`}${p.imported ? ` Original import framework: ${esc(p.baselineFramework || "LangGraph")}.` : ""}</div></div></div></div>`;
}
function data() {
  return `<div class="canvas-head"><h2>Give your app something to know.</h2><p>Start with sample policies, or edit the local source. Keep data setup separate from the app’s appearance.</p></div><div class="panel"><div class="row between"><h3>${esc(p.sourceName)}</h3>${tag(p.sourceKind === "sample" ? "Sample content" : "Local content")}</div><form id="source-form"><label for="source-name">Source name</label><input id="source-name" required value="${esc(p.sourceName)}"><label for="source-text">Policy text</label><textarea id="source-text" rows="9">${esc(p.source)}</textarea><p class="footer-note">Example matching recognizes Leave policy, Equipment policy and Working hours headings. Other content is saved but has no model-powered search.</p><div class="row between wrap"><label class="quiet" style="margin:0">Import local .txt <input id="source-file" type="file" accept=".txt,text/plain" style="max-width:230px"></label><button class="primary small">Save source</button></div></form></div><div class="panel"><h3>Connect where your team works</h3>${["Google Drive", "SharePoint", "Confluence"].map((x) => `<div class="listrow"><div><strong>${x}</strong><p>${p.connections?.includes(x) ? "Demo setup saved · no live data access" : "Not connected"}</p></div>${btn(p.connections?.includes(x) ? "Review" : "Set up", "connect-source", "small", `data-source="${x}"`)}</div>`).join("")}</div>`;
}
function configDiff(before, after) {
  const labels = {
    length: "Answer length",
    unknown: "No-answer behavior",
    citations: "Show sources",
    audience: "App audience",
    framework: "Framework",
    model: "Model",
    customFramework: "Entry point",
    theme: "Theme",
  };
  return `<div class="diff"><div><strong>Before</strong>${Object.keys(after)
    .filter((k) => before[k] !== after[k])
    .map((k) => `<p>${labels[k] || k}: ${esc(before[k] ?? "Not set")}</p>`)
    .join("")}</div><div><strong>After</strong>${Object.keys(after)
    .filter((k) => before[k] !== after[k])
    .map((k) => `<p>${labels[k] || k}: ${esc(after[k] ?? "Not set")}</p>`)
    .join("")}</div></div>`;
}
function review() {
  const changes = pendingChanges(p);
  return `<div class="canvas-head"><h2>Understand what changed.</h2><p>Review the result, then decide what belongs in your repository.</p></div><div class="panel"><div class="row between"><h3>GitHub</h3>${tag(p.git.connected ? "Demo connection" : "Not connected", p.git.connected ? "good" : "")}</div>${p.git.connected ? `<div class="row between wrap"><div><strong>${esc(p.git.repo)}</strong><p class="muted">Branch: <code>${esc(p.git.branch)}</code></p></div>${btn("Change branch", "branch", "small")}</div><div class="row wrap">${tag("Working version " + p.revision)}${tag("Committed " + p.git.committedRevision)}${tag("Synced " + p.git.syncedRevision)}</div>` : `<p>Choose a repository and branch. This demonstration will show connection, commit and sync states without accessing GitHub.</p>${btn("Connect GitHub", "github", "primary small")}`}</div><div class="panel"><div class="row between"><h3>${changes.length ? "Changes to review" : "No uncommitted changes"}</h3>${p.history.length ? btn("Undo last settings change", "undo", "small") : ""}</div>${p.imported ? '<p class="muted">Preserved from import: React UI, existing sign-in and original framework baseline.</p>' : ""}${changes.length ? changes.map((c) => `<div class="sectionline"><strong>${esc(c.reason)}</strong><small> · v${c.revision}</small>${c.before ? `${configDiff(c.before, c.after)}` : ""}</div>`).join("") : '<p class="muted">The current configuration matches your latest local demo commit.</p>'}<details><summary>Configuration represented by this change</summary><pre class="codeblock">${esc(JSON.stringify(p.settings, null, 2))}</pre></details><div class="row wrap">${btn("Check this version", "check", "small")}${btn("Commit changes", "commit", "primary small", !p.git.connected || !changes.length ? "disabled" : "")}${btn("Sync to GitHub", "sync", "small", !p.git.connected || p.git.committedRevision <= p.git.syncedRevision ? "disabled" : "")}</div>${p.check ? `<p class="footer-note">Local configuration check v${p.check.revision}: ${esc(p.check.result)}${p.check.revision !== p.revision ? " · stale, run again for this draft" : ""}. No production tests executed.</p>` : ""}</div>`;
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
              `<div class="listrow"><div><strong>Release ${r.number} · draft v${r.revision}</strong><p>${esc(summary(r.settings))}</p></div><a target="_blank" rel="noopener" href="?release=${r.id}">Open app ↗</a></div>`,
          )
          .join("")
      : "<p>No releases yet. Publishing creates a working recipient view of this browser’s saved snapshot.</p>"
  }</div>`;
}
function settings() {
  return `<div class="canvas-head"><h2>Project settings</h2><p>Manage how this app looks, who it is for, and how you keep your work.</p></div><div class="panel"><div class="listrow"><div><strong>App access</strong><p>${p.settings.audience === "team" ? "Team members · sign-in required" : "Anyone with the link"}</p></div>${btn("Edit", "access", "small")}</div><div class="listrow"><div><strong>Appearance</strong><p>${p.settings.theme === "forest" ? "Forest" : "Ocean"} app theme</p></div>${btn("Change", "appearance", "small")}</div><div class="listrow"><div><strong>Project export</strong><p>Download actual saved configuration, history and source text as JSON.</p></div>${btn("Export project", "export", "small")}</div><div class="listrow"><div><strong>Workspace</strong><p>Demo account · local browser storage</p></div>${btn("Prototype details", "about", "small")}</div></div>`;
}
function recipientView() {
  let r;
  for (const project of db.projects) {
    r = project.releases.find((x) => x.id === releaseId);
    if (r) break;
  }
  if (!r) {
    app.innerHTML = `${disclosure()}<main class="recipient"><h1>This local release isn’t available here.</h1><p>Prototype releases are stored in the browser that created them. They are not public deployments.</p><a href="./">Open Architect</a></main>`;
    return;
  }
  p = r;
  if (
    r.settings.audience === "team" &&
    !sessionStorage.getItem("recipient-" + r.id)
  ) {
    app.innerHTML = `${disclosure()}<main class="recipient"><div class="panel"><span class="tag">${esc(r.name)}</span><h1 style="margin-top:24px">Your team’s handbook,<br>one question away.</h1><p>This release requires team sign-in. Enter as a sample employee to try the flow.</p>${btn("Continue as sample employee", "recipient-login", "primary")}<p class="footer-note">Demo access only. No real account or access protection.</p></div></main>`;
    return;
  }
  app.innerHTML = `${disclosure()}<main class="recipient"><div class="row between" style="margin-bottom:15px"><a href="./">← Back to Architect</a>${tag("Release " + r.number + " · v" + r.revision)}</div><div class="app-frame">${sampleApp(r, true)}</div><p class="footer-note">Saved release snapshot. Later draft edits do not change this version. Local to this browser.</p></main>`;
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
  const next = { ...p.settings, ...proposal };
  dialog(
    "Review the behavior change",
    `<p>The same choice will update your plan, preview and Handbook assistant.</p><div class="diff"><div><strong>Current</strong>${esc(summary(p.settings))}</div><div><strong>Proposed</strong>${esc(summary(next))}</div></div><h4>When the handbook has no answer</h4><p>${esc(answer({ ...p, settings: next }, "dog policy").text)}</p>`,
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
function create(imported = false) {
  p = createProject(brief, imported);
  if (imported) {
    p.baselineFramework = "LangGraph";
    p.settings.length = "detailed";
    p.settings.citations = false;
    p.importedAt = new Date().toISOString();
  }
  db.projects.unshift(p);
  save();
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
    proposal = null;
    selection = "";
    previewQuestion = "";
    previewResult = null;
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
      `<p><strong>Real, local interactions:</strong> saved projects, plan edits, undo, source-text editing, answer examples, revision history, configuration export and immutable release snapshots.</p><p><strong>Simulated services:</strong> sign-in, AI generation, repository import, agent runtimes, GitHub sync and deployment. No credentials are requested or sent.</p><p>Three sample question topics use keyword matching; other questions demonstrate the no-answer path. Local releases are available only in this browser.</p>`,
    ),
  start: () => {
    brief = document.querySelector("#brief").value.trim();
    sessionStorage.setItem("architect-draft-brief", brief);
    if (!brief) return toast("Describe what you want to build first.");
    if (!db.signedIn) return needAccount("demo-start");
    dialog(
      "Use this idea in the working example",
      `<p>Your brief will be saved exactly as written.</p><p>This prototype demonstrates a policy app with configurable behavior. It does not generate an arbitrary app from the prompt.</p>`,
      btn("Keep editing", "close") +
        btn("Continue with policy example", "create", "primary"),
    );
  },
  "demo-start": () => {
    db.signedIn = true;
    save();
    modal.close();
    create();
  },
  create: () => {
    modal.close();
    create();
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
      `<div class="panel"><h3>Policy assistant</h3><p>Turn your handbook into answers people can verify.</p>${btn("Use this example", "use-example", "primary small")}</div><p class="muted">More examples are outside this prototype’s current scope.</p>`,
    ),
  "use-example": () => {
    brief =
      "Build an internal policy assistant that answers from our handbook and shows the source.";
    sessionStorage.setItem("architect-draft-brief", brief);
    modal.close();
    render();
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
      `<p>Source text can be edited or imported as a local .txt file once the project opens. No documents are sent to a model.</p><p>For the demo, begin with the included sample handbook, then open Knowledge to change it.</p>`,
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
    const changed = settingsChange(p, proposal, "Updated answer behavior");
    proposal = null;
    modal.close();
    if (changed) {
      p.chat.push({
        role: "assistant",
        text:
          "Plan, preview and agent instructions updated. " +
          summary(p.settings),
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
      `<p>Choose an existing agent from Lyzr Studio, where agents are configured and tested.</p><div class="panel"><strong>Example policy assistant</strong><p>Reads approved sources and answers policy questions.</p>${tag("Demo catalog entry")}</div><p>This prototype uses the existing Handbook assistant. It does not access a Studio account or import a second agent.</p>`,
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
      `<p>Choose which documents the agent can read. A real connection would request access before reading any content.</p><label for="source-scope">Example folder or collection</label><input id="source-scope" placeholder="Company handbook"><p class="footer-note">Demo setup only. No account is connected or content retrieved.</p>`,
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
      `<p>Choose where this project belongs. This is a simulated connection; no repository will be created.</p><form id="github-form"><label for="repo-name">Repository</label><input id="repo-name" required pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" value="${esc(p.git.repo || "demo/policydesk")}" placeholder="owner/repository"><label for="branch">Working branch</label><input id="branch" required value="${esc(p.git.branch)}"><div class="actions"><button class="primary">Connect demo repository</button></div></form>`,
    ),
  branch: () =>
    dialog(
      "Work in a branch",
      `<form id="branch-form"><label for="new-branch">Branch name</label><input id="new-branch" required value="${esc(p.git.branch)}"><p class="footer-note">Updates this demo’s working-branch label. No remote branch is created.</p><div class="actions"><button class="primary">Use branch</button></div></form>`,
    ),
  check: () => {
    p.check = {
      revision: p.revision,
      result: p.source.trim()
        ? "Source text and answer settings present"
        : "Source text missing",
    };
    save();
    render();
  },
  commit: () =>
    dialog(
      "Commit reviewed changes",
      `<p>Save a demo checkpoint for draft v${p.revision}. Review the changes before committing.</p><form id="commit-form"><label for="commit-message">Commit message</label><input id="commit-message" required value="Update policy answer experience" style="width:100%"><div class="actions"><button class="primary">Commit locally in demo</button></div></form>`,
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
        `<p>Build the configured example first, then try its answer and no-answer paths.</p>`,
        btn("Review plan", "publish-plan", "primary"),
      );
    dialog(
      "Publish a version people can use",
      `<h3>${esc(p.name)} · draft v${p.revision}</h3><div class="listrow"><strong>Audience</strong><span>${p.settings.audience === "team" ? "Team sign-in" : "Anyone with the link"}</span></div><div class="listrow"><strong>Answer behavior</strong><span>${p.settings.length === "short" ? "Short answers" : "Detailed answers"}</span></div><div class="listrow"><strong>Knowledge</strong><span>${esc(p.sourceName)}</span></div><div class="callout">Creates a saved local release with a working recipient view. It is available only in this browser; no external deployment occurs.</div><p class="footer-note">${p.sourceKind === "sample" ? "This release includes synthetic example policies." : ""} Current framework: ${esc(p.settings.framework)}. External runtime is simulated.</p>`,
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
      `<span class="tag good">Release ${r.number} · v${r.revision}</span><h3 style="margin-top:18px">Try it as a teammate.</h3><p>The released behavior and source are saved as a snapshot. Further edits remain in your draft.</p><a class="primary" style="display:inline-block;text-decoration:none;border-radius:7px;padding:10px 16px" target="_blank" rel="noopener" href="?release=${r.id}">Open released app ↗</a><p class="footer-note">Local browser link, not a public live URL. Real hosting remains a submission task.</p>`,
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
  if (f.id === "chat-form") {
    const input = document.querySelector("#chat-input"),
      text = input.value.trim();
    if (!text) return;
    p.chat.push(
      { role: "user", text: (selection ? "[" + selection + "] " : "") + text },
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
    if (!text || !name) return toast("Add a source name and policy text.");
    recordSource(p, text, name);
    save();
    render();
    toast("Local source saved. Future answers use this text.");
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
