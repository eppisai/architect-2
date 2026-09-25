import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  settingsChange,
  undo,
  answer,
  publish,
  recordSource,
  pendingChanges,
} from "./model.mjs";
test("an accepted behavior edit affects both supported and unsupported answers; undo restores behavior", () => {
  const p = createProject("policy app");
  const original = answer(p, "leave");
  settingsChange(p, { length: "detailed", unknown: "ask" }, "Revise behavior");
  assert.match(answer(p, "leave").text, /based only/);
  assert.match(answer(p, "uncovered policy").text, /Which policy/);
  assert.equal(p.revision, 2);
  assert.equal(undo(p), true);
  assert.deepEqual(answer(p, "leave"), original);
  assert.equal(p.revision, 3);
});
test("release snapshots remain independent of later draft settings, sources and name", () => {
  const p = createProject("policy app");
  const r = publish(p);
  const before = JSON.stringify(r);
  settingsChange(
    p,
    { citations: false, theme: "ocean", audience: "public" },
    "New draft",
  );
  recordSource(p, "Leave policy: No carryover.", "Changed");
  p.name = "Changed name";
  assert.equal(JSON.stringify(r), before);
  assert.match(answer(r, "leave").text, /five/);
  assert.equal(answer(p, "leave").citation, null);
  assert.match(answer(p, "leave").text, /No carryover/);
});
test("source editing changes actual local example output without changing already published output", () => {
  const p = createProject("policy app");
  const r = publish(p);
  recordSource(
    p,
    "Equipment policy: Contact the local help desk.",
    "Local handbook",
  );
  assert.match(answer(p, "laptop").text, /local help desk/);
  assert.match(answer(r, "laptop").text, /IT service desk/);
  assert.equal(answer(p, "leave").supported, false);
});
test("unsupported questions never receive an unrelated policy answer", () => {
  const p = createProject("app");
  const a = answer(p, "Can I bring a dog?");
  assert.equal(a.supported, false);
  assert.equal(a.citation, null);
  assert.match(a.text, /couldn’t find/);
});
test("import keeps framework through unrelated behavior edit and undo", () => {
  const p = createProject("improve existing", true);
  settingsChange(p, { citations: false }, "Change citation display");
  assert.equal(p.settings.framework, "LangGraph");
  undo(p);
  assert.equal(p.settings.framework, "LangGraph");
  assert.equal(p.imported, true);
});
test("no-op edit does not invent a revision or undo entry", () => {
  const p = createProject("app");
  assert.equal(settingsChange(p, { length: "short" }, "No change"), false);
  assert.equal(p.revision, 1);
  assert.equal(p.history.length, 0);
});
test("custom entry-point edit is versioned and frozen into a release", () => {
  const p = createProject("custom agent", true);
  settingsChange(
    p,
    { framework: "Custom framework", customFramework: "agents/main.py" },
    "Custom setup",
  );
  const r = publish(p);
  settingsChange(p, { customFramework: "agents/next.py" }, "New entry point");
  assert.equal(p.revision, 3);
  assert.equal(r.settings.customFramework, "agents/main.py");
  assert.equal(p.settings.customFramework, "agents/next.py");
  undo(p);
  assert.equal(p.settings.customFramework, "agents/main.py");
});

test("unchanged new and imported projects have a reviewable initial snapshot to commit", () => {
  for (const imported of [false, true]) {
    const p = createProject("test", imported);
    assert.equal(pendingChanges(p).length, 1);
    assert.equal(pendingChanges(p)[0].revision, 1);
    p.git.committedRevision = p.revision;
    assert.equal(pendingChanges(p).length, 0);
  }
});

import { interpret, ARCHETYPES, parseTable } from "./model.mjs";

test("interpret reads a brief into a pattern, name and audience", () => {
  const k = interpret(
    "My team repeatedly asks questions about our internal policies. Build an app where they can ask a question, get an answer from our handbook, and see the source.",
  );
  assert.equal(k.archetype, "knowledge");
  assert.equal(k.name, "Policy Desk");
  assert.equal(k.audience, "team");
  const t = interpret(
    "Build a support triage app where customers describe a request, it gets routed to billing or engineering, and they can track it.",
  );
  assert.equal(t.archetype, "triage");
  assert.equal(t.name, "Request Triage");
  assert.equal(t.audience, "public");
  const i = interpret("Dashboard for weekly sales numbers by region");
  assert.equal(i.archetype, "insight");
  assert.equal(i.name, "Sales Insights");
  const none = interpret("Something completely different");
  assert.equal(none.archetype, "knowledge");
  assert.equal(none.confident, false);
});

test("a chosen pattern overrides the interpretation and drives the sample source", () => {
  const p = createProject("anything", false, {
    archetype: "triage",
    name: "Helpdesk",
    audience: "public",
  });
  assert.equal(p.archetype, "triage");
  assert.equal(p.name, "Helpdesk");
  assert.equal(p.settings.audience, "public");
  assert.equal(p.source, ARCHETYPES.triage.source.text);
});

test("triage sorts by rule keywords, marks urgency, and follows the unmatched setting", () => {
  const p = createProject("tickets", false, { archetype: "triage" });
  const a = answer(p, "I was charged twice for my subscription");
  assert.equal(a.supported, true);
  assert.equal(a.team, "Billing");
  assert.equal(a.priority, "Normal");
  assert.match(a.citation, /^Billing:/);
  const b = answer(p, "I can’t log in and it’s urgent");
  assert.equal(b.team, "Access");
  assert.equal(b.priority, "High");
  const none = answer(p, "Where can I park?");
  assert.equal(none.supported, false);
  assert.match(none.text, /sent to a person/);
  settingsChange(p, { unknown: "ask", length: "detailed" }, "x");
  assert.match(answer(p, "Where can I park?").text, /one more detail/);
  assert.match(answer(p, "refund please").text, /Suggested reply/);
});

test("insight ranks, totals and computes growth from the table, and hides rows when citations are off", () => {
  const p = createProject("sales", false, { archetype: "insight" });
  const g = answer(p, "Which region grew the most?");
  assert.match(g.text, /^West grew the most/);
  assert.equal(g.chart.highlight[0], "West");
  assert.match(answer(p, "Which region is highest?").text, /^North has the highest/);
  assert.match(answer(p, "What is the total revenue?").text, /Total Q2 revenue is 485/);
  assert.equal(answer(p, "What should we do next quarter?").supported, false);
  settingsChange(p, { citations: false }, "x");
  assert.equal(answer(p, "total").citation, null);
  assert.equal(parseTable("a,b\nx,1\nbad").data.length, 1);
});

test("releases keep their pattern so recipient views render the right app", () => {
  const p = createProject("sales", false, { archetype: "insight" });
  const r = publish(p);
  assert.equal(r.archetype, "insight");
  assert.match(answer(r, "total").text, /Total/);
});

import {
  chatIntent,
  recordRun,
  generateFiles,
  envVars,
  changedAreas,
  rollback,
  addAgent,
  setTools,
  addEnv,
  frameworkSetup,
} from "./model.mjs";
import { zipBytes } from "./zip.mjs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("chat intents map plain requests to reviewable setting changes", () => {
  assert.deepEqual(chatIntent("make the answers shorter and show sources").change, {
    length: "short",
    citations: true,
  });
  assert.deepEqual(chatIntent("ask a follow-up when unsure").change, { unknown: "ask" });
  assert.deepEqual(chatIntent("hide the sources").change, { citations: false });
  assert.deepEqual(chatIntent("open it to anyone").change, { audience: "public" });
  assert.equal(chatIntent("rename it to Help Hub").rename, "Help Hub");
  assert.equal(chatIntent("add a login page").change, null);
});

test("runs record a trace that reflects settings, matches and handoffs", () => {
  const p = createProject("policy app");
  const r = recordRun(p, "Can I carry over my leave?", answer(p, "Can I carry over my leave?"));
  assert.equal(r.supported, true);
  assert.match(r.steps[2], /Matched: Leave policy/);
  addAgent(p, { name: "Summarizer", responsibility: "Summarize the answer" });
  const r2 = recordRun(p, "dog", answer(p, "dog"));
  assert.match(r2.steps[2], /No match/);
  assert.match(r2.steps.at(-1), /Handoff → Summarizer/);
  assert.equal(p.runs.length, 2);
  assert.equal(p.runs[0].input, "dog");
});

test("generated files follow the framework, settings, source and pattern", () => {
  const p = createProject("sales", false, { archetype: "insight" });
  let paths = generateFiles(p).map((f) => f.path);
  assert.ok(paths.includes("agents/data_analyst.yaml"));
  assert.ok(paths.includes("data/example-sales-table.csv"));
  settingsChange(p, { framework: "LangGraph", model: "Anthropic · bring your key" }, "Updated agent setup");
  const files = generateFiles(p);
  paths = files.map((f) => f.path);
  assert.ok(paths.includes("agents/graph.py"));
  assert.match(files.find((f) => f.path === "agents/graph.py").text, /StateGraph/);
  assert.match(files.find((f) => f.path === ".env.example").text, /ANTHROPIC_API_KEY/);
  assert.match(files.find((f) => f.path === "agents/prompts/data_analyst.md").text, /Just the number/);
  assert.equal(frameworkSetup(p).status, "Needs credentials");
  settingsChange(p, { framework: "Custom framework", customFramework: "agents/ranker.py" }, "Updated agent setup");
  assert.ok(generateFiles(p).some((f) => f.path === "agents/ranker.py"));
  assert.equal(frameworkSetup(p).status, "Not verified");
});

test("changed areas track what a commit would touch", () => {
  const p = createProject("policy app");
  p.git.committedRevision = p.revision;
  assert.equal(changedAreas(p).size, 0);
  settingsChange(p, { length: "detailed" }, "Updated behavior");
  assert.deepEqual([...changedAreas(p)], ["config"]);
  recordSource(p, "Leave policy: none.", "Local");
  assert.ok(changedAreas(p).has("data"));
  setTools(p, ["read_source", "send_reply"]);
  assert.ok(changedAreas(p).has("agent"));
  assert.equal(addEnv(p, "my key"), "MY_KEY");
  assert.ok(envVars(p).some((v) => v.name === "MY_KEY" && v.status === "Set (demo)"));
});

test("rollback republishes an older release as a new release without losing history", () => {
  const p = createProject("policy app");
  const r1 = publish(p);
  settingsChange(p, { citations: false }, "Updated behavior");
  const r2 = publish(p);
  const r3 = rollback(p, r1);
  assert.equal(p.releases.length, 3);
  assert.equal(r3.number, 3);
  assert.equal(r3.settings.citations, true);
  assert.equal(r2.settings.citations, false);
  assert.equal(p.settings.citations, true);
  assert.match(p.changes.at(-1).reason, /Rolled back to release 1/);
});

test("the generated ZIP is a valid archive containing every file", () => {
  const p = createProject("policy app");
  const files = generateFiles(p);
  const bytes = zipBytes(files);
  const dir = mkdtempSync(join(tmpdir(), "architect-zip-"));
  const file = join(dir, "source.zip");
  writeFileSync(file, bytes);
  const listing = execFileSync("unzip", ["-l", file], { encoding: "utf8" });
  for (const f of files) assert.ok(listing.includes(f.path), f.path);
  execFileSync("unzip", ["-tq", file]);
});
