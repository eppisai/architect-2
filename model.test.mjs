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

import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

test("disabling source access blocks answers everywhere and shows in the trace", () => {
  const p = createProject("policy app");
  setTools(p, []);
  const r = answer(p, "Can I carry over my leave?");
  assert.equal(r.supported, false);
  assert.equal(r.blocked, true);
  assert.equal(r.citation, null);
  const run = recordRun(p, "leave", r);
  assert.match(run.steps[1], /disabled/);
  setTools(p, ["read_source"]);
  assert.equal(answer(p, "Can I carry over my leave?").supported, true);
});

test("releases snapshot agents and tools, and rollback restores them", () => {
  const p = createProject("policy app");
  addAgent(p, { name: "Summarizer", responsibility: "Summarize the answer" });
  setTools(p, ["read_source", "send_reply"]);
  const r1 = publish(p);
  assert.equal(r1.agents.length, 1);
  assert.deepEqual(r1.tools, ["read_source", "send_reply"]);
  addAgent(p, { name: "Router", responsibility: "Escalate to a person" });
  setTools(p, ["read_source"]);
  publish(p);
  assert.equal(p.releases.at(-1).agents.length, 2);
  rollback(p, r1);
  assert.equal(p.agents.length, 1);
  assert.equal(p.agents[0].name, "Summarizer");
  assert.deepEqual(p.tools, ["read_source", "send_reply"]);
  assert.equal(p.releases.at(-1).agents.length, 1);
});

test("the exported project runs: its API answers and its own tests pass for every pattern", () => {
  for (const archetype of Object.keys(ARCHETYPES)) {
    const p = createProject("x", false, { archetype });
    const dir = mkdtempSync(join(tmpdir(), "architect-export-"));
    for (const f of generateFiles(p)) {
      mkdirSync(join(dir, dirname(f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.text);
    }
    for (const required of ["package.json", "server.mjs", "api/ask.mjs", `app/theme-${p.settings.theme}.css`])
      assert.ok(existsSync(join(dir, required)), required);
    const askUrl = pathToFileURL(join(dir, "api/ask.mjs")).href;
    const q = JSON.stringify(ARCHETYPES[archetype].chips[0][1]);
    const out = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", `import(${JSON.stringify(askUrl)}).then(async (m) => console.log(JSON.stringify(await m.ask(${q}))))`],
      { encoding: "utf8", cwd: dir },
    );
    assert.equal(JSON.parse(out).supported, true, archetype);
    // An inherited test context makes Node skip this independent test suite.
    const testEnv = { ...process.env };
    delete testEnv.NODE_TEST_CONTEXT;
    const testOutput = execFileSync(process.execPath, ["--test", "--test-reporter=tap"], {
      cwd: dir,
      encoding: "utf8",
      env: testEnv,
    });
    assert.match(testOutput, /# tests 3\b/, archetype);
    assert.match(testOutput, /# pass 3\b/, archetype);
  }
});

import {
  DOMAINS,
  packFor,
  detectOps,
  applyOps,
  restoreVersion,
  runChecks,
  describeOp,
  normalize,
  THEMES,
} from "./model.mjs";

test("any prompt gets a name from its own words and sample content in its own subject", () => {
  const gym = interpret("a CRM for my gym");
  assert.equal(gym.name, "Gym CRM");
  assert.equal(gym.domain, "fitness");
  assert.equal(interpret("an expense tracker for my team").name, "Expense Tracker");
  assert.equal(interpret("a booking app for my restaurant").archetype, "triage");
  const p = createProject("a CRM for my gym");
  assert.match(p.source, /^Billing:/m);
  assert.match(p.source, /^Membership:/m);
  assert.equal(p.chips.length, 3);
  const k = createProject("an assistant that answers questions for our dental clinic patients");
  assert.equal(k.archetype, "knowledge");
  assert.match(answer(k, "Can I move my appointment?").text, /Book or move appointments/);
});

test("every domain pack's sample questions behave: two answered, one not, for all three engines", () => {
  for (const domain of Object.keys(DOMAINS))
    for (const archetype of Object.keys(ARCHETYPES)) {
      const p = createProject("x", false, { archetype, domain });
      const pk = packFor(domain, archetype);
      assert.equal(p.source, pk.text);
      const c = runChecks(p);
      assert.equal(c.passed, 3, `${domain}/${archetype}: ${JSON.stringify(c.results)}`);
    }
});

test("what the first prompt asks for is part of the first version", () => {
  const p = createProject(
    "A help desk where employees ask HR policy questions, get answers with sources, and anything unclear goes to HR on Slack.",
  );
  assert.equal(p.name, "Policy Desk");
  assert.equal(p.agents.length, 1);
  assert.equal(p.agents[0].channel, "Slack");
  assert.equal(p.revision, 1);
  assert.equal(p.versions.length, 1);
  const dark = createProject("a dark mode FAQ bot with feedback buttons and Google sign-in for our store");
  assert.equal(dark.settings.theme, "dark");
  assert.equal(dark.settings.feedback, true);
  assert.equal(dark.settings.signin, "Google");
  assert.equal(dark.settings.audience, "team");
});

test("free-form chat requests become real changes with the files they touch", () => {
  const p = createProject("policy app");
  const { ops } = detectOps(p, "add a dark mode and a feedback button under each answer");
  assert.equal(ops.length, 1);
  assert.deepEqual(ops[0].change, { theme: "dark", feedback: true });
  const { files, version } = applyOps(p, ops);
  assert.equal(p.settings.theme, "dark");
  assert.ok(files.some((f) => f.path === "app/theme-dark.css" && f.status === "A"));
  assert.ok(files.some((f) => f.path === "app/app.js" && f.status === "M" && f.add > 0));
  assert.equal(version.n, 2);
  assert.ok(changedAreas(p).has("app"));
  const page = detectOps(p, "add a leaderboard page").ops;
  assert.equal(page[0].type, "page");
  assert.equal(page[0].page.name, "Leaderboard");
  applyOps(p, page);
  assert.ok(p.pages.some((x) => x.name === "Leaderboard"));
  assert.match(generateFiles(p).find((f) => f.path === "app/index.html").text, /Leaderboard/);
  const tone = detectOps(p, "make the agent friendlier and answer in Spanish").ops;
  assert.deepEqual(tone.map((o) => o.type), ["instructions", "instructions"]);
  applyOps(p, tone);
  assert.match(generateFiles(p).find((f) => f.path.startsWith("agents/prompts/")).text, /Reply in Spanish/);
  assert.equal(detectOps(p, "rename it to Help Hub").ops[0].name, "Help Hub");
  assert.equal(detectOps(p, "change the headline to Ask HR anything").ops[0].value, "Ask HR anything");
  assert.equal(detectOps(p, "add a login page").ops[0].change.signin, "Email link");
  assert.equal(detectOps(p, "make it more fun somehow").ops.length, 0);
  assert.equal(detectOps(p, "undo that").undo, true);
  assert.match(describeOp(p, ops[0]), /Dark theme/);
});

test("restoring a version brings back the whole app state and is itself a new version", () => {
  const p = createProject("policy app");
  const first = p.versions[0];
  applyOps(p, detectOps(p, "add a dark mode, a pricing page and rename it to Help Hub").ops);
  assert.equal(p.name, "Help Hub");
  assert.equal(p.settings.theme, "dark");
  const { version } = restoreVersion(p, first.id);
  assert.equal(p.name, "Policy Desk");
  assert.equal(p.settings.theme, "forest");
  assert.ok(!p.pages.some((x) => x.name === "Pricing"));
  assert.equal(version.n, 3);
  assert.match(p.changes.at(-1).reason, /Restored version 1/);
});

test("releases keep pages, copy and sample questions; rollback restores them", () => {
  const p = createProject("a CRM for my gym");
  const r1 = publish(p);
  applyOps(p, detectOps(p, "add a pricing page and change the headline to Hi there").ops);
  assert.equal(r1.pages.length, 2);
  assert.equal(r1.copy.h2, ARCHETYPES.triage.app.h2);
  rollback(p, r1);
  assert.equal(p.pages.length, 2);
  assert.equal(p.copy.h2, ARCHETYPES.triage.app.h2);
});

test("projects saved by the earlier version are upgraded in place", () => {
  const old = createProject("policy app");
  for (const k of ["chips", "copy", "pages", "instructions", "versions", "domain"]) delete old[k];
  delete old.settings.feedback;
  normalize(old);
  assert.equal(old.pages[0].kind, "home");
  assert.equal(old.versions.length, 1);
  assert.equal(old.settings.feedback, false);
  assert.ok(THEMES[old.settings.theme]);
});

test("an exported project from a domain pack still runs its own tests", () => {
  for (const [domain, archetype] of [["fitness", "triage"], ["clinic", "knowledge"], ["finance", "insight"]]) {
    const p = createProject("x", false, { archetype, domain });
    applyOps(p, detectOps(p, "add a dark mode and feedback buttons").ops);
    const dir = mkdtempSync(join(tmpdir(), "architect-domain-"));
    for (const f of generateFiles(p)) {
      mkdirSync(join(dir, dirname(f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.text);
    }
    const testEnv = { ...process.env };
    delete testEnv.NODE_TEST_CONTEXT;
    const out = execFileSync(process.execPath, ["--test", "--test-reporter=tap"], { cwd: dir, encoding: "utf8", env: testEnv });
    assert.match(out, /# pass 3\b/, `${domain}/${archetype}`);
  }
});

import {
  configOps,
  editFile,
  dataPath,
  lineDiff,
  runTests,
  suggestFixes,
  startBranch,
  branchSummary,
  openPullRequest,
  mergePullRequest,
  filesAt,
} from "./model.mjs";

test("editing architect.json changes the project, and bad values are refused with a reason", () => {
  const p = createProject("policy app");
  const cfg = JSON.parse(generateFiles(p).find((f) => f.path === "architect.json").text);
  cfg.theme = "plum";
  cfg.agent.behavior.length = "detailed";
  cfg.name = "Help Hub";
  const { ops } = configOps(p, JSON.stringify(cfg));
  applyOps(p, ops);
  assert.equal(p.settings.theme, "plum");
  assert.equal(p.settings.length, "detailed");
  assert.equal(p.name, "Help Hub");
  assert.match(configOps(p, "{ nope").error, /isn’t valid JSON/);
  cfg.theme = "neon";
  assert.match(configOps(p, JSON.stringify(cfg)).error, /Unknown theme “neon”.*forest/);
});

test("editing the data file changes answers; other files are kept as your edits and exported", () => {
  const p = createProject("policy app");
  const path = dataPath(p);
  applyOps(p, editFile(p, path, "Leave policy: No carryover this year.\n").ops);
  assert.match(answer(p, "Can I carry over my leave?").text, /No carryover/);
  applyOps(p, editFile(p, "app/app.js", "console.log('mine');").ops);
  const f = generateFiles(p).find((x) => x.path === "app/app.js");
  assert.equal(f.text, "console.log('mine');");
  assert.equal(f.edited, true);
});

test("tests catch a broken data edit and a syntax error, and suggest fixes that work", () => {
  const p = createProject("policy app");
  assert.equal(runTests(p).failed, 0);
  applyOps(p, editFile(p, dataPath(p), "Working hours: Core hours are 10 to 3.").ops);
  let report = runTests(p);
  assert.equal(report.failed, 2);
  const fixes = suggestFixes(p, report);
  assert.match(fixes[0].label, /Restore Example handbook from version 1/);
  applyOps(p, fixes[0].ops);
  assert.equal(runTests(p).failed, 0);
  applyOps(p, editFile(p, "app/app.js", "const x = ;").ops);
  report = runTests(p);
  assert.ok(report.results.some((r) => /app\/app.js has valid syntax/.test(r.name) && !r.ok && /SyntaxError/.test(r.detail)));
  applyOps(p, suggestFixes(p, report).find((f) => /Revert app\/app.js/.test(f.label)).ops);
  assert.equal(runTests(p).failed, 0);
});

test("line diffs mark added and removed lines", () => {
  const d = lineDiff(["a", "b", "c"], ["a", "x", "c", "d"]);
  assert.deepEqual(d.map((x) => x.t + x.text), ["=a", "-b", "+x", "=c", "+d"]);
});

test("a branch collects versions until its pull request is merged into main", () => {
  const p = createProject("policy app");
  startBranch(p, "architect/dark-mode");
  applyOps(p, detectOps(p, "add a dark mode").ops);
  const sum = branchSummary(p);
  assert.equal(sum.versions.length, 1);
  assert.ok(sum.files.some((f) => f.path === "app/theme-dark.css"));
  assert.equal(filesAt(p, sum.from).some((f) => f.path === "app/theme-dark.css"), false);
  const pr = openPullRequest(p, "Dark mode", "");
  assert.equal(pr.number, 12);
  mergePullRequest(p);
  assert.equal(p.git.branch, "main");
  assert.equal(branchSummary(p), null);
  assert.equal(p.pr.state, "merged");
});

test("restoring an unedited version clears overrides and added files, including legacy snapshots", () => {
  for (const legacy of [false, true]) {
    const p = createProject("policy app");
    const first = p.versions[0];
    if (legacy) delete first.state.fileEdits;
    const original = generateFiles(p);
    applyOps(p, editFile(p, "app/app.js", "const broken = ;").ops);
    applyOps(p, editFile(p, "app/extra.js", "const extra = true;").ops);
    assert.ok(runTests(p).failed > 0);
    restoreVersion(p, first.id);
    assert.deepEqual(generateFiles(p), original);
    assert.equal(runTests(p).failed, 0);
  }
});

test("restoring edited versions keeps independent copies of the saved code", () => {
  const p = createProject("policy app");
  const path = "app/app.js";
  const saved = applyOps(p, editFile(p, path, "// version A").ops).version;
  applyOps(p, editFile(p, path, "// version B").ops);
  restoreVersion(p, saved.id);
  assert.equal(generateFiles(p).find((f) => f.path === path).text, "// version A");
  p.fileEdits[path] = "// later edit";
  assert.equal(saved.state.fileEdits[path], "// version A");
});

test("release rollback restores manual code and removes overrides absent from older releases", () => {
  const p = createProject("policy app");
  const path = "app/app.js";
  const original = generateFiles(p).find((f) => f.path === path).text;
  const legacy = publish(p);
  delete legacy.fileEdits;
  applyOps(p, editFile(p, path, "// release A").ops);
  const releaseA = publish(p);
  p.fileEdits[path] = "// draft B";
  applyOps(p, editFile(p, "app/extra.js", "// new file").ops);
  assert.equal(releaseA.fileEdits[path], "// release A");
  const restored = rollback(p, releaseA);
  assert.equal(generateFiles(p).find((f) => f.path === path).text, "// release A");
  assert.equal(generateFiles(p).some((f) => f.path === "app/extra.js"), false);
  assert.deepEqual(restored.fileEdits, releaseA.fileEdits);
  p.fileEdits[path] = "// another edit";
  assert.equal(restored.fileEdits[path], "// release A");
  rollback(p, legacy);
  assert.equal(generateFiles(p).find((f) => f.path === path).text, original);
  assert.deepEqual(p.fileEdits, {});
});

test("invalid configuration shapes return actionable errors without changing the project", () => {
  const p = createProject("policy app");
  const before = JSON.stringify(p);
  for (const value of [null, [], "config", 42, false]) {
    assert.match(configOps(p, JSON.stringify(value)).error, /must contain a JSON object/);
  }
  for (const value of [{ agent: null }, { ui: [] }, { agent: { behavior: "short" } }]) {
    assert.match(configOps(p, JSON.stringify(value)).error, /must be a JSON object/);
  }
  assert.match(configOps(p, '{"ui":{"feedback":"false"}}').error, /must be true or false/);
  assert.match(configOps(p, '{"agent":{"tools":"read_source"}}').error, /array of tool names/);
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(configOps(p, '{}'), { ops: [] });
});
