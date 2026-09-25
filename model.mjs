export const STORE = "architect-v2-projects-1";
export const sourceText =
  "Leave policy: Employees may carry over up to five unused leave days. Use them by March 31.\nEquipment policy: Request a replacement laptop through the IT service desk. Include the asset tag and a description of the issue.\nWorking hours: Core collaboration hours are 10 am to 3 pm in your local timezone.";
export const clone = (x) => JSON.parse(JSON.stringify(x));
export function createProject(brief, imported = false) {
  return {
    id: crypto.randomUUID(),
    name: imported ? "Northstar Support" : "PolicyDesk",
    brief,
    imported,
    stage: imported ? "built" : "plan",
    revision: 1,
    settings: {
      length: "short",
      unknown: "explain",
      citations: true,
      audience: "team",
      framework: imported ? "LangGraph" : "Lyzr managed",
      model: "Managed default",
      customFramework: "",
      theme: "forest",
    },
    source: sourceText,
    sourceName: "Example handbook",
    sourceKind: "sample",
    changes: [],
    history: [],
    chat: [
      {
        role: "assistant",
        text: imported
          ? "I found a React app with existing sign-in and a LangGraph workflow. This sample import keeps both. Start by trying the current app or describe a focused change."
          : "Here’s a first version of your idea. Follow the three steps, then select one to shape how it works.",
      },
    ],
    git: {
      connected: false,
      repo: imported ? "northstar/support-app" : "",
      branch: imported ? "feature/citations" : "main",
      committedRevision: 0,
      syncedRevision: 0,
    },
    releases: [],
    createdAt: new Date().toISOString(),
  };
}
export function settingsChange(p, next, reason) {
  const previous = clone(p.settings);
  if (JSON.stringify(previous) === JSON.stringify({ ...previous, ...next }))
    return false;
  p.history.push({ settings: previous, revision: p.revision, reason });
  p.settings = { ...previous, ...next };
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason,
    at: new Date().toISOString(),
    before: previous,
    after: clone(p.settings),
  });
  return true;
}
export function undo(p) {
  const prior = p.history.pop();
  if (!prior) return false;
  const before = clone(p.settings);
  p.settings = prior.settings;
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason: "Undid: " + prior.reason,
    before,
    after: clone(p.settings),
    at: new Date().toISOString(),
  });
  return true;
}
export function answer(p, question) {
  let line = "";
  const q = question.toLowerCase();
  if (/leave|vacation|carry/.test(q))
    line = p.source.split("\n").find((x) => /^leave policy:/i.test(x));
  if (/laptop|equipment/.test(q))
    line = p.source.split("\n").find((x) => /^equipment policy:/i.test(x));
  if (/hours|working time/.test(q))
    line = p.source.split("\n").find((x) => /^working hours:/i.test(x));
  if (!line)
    return {
      supported: false,
      text:
        p.settings.unknown === "ask"
          ? "The example handbook does not cover that. Which policy or team should we check?"
          : "I couldn’t find an answer in the example handbook. Ask the policy owner for help.",
      citation: null,
    };
  const passage = line.slice(line.indexOf(":") + 1).trim();
  return {
    supported: true,
    text:
      p.settings.length === "short"
        ? passage.split(". ")[0] +
          (passage.split(". ")[0].endsWith(".") ? "" : ".")
        : passage +
          (p.settings.citations
            ? " This answer is based only on the supporting handbook passage."
            : " This answer is based only on the handbook text."),
    citation: p.settings.citations ? line : null,
  };
}
export function publish(p) {
  const release = {
    id: crypto.randomUUID(),
    name: p.name,
    revision: p.revision,
    settings: clone(p.settings),
    source: p.source,
    sourceKind: p.sourceKind,
    sourceName: p.sourceName,
    at: new Date().toISOString(),
    number: p.releases.length + 1,
  };
  p.releases.push(release);
  return release;
}
export function recordSource(p, text, name, kind = "local") {
  p.source = text;
  p.sourceName = name;
  p.sourceKind = kind;
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason: "Updated knowledge source: " + name,
    at: new Date().toISOString(),
  });
}

export function pendingChanges(p) {
  const changes = p.changes.filter((c) => c.revision > p.git.committedRevision);
  if (p.git.committedRevision === 0 && !changes.some((c) => c.revision === 1))
    changes.unshift({
      revision: 1,
      reason: p.imported
        ? "Review imported example baseline"
        : "Review initial project configuration",
      at: p.createdAt,
    });
  return changes;
}
