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
