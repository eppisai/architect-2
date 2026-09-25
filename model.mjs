export const STORE = "architect-v2-projects-1";
export const clone = (x) => JSON.parse(JSON.stringify(x));

export const sourceText = `Leave policy: Employees may carry over up to five unused leave days. Use them by March 31.
Equipment policy: Request a replacement laptop through the IT service desk. Include the asset tag and a description of the issue.
Working hours: Core collaboration hours are 10 am to 3 pm in your local timezone.`;

export const rulesText = `Billing: refund, charged, charge, invoice, payment, receipt, subscription
Access: login, log in, password, sign in, locked out, two-factor, account
Engineering: bug, crash, error, broken, slow, not loading
Product: feature, idea, suggestion, dark mode, would be nice`;

export const tableText = `Region,Q1 revenue,Q2 revenue
North,120,150
South,90,110
East,140,130
West,60,95`;

const opt = (label, options) => ({ label, options });

function knowledgeAnswer(p, question) {
  let line = "";
  const q = question.toLowerCase();
  const lines = p.source.split("\n");
  if (/leave|vacation|carry/.test(q))
    line = lines.find((x) => /^leave policy:/i.test(x));
  if (/laptop|equipment/.test(q))
    line = lines.find((x) => /^equipment policy:/i.test(x));
  if (/hours|working time/.test(q))
    line = lines.find((x) => /^working hours:/i.test(x));
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
  const first = passage.split(". ")[0];
  return {
    supported: true,
    text:
      p.settings.length === "short"
        ? first + (first.endsWith(".") ? "" : ".")
        : passage +
          (p.settings.citations
            ? " This answer is based only on the supporting handbook passage."
            : " This answer is based only on the handbook text."),
    citation: p.settings.citations ? line : null,
  };
}

function triageAnswer(p, question) {
  const rules = p.source
    .split("\n")
    .map((l) => {
      const i = l.indexOf(":");
      if (i < 0) return null;
      return {
        team: l.slice(0, i).trim(),
        words: l
          .slice(i + 1)
          .split(",")
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean),
        line: l.trim(),
      };
    })
    .filter(Boolean);
  const lq = question.toLowerCase();
  const hit = rules.find((r) => r.words.some((w) => lq.includes(w)));
  if (!hit)
    return {
      supported: false,
      text:
        p.settings.unknown === "ask"
          ? "I need one more detail to sort this. Is it about billing, access, a bug, or an idea?"
          : "This request doesn’t match a known category yet. It has been sent to a person to sort.",
      citation: null,
    };
  const priority = /urgent|asap|immediately|\bdown\b|can[’']?t|cannot|blocked|outage|locked/i.test(
    question,
  )
    ? "High"
    : "Normal";
  const replies = {
    Billing:
      "Thanks. Our billing team will check the charge and reply within one business day.",
    Access: "Thanks. We’ll verify your account and help you sign in shortly.",
    Engineering:
      "Thanks for the report. Engineering has it and will confirm a fix or a workaround.",
    Product: "Thanks for the idea. It has been added to product review.",
  };
  const reply = replies[hit.team] || `Thanks. The ${hit.team} team has your request.`;
  return {
    supported: true,
    text:
      p.settings.length === "short"
        ? `Sorted to ${hit.team} · ${priority} priority.`
        : `Sorted to ${hit.team} · ${priority} priority. Suggested reply: “${reply}”`,
    citation: p.settings.citations ? hit.line : null,
    team: hit.team,
    priority,
  };
}

export function parseTable(text) {
  const rows = String(text || "")
    .trim()
    .split("\n")
    .map((l) => l.split(",").map((c) => c.trim()));
  const header = rows.shift() || [];
  const data = rows
    .filter((r) => r.length === header.length && r.length > 1)
    .map((r) => ({
      label: r[0],
      values: r.slice(1).map(Number),
      raw: r.join(", "),
    }))
    .filter((d) => d.values.every((v) => !Number.isNaN(v)));
  return { header, data };
}

function insightAnswer(p, question) {
  const { header, data } = parseTable(p.source);
  const lq = question.toLowerCase();
  const latest = header.at(-1) || "value";
  const unsupported = (why) => ({
    supported: false,
    text:
      p.settings.unknown === "ask"
        ? "I can compare, rank or total any column. Which one should I look at?"
        : why ||
          "The table can’t answer that yet. Add a column or connect a source that covers it.",
    citation: null,
  });
  if (!data.length || header.length < 2)
    return unsupported("The table has no usable rows yet. Add a header row and at least one row of numbers.");
  let text = "",
    rows = [];
  if (/grew|growth|increas|improv|gain|momentum/.test(lq) && header.length > 2) {
    const best = data
      .map((d) => ({ ...d, delta: d.values.at(-1) - d.values[0] }))
      .sort((a, b) => b.delta - a.delta)[0];
    text = `${best.label} grew the most: ${best.values[0]} to ${best.values.at(-1)} from ${header[1]} to ${latest}.`;
    rows = [best];
  } else if (/most|highest|top|best|largest|biggest|lead/.test(lq)) {
    const best = [...data].sort((a, b) => b.values.at(-1) - a.values.at(-1))[0];
    text = `${best.label} has the highest ${latest} at ${best.values.at(-1)}.`;
    rows = [best];
  } else if (/lowest|least|worst|declin|drop|fell|smallest|behind/.test(lq)) {
    const worst = [...data].sort((a, b) => a.values.at(-1) - b.values.at(-1))[0];
    text = `${worst.label} is lowest on ${latest} at ${worst.values.at(-1)}.`;
    rows = [worst];
  } else if (/total|overall|sum|how much|altogether|combined/.test(lq)) {
    const total = data.reduce((s, d) => s + d.values.at(-1), 0);
    text = `Total ${latest} is ${total} across ${data.length} rows.`;
    rows = data;
  } else return unsupported();
  if (p.settings.length !== "short")
    text += ` Based on ${data.length} rows in ${p.sourceName}.`;
  return {
    supported: true,
    text,
    citation: p.settings.citations ? rows.map((r) => r.raw).join("\n") : null,
    chart: { header, data, highlight: rows.map((r) => r.label) },
    rows,
  };
}

export const ARCHETYPES = {
  knowledge: {
    id: "knowledge",
    label: "Answers from documents",
    blurb:
      "People ask in their own words and get an answer they can check against your material.",
    match:
      /\b(policy|policies|handbook|faqs?|docs?|documentation|questions?|knowledge|wiki|manuals?|guides?|answers?|notes)\b/gi,
    subjects: [
      ["policy|policies", "Policy"],
      ["handbook", "Handbook"],
      ["faqs?", "FAQ"],
      ["docs?|documentation", "Docs"],
      ["wiki", "Wiki"],
      ["manuals?", "Manual"],
      ["notes?", "Notes"],
    ],
    defaultSubject: "Knowledge",
    nameFor: (s) => `${s} Desk`,
    material: "handbook",
    headline: "A clear answer. A source you can trust.",
    promise: (people, material) =>
      `Your ${people} ask a question, get an answer from your ${material}, and see where it came from.`,
    steps: ["Ask a question", "Get a useful answer", "Check the source"],
    foot1: (people) => `A simple starting point for your ${people}.`,
    foot2: {
      short: "Short answers, with room to go deeper.",
      detailed: "Detailed answers with supporting context.",
    },
    foot3: {
      true: "Make every answer understandable.",
      false: "People cannot open a source from the answer.",
    },
    agent: {
      name: "Handbook assistant",
      job: "Answers questions from your documents",
      does: "Find the relevant passage, answer clearly, and explain when the material does not cover the question.",
      used: "Question form → answer card → source passage",
    },
    app: {
      h2: "What would you like to know?",
      intro: "Ask about your policies. See the passage behind each answer.",
      placeholder: "Ask a question about your handbook…",
      button: "Ask question",
      found: "From your handbook",
      missing: "No matching policy",
      evidence: "Supporting passage",
      evidenceOff: "Source links are off",
      inspect: "Inspect the policy text",
      view: "View supporting source",
    },
    chips: [
      ["Carryover leave", "Can I carry over my leave?"],
      ["Replacement laptop", "How do I request a replacement laptop?"],
      ["Uncovered question", "Can I bring my dog to the office?"],
    ],
    unmatched: "Can I bring my dog to the office?",
    evidenceLabel: (r) => (r.citation || "").split(":")[0],
    source: {
      label: "Handbook text",
      name: "Example handbook",
      text: sourceText,
      hint: "Example matching recognizes Leave policy, Equipment policy and Working hours headings. Other content is saved but has no model-powered search.",
      connectors: ["Google Drive", "SharePoint", "Confluence"],
    },
    settings: {
      length: opt("Answer length", [
        ["short", "Short and direct"],
        ["detailed", "Detailed with context"],
      ]),
      unknown: opt("When the handbook has no answer", [
        ["explain", "Explain the gap and suggest the policy owner"],
        ["ask", "Ask a follow-up question"],
      ]),
      citations: "Show supporting sources",
    },
    bits: {
      length: { short: "Short answers", detailed: "Detailed answers" },
      citations: { true: "sources visible", false: "no source links" },
      unknown: {
        ask: "ask a follow-up when unsure",
        explain: "explain when no answer is available",
      },
    },
    answer: knowledgeAnswer,
  },
  triage: {
    id: "triage",
    label: "Requests sorted and routed",
    blurb:
      "People describe what they need once. It reaches the right team with a priority and a first reply.",
    match:
      /\b(tickets?|requests?|triage|routed?|routing|approvals?|intake|onboarding|complaints?|leads?|inbox|assign|escalat\w*|helpdesk|help desk|queue|sort)\b/gi,
    subjects: [
      ["tickets?", "Ticket"],
      ["requests?", "Request"],
      ["leads?", "Lead"],
      ["complaints?", "Complaint"],
      ["approvals?", "Approval"],
      ["onboarding", "Onboarding"],
      ["helpdesk|help desk", "Helpdesk"],
    ],
    defaultSubject: "Request",
    nameFor: (s) => `${s} Triage`,
    material: "routing rules",
    headline: "Every request lands in the right place.",
    promise: (people) =>
      `Your ${people} describe a request, see it sorted to a team with a priority, and track what happens next.`,
    steps: ["Describe the request", "See it sorted", "Track what happens"],
    foot1: (people) => `One place for your ${people} to ask for help.`,
    foot2: {
      short: "Category and priority, nothing else.",
      detailed: "Category, priority and a suggested first reply.",
    },
    foot3: {
      true: "People can see why it was sorted that way.",
      false: "The matching rule stays hidden.",
    },
    agent: {
      name: "Request sorter",
      job: "Sorts and routes requests",
      does: "Read each request, match it to a team and a priority, and draft the first reply.",
      used: "Request form → sorted card → tracking status",
    },
    app: {
      h2: "What do you need help with?",
      intro: "Describe it once. It reaches the right team with the right priority.",
      placeholder: "Describe your request…",
      button: "Send request",
      found: "Sorted",
      missing: "Needs a person",
      evidence: "Matched rule",
      evidenceOff: "Rule display is off",
      inspect: "Inspect the routing rules",
      view: "View matched rule",
    },
    chips: [
      ["Duplicate charge", "I was charged twice for my subscription"],
      ["Locked out", "I can’t log in and it’s urgent"],
      ["Unmatched request", "Where can I park near the office?"],
    ],
    unmatched: "Where can I park near the office?",
    evidenceLabel: (r) => r.team || "",
    source: {
      label: "Routing rules",
      name: "Example routing rules",
      text: rulesText,
      hint: "One line per team in the form Team: keyword, keyword. Requests are matched by keyword; there is no model-powered classification.",
      connectors: ["Zendesk", "Slack", "Shared inbox"],
    },
    settings: {
      length: opt("Reply detail", [
        ["short", "Category and priority only"],
        ["detailed", "Include a suggested reply"],
      ]),
      unknown: opt("When a request doesn’t match", [
        ["explain", "Send it to a person to sort"],
        ["ask", "Ask a follow-up question"],
      ]),
      citations: "Show the matched rule",
    },
    bits: {
      length: { short: "Category only", detailed: "Suggested replies" },
      citations: { true: "matched rule visible", false: "rule hidden" },
      unknown: {
        ask: "ask when a request is unclear",
        explain: "send unclear requests to a person",
      },
    },
    answer: triageAnswer,
  },
  insight: {
    id: "insight",
    label: "Answers from your numbers",
    blurb:
      "People ask about a table in plain language and see the rows behind every answer.",
    match:
      /\b(dashboards?|metrics?|reports?|analytics|sales|revenue|inventory|kpis?|charts?|trends?|numbers|spreadsheets?|data|forecasts?|orders)\b/gi,
    subjects: [
      ["sales", "Sales"],
      ["revenue", "Revenue"],
      ["inventory", "Inventory"],
      ["orders?", "Orders"],
      ["marketing", "Marketing"],
      ["kpis?|metrics?", "Metrics"],
    ],
    defaultSubject: "Data",
    nameFor: (s) => `${s} Insights`,
    material: "data table",
    headline: "Ask the numbers. See the rows.",
    promise: (people) =>
      `Your ${people} ask a question about the table, get an answer with a chart, and check the rows it came from.`,
    steps: ["Ask about your data", "See the answer", "Check the numbers"],
    foot1: (people) => `Plain-language questions for your ${people}.`,
    foot2: {
      short: "Just the answer.",
      detailed: "The answer with the context behind it.",
    },
    foot3: {
      true: "Every answer shows its rows.",
      false: "The supporting rows stay hidden.",
    },
    agent: {
      name: "Data analyst",
      job: "Answers questions about your numbers",
      does: "Read the table, compare or total the right column, and show the rows behind the answer.",
      used: "Question box → answer with chart → supporting rows",
    },
    app: {
      h2: "Ask about your numbers",
      intro: "Compare, rank or total any column. See the rows behind the answer.",
      placeholder: "Ask a question about the table…",
      button: "Ask",
      found: "From your data",
      missing: "Can’t answer from this table",
      evidence: "Supporting rows",
      evidenceOff: "Supporting rows are hidden",
      inspect: "Inspect the table",
      view: "View supporting rows",
    },
    chips: [
      ["Fastest growth", "Which region grew the most?"],
      ["Total", "What is the total revenue?"],
      ["Unanswerable", "What should we do next quarter?"],
    ],
    unmatched: "What should we do next quarter?",
    evidenceLabel: (r) => `${(r.rows || []).length} row${(r.rows || []).length === 1 ? "" : "s"}`,
    source: {
      label: "Data table",
      name: "Example sales table",
      text: tableText,
      hint: "Comma-separated with a header row. The first column is the label and the last column is the latest number. Questions can rank, compare growth or total a column.",
      connectors: ["Google Sheets", "Postgres", "HubSpot"],
    },
    settings: {
      length: opt("Answer length", [
        ["short", "Just the answer"],
        ["detailed", "Answer with context"],
      ]),
      unknown: opt("When the data can’t answer", [
        ["explain", "Say so and suggest what to add"],
        ["ask", "Ask a follow-up question"],
      ]),
      citations: "Show the supporting rows",
    },
    bits: {
      length: { short: "Just the number", detailed: "Numbers with context" },
      citations: { true: "supporting rows visible", false: "rows hidden" },
      unknown: {
        ask: "ask which column to use",
        explain: "say when the data is missing",
      },
    },
    answer: insightAnswer,
  },
};

export const archetypeOf = (x) =>
  ARCHETYPES[x?.archetype] || ARCHETYPES.knowledge;

export function subjectFor(archetype, brief) {
  const a = ARCHETYPES[archetype] || ARCHETYPES.knowledge;
  const text = String(brief || "");
  const found = a.subjects.find(([re]) =>
    new RegExp(`\\b(${re})\\b`, "i").test(text),
  );
  return found ? found[1] : a.defaultSubject;
}

export function interpret(brief) {
  const text = String(brief || "");
  let best = ARCHETYPES.knowledge,
    bestScore = -1;
  for (const a of Object.values(ARCHETYPES)) {
    const score = (text.match(a.match) || []).length;
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  const audience =
    /\b(customers?|public|anyone|visitors|clients|shoppers|external)\b/i.test(
      text,
    )
      ? "public"
      : "team";
  const subject = subjectFor(best.id, text);
  return {
    archetype: best.id,
    name: best.nameFor(subject),
    subject,
    audience,
    confident: bestScore > 0,
  };
}

export function describe(x) {
  const a = archetypeOf(x),
    s = x.settings;
  return `${a.bits.length[s.length]} · ${a.bits.citations[s.citations]} · ${a.bits.unknown[s.unknown]}`;
}

export function createProject(brief, imported = false, opts = {}) {
  const read = interpret(brief);
  const archetype = imported ? "knowledge" : opts.archetype || read.archetype;
  const a = ARCHETYPES[archetype];
  const name = imported ? "Northstar Support" : opts.name || read.name;
  return {
    id: crypto.randomUUID(),
    name,
    brief,
    imported,
    archetype,
    stage: imported ? "built" : "plan",
    revision: 1,
    settings: {
      length: "short",
      unknown: "explain",
      citations: true,
      audience: imported ? "team" : opts.audience || read.audience,
      framework: imported ? "LangGraph" : "Lyzr managed",
      model: "Managed default",
      customFramework: "",
      theme: "forest",
    },
    source: a.source.text,
    sourceName: a.source.name,
    sourceKind: "sample",
    changes: [],
    history: [],
    chat: [
      {
        role: "assistant",
        text: imported
          ? "I found a React app with existing sign-in and a LangGraph workflow. This sample import keeps both. Start by trying the current app or describe a focused change."
          : `Here’s a first version of ${name}. Follow the three steps, then select one to shape how it works.`,
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
  return archetypeOf(p).answer(p, String(question || ""));
}

export function publish(p) {
  const release = {
    id: crypto.randomUUID(),
    name: p.name,
    archetype: p.archetype,
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
