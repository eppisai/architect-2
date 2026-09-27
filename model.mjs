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
  // Self-contained: this function is copied into the exported project's API.
  const STOP = new Set(
    "a an the i me my we our us you your is are am be been can could do does did how what when where which who whom why will would should shall to of in on for at by with about from it its this that these those there here have has had if any some and or not no much many long far over up out off into than then so just also please tell know want need like get got let may might must policy policies question questions answer find".split(" "),
  );
  const SYN = { vacation: "leave", holiday: "leave", pto: "leave", laptop: "equipment", computer: "equipment", freeze: "pause", booking: "book", reschedule: "move" };
  const stem = (w) => {
    w = SYN[w] || w;
    if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
    else if (w.length > 5 && w.endsWith("ed")) w = w.slice(0, -2);
    else if (w.endsWith("sses")) w = w.slice(0, -2);
    else if (/(sh|ch|x)es$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
    else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    return SYN[w] || w;
  };
  const words = (t) =>
    String(t)
      .toLowerCase()
      .replace(/[’']/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP.has(w))
      .map(stem);
  const asked = new Set(words(question));
  let line = "",
    best = 0;
  for (const l of p.source.split("\n")) {
    if (l.indexOf(":") < 1) continue;
    const have = new Set(words(l));
    const score = [...asked].filter((w) => have.has(w)).length;
    if (score > best) (best = score), (line = l);
  }
  const where = p.sourceName || "the source";
  if (!line)
    return {
      supported: false,
      text:
        p.settings.unknown === "ask"
          ? `${where} doesn’t cover that. Which policy or team should we check?`
          : `I couldn’t find an answer in ${where}. Ask the team that owns it for help.`,
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
            ? " This answer is based only on the supporting passage."
            : " This answer is based only on the source text."),
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
      /\b(policy|policies|handbook|faqs?|docs?|documentation|questions?|knowledge|wiki|manuals?|guides?|answers?|notes|assistant|chatbot|bot)\b/gi,
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
      /\b(tickets?|requests?|triage|routed?|routing|approvals?|intake|onboarding|complaints?|leads?|inbox|assign|escalat\w*|helpdesk|help desk|queue|sort|crm|clients?|bookings?|reservations?|appointments?|enquir(?:y|ies)|inquir(?:y|ies))\b/gi,
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
      /\b(dashboards?|metrics?|reports?|analytics|sales|revenue|inventory|kpis?|charts?|trends?|numbers|spreadsheets?|data|forecasts?|orders|expenses?|budgets?|spend(?:ing)?|costs?|tracker|track(?:ing)?)\b/gi,
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

// Domain packs: sample content in the prompt's own subject, for each of the three engines.
// A pack's first two sample questions are answerable and the third is not (checked by tests).
const pack = (name, text, chips, intro, placeholder) => ({ name, text, chips, intro, placeholder });
export const DOMAINS = {
  fitness: {
    match: /\b(gym|gyms|fitness|yoga|pilates|workouts?|personal trainers?|crossfit)\b/gi,
    words: { gym: "Gym", gyms: "Gym", fitness: "Fitness", yoga: "Yoga", pilates: "Pilates", crossfit: "CrossFit" },
    subject: "Gym",
    knowledge: pack(
      "Member FAQ",
      `Membership: You can pause your membership for up to three months a year. A pause starts on your next billing date.
Classes: Book classes up to seven days ahead in the app. Cancel at least four hours before to avoid a no-show fee.
Opening hours: We are open 6 am to 10 pm on weekdays and 8 am to 8 pm at weekends.`,
      [["Pause membership", "Can I pause my membership?"], ["Book a class", "How far ahead can I book a class?"], ["Not covered", "Can I bring a guest to the sauna?"]],
      "Ask about memberships, classes and opening hours.",
      "Ask about your membership…",
    ),
    triage: pack(
      "Member request rules",
      `Billing: charge, charged, refund, payment, invoice, card
Membership: cancel, pause, freeze, upgrade, plan
Classes: class, booking, instructor, schedule, waitlist
Facilities: broken, shower, locker, machine, dirty, equipment`,
      [["Double charge", "I was charged twice this month"], ["Broken machine", "The rowing machine is broken and it’s urgent"], ["Not matched", "Do you sell protein shakes?"]],
      "Tell us what you need. It reaches the right team straight away.",
      "Describe your request…",
    ),
    insight: pack(
      "Membership numbers",
      `Plan,Q1 members,Q2 members
Monthly,420,465
Annual,310,330
Student,150,210
Family,90,96`,
      [["Fastest growth", "Which plan grew the most?"], ["Total", "How many members in total?"], ["Can’t answer", "Which plan should we promote next?"]],
      "Ask about members by plan. See the rows behind every answer.",
      "Ask about your membership numbers…",
    ),
  },
  restaurant: {
    match: /\b(restaurants?|cafes?|café|coffee shop|bakery|bistro|diner|menu|dishes|kitchen|food)\b/gi,
    words: { restaurant: "Restaurant", restaurants: "Restaurant", cafe: "Café", cafes: "Café", "café": "Café", bakery: "Bakery", bistro: "Bistro", diner: "Diner", kitchen: "Kitchen", food: "Food", menu: "Menu" },
    subject: "Restaurant",
    knowledge: pack(
      "Guest FAQ",
      `Reservations: Book a table online up to 30 days ahead. Groups of eight or more pay a small deposit.
Allergies: Every dish on the menu lists its allergens. Tell your server about allergies before you order.
Opening hours: Lunch is served 12 to 3 pm and dinner 6 to 11 pm. We are closed on Mondays.`,
      [["Group booking", "Can I book a table for ten people?"], ["Allergens", "Does the menu list allergens?"], ["Not covered", "Can I bring my own wine?"]],
      "Ask about bookings, allergens and opening hours.",
      "Ask a question about the restaurant…",
    ),
    triage: pack(
      "Guest request rules",
      `Reservations: booking, reservation, table, reschedule
Orders: delivery, late, missing, wrong, cold
Billing: charge, charged, refund, bill, payment, card
Feedback: loved, rude, complaint, suggestion`,
      [["Late delivery", "My delivery is late and the food is cold"], ["Double charge", "I was charged twice on my card"], ["Not matched", "Is there parking nearby?"]],
      "Tell us what happened. The right person picks it up.",
      "Describe your request…",
    ),
    insight: pack(
      "Dish orders",
      `Dish,Last month orders,This month orders
Margherita,320,360
Ramen,210,290
Caesar salad,180,170
Tiramisu,140,165`,
      [["Fastest growth", "Which dish grew the most?"], ["Total", "How many orders in total?"], ["Can’t answer", "Which dish should we add next?"]],
      "Ask about orders by dish. See the rows behind every answer.",
      "Ask about your orders…",
    ),
  },
  clinic: {
    match: /\b(clinics?|patients?|doctors?|dental|dentists?|hospitals?|medical|pharmacy|healthcare)\b/gi,
    words: { clinic: "Clinic", clinics: "Clinic", patient: "Patient", patients: "Patient", dental: "Dental Clinic", dentist: "Dental Clinic", dentists: "Dental Clinic", hospital: "Hospital", hospitals: "Hospital", pharmacy: "Pharmacy", healthcare: "Health" },
    subject: "Clinic",
    knowledge: pack(
      "Patient FAQ",
      `Appointments: Book or move appointments online up to 24 hours before. Late cancellations may be charged.
Prescriptions: Request a repeat prescription in the patient portal. Allow two working days.
Test results: Results appear in the portal within five working days. A nurse calls if anything needs attention.`,
      [["Move appointment", "Can I move my appointment?"], ["Repeat prescription", "How do I get a repeat prescription?"], ["Not covered", "Do you treat pets?"]],
      "Ask about appointments, prescriptions and results.",
      "Ask a question about your care…",
    ),
    triage: pack(
      "Patient request rules",
      `Appointments: appointment, booking, reschedule, slot
Prescriptions: prescription, refill, medicine, repeat
Billing: bill, invoice, insurance, charge, payment
Clinical: pain, fever, bleeding, results, symptom`,
      [["Refill", "I need a refill of my medicine"], ["Urgent symptom", "I have a fever and can’t sleep"], ["Not matched", "Where do I park?"]],
      "Tell us what you need. It reaches the right team with the right priority.",
      "Describe what you need…",
    ),
    insight: pack(
      "Clinic visits",
      `Clinic,Last month visits,This month visits
North,820,910
Central,1040,1010
Riverside,560,690
East,430,470`,
      [["Fastest growth", "Which clinic grew the most?"], ["Total", "How many visits in total?"], ["Can’t answer", "Why are visits changing?"]],
      "Ask about visits by clinic. See the rows behind every answer.",
      "Ask about your visits…",
    ),
  },
  school: {
    match: /\b(schools?|students?|courses?|teachers?|university|college|campus|tutors?|tutoring|classrooms?)\b/gi,
    words: { school: "School", schools: "School", student: "Student", students: "Student", course: "Course", courses: "Course", teacher: "Classroom", teachers: "Classroom", university: "Campus", college: "College", campus: "Campus", tutor: "Tutoring", tutors: "Tutoring", tutoring: "Tutoring", classroom: "Classroom", classrooms: "Classroom" },
    subject: "Student",
    knowledge: pack(
      "Student handbook",
      `Assignments: Submit assignments on the portal by 11:59 pm on the due date. Late work loses 10% per day.
Exams: Exam timetables are published four weeks before exams. Bring your student card.
Extensions: Ask your course lead for an extension at least 48 hours before the deadline.`,
      [["Late work", "What happens if I submit an assignment late?"], ["Exam timetable", "When is the exam timetable published?"], ["Not covered", "Is the library open on Sundays?"]],
      "Ask about assignments, exams and extensions.",
      "Ask a question about your course…",
    ),
    triage: pack(
      "Student request rules",
      `Admissions: apply, application, admission, enrol, enroll
Fees: fee, payment, refund, scholarship
IT: login, log in, password, portal, wifi
Wellbeing: stress, anxious, counselling, wellbeing`,
      [["Portal login", "I can’t log in to the portal"], ["Fee refund", "Can I get a refund on my fees?"], ["Not matched", "Where is the library?"]],
      "Tell us what you need. The right office picks it up.",
      "Describe your request…",
    ),
    insight: pack(
      "Course enrolments",
      `Course,Last term students,This term students
Biology,180,205
Computer science,240,320
History,120,110
Design,90,125`,
      [["Fastest growth", "Which course grew the most?"], ["Total", "How many students in total?"], ["Can’t answer", "Which course should we add next?"]],
      "Ask about enrolments by course. See the rows behind every answer.",
      "Ask about enrolments…",
    ),
  },
  shop: {
    match: /\b(shops?|online store|stores?|e-?commerce|products?|retail|boutique)\b/gi,
    words: { shop: "Shop", shops: "Shop", store: "Store", stores: "Store", "online store": "Store", ecommerce: "Store", "e-commerce": "Store", product: "Product", products: "Product", retail: "Retail", boutique: "Boutique" },
    subject: "Store",
    knowledge: pack(
      "Customer FAQ",
      `Returns: Return unworn items within 30 days for a full refund. Sale items can be exchanged only.
Delivery: Standard delivery takes three to five working days. Express arrives the next working day.
Sizing: Our sizes run small. Check the size guide on each product page.`,
      [["Returns", "Can I return an item?"], ["Delivery time", "How long does delivery take?"], ["Not covered", "Do you have a store in Paris?"]],
      "Ask about returns, delivery and sizing.",
      "Ask a question about your order…",
    ),
    triage: pack(
      "Customer request rules",
      `Orders: order, tracking, late, missing, delivery, parcel
Returns: return, refund, exchange, damaged
Billing: charge, charged, card, payment, invoice
Product: size, stock, restock, colour, color`,
      [["Missing parcel", "My parcel hasn’t arrived"], ["Damaged item", "The jacket arrived damaged and I need a refund asap"], ["Not matched", "Are you hiring?"]],
      "Tell us what happened. The right team picks it up.",
      "Describe your request…",
    ),
    insight: pack(
      "Product sales",
      `Product,Last month units,This month units
Linen shirt,240,310
Denim jacket,180,165
Canvas tote,320,380
Wool scarf,60,140`,
      [["Fastest growth", "Which product grew the most?"], ["Total", "How many units in total?"], ["Can’t answer", "What should we restock?"]],
      "Ask about sales by product. See the rows behind every answer.",
      "Ask about your sales…",
    ),
  },
  finance: {
    match: /\b(expenses?|budgets?|spending|finance|reimburse\w*|receipts?)\b/gi,
    words: { expense: "Expense", expenses: "Expense", budget: "Budget", budgets: "Budget", spending: "Spend", finance: "Finance", receipts: "Expense", receipt: "Expense" },
    subject: "Finance",
    knowledge: pack(
      "Expense policy",
      `Travel: Book travel through the travel desk. Economy class is standard for flights under six hours.
Meals: Meals are covered up to $50 a day when travelling for work.
Receipts: Upload receipts within 30 days. Claims without a receipt need manager approval.`,
      [["Flight class", "Can I fly business class?"], ["Meal allowance", "How much can I spend on meals?"], ["Not covered", "Do you pay for gym memberships?"]],
      "Ask about travel, meals and receipts.",
      "Ask about the expense policy…",
    ),
    triage: pack(
      "Finance request rules",
      `Travel: flight, hotel, trip, booking
Reimbursements: reimburse, refund, receipt, claim
Cards: card, limit, declined, blocked
Budgets: budget, overspend, forecast`,
      [["Hotel booking", "I need to book a hotel for a trip"], ["Card declined", "My card was declined and it’s urgent"], ["Not matched", "Where do I park at the office?"]],
      "Describe it once. Finance picks it up with the right priority.",
      "Describe your request…",
    ),
    insight: pack(
      "Team spend",
      `Category,Last month spend,This month spend
Travel,4200,5100
Software,3100,3300
Events,1800,1200
Equipment,900,1600`,
      [["Fastest growth", "Which category grew the most?"], ["Total", "What is the total spend?"], ["Can’t answer", "Where should we cut costs?"]],
      "Ask about spend by category. See the rows behind every answer.",
      "Ask about your spend…",
    ),
  },
  // The three defaults: their own engine uses the original example content.
  workplace: {
    fallback: true,
    match: /\b(hr|employees?|staff|policy|policies|handbook|payroll|workplace)\b/gi,
    words: {},
    subject: "Team",
    triage: pack(
      "People request rules",
      `People: leave, holiday, benefits, payroll, contract
IT: laptop, password, login, log in, wifi, access
Facilities: desk, chair, office, cleaning, heating
Finance: expense, reimburse, invoice, travel`,
      [["Expense claim", "How do I claim a travel expense?"], ["Laptop broken", "My laptop won’t turn on and I can’t work"], ["Not matched", "Is there a gym discount?"]],
      "Describe it once. It reaches the right team with the right priority.",
      "Describe your request…",
    ),
    insight: pack(
      "Team headcount",
      `Team,Last quarter headcount,This quarter headcount
Engineering,42,51
Sales,30,33
Support,18,24
Operations,12,11`,
      [["Fastest growth", "Which team grew the most?"], ["Total", "What is the total headcount?"], ["Can’t answer", "Who should we hire next?"]],
      "Ask about headcount by team. See the rows behind every answer.",
      "Ask about your teams…",
    ),
  },
  support: {
    fallback: true,
    match: /\b(support|tickets?|helpdesk|customers?|saas|subscriptions?)\b/gi,
    words: {},
    subject: "Support",
    knowledge: pack(
      "Help center articles",
      `Refunds: Refunds are available within 14 days of purchase. They reach your card in 5 to 10 days.
Passwords: Reset your password from the sign-in page. The link expires after one hour.
Plans: You can switch plans at any time. Changes apply from the next billing date.`,
      [["Refunds", "Can I get a refund?"], ["Reset password", "How do I reset my password?"], ["Not covered", "Do you have an office in Berlin?"]],
      "Ask about refunds, passwords and plans.",
      "Ask a question about your account…",
    ),
    insight: pack(
      "Tickets by channel",
      `Channel,Last month tickets,This month tickets
Email,820,760
Chat,640,910
Phone,310,280
Social,90,150`,
      [["Fastest growth", "Which channel grew the most?"], ["Total", "How many tickets in total?"], ["Can’t answer", "Why did chat tickets rise?"]],
      "Ask about tickets by channel. See the rows behind every answer.",
      "Ask about your tickets…",
    ),
  },
  sales: {
    fallback: true,
    match: /\b(sales|revenue|deals?|pipeline|leads?|crm|quotas?)\b/gi,
    words: {},
    subject: "Sales",
    knowledge: pack(
      "Sales playbook",
      `Pricing: The Starter plan is $29 a month per seat. Annual billing saves 20%.
Discounts: Discounts above 15% need approval from a sales manager.
Contracts: Standard contracts renew every year. Customers can cancel 30 days before renewal.`,
      [["Discount approval", "Which discounts need approval?"], ["Starter price", "What does the Starter plan cost?"], ["Not covered", "Can we sell in Japan?"]],
      "Ask about pricing, discounts and contracts.",
      "Ask a question about selling…",
    ),
    triage: pack(
      "Sales request rules",
      `Deals: demo, pricing, quote, trial, purchase
Renewals: renew, renewal, contract, cancel, downgrade
Partners: partner, reseller, referral, agency
Billing: invoice, charge, charged, payment, refund`,
      [["Quote request", "We’d like a quote for 50 seats"], ["Cancel renewal", "Our contract renews next week and we want to cancel asap"], ["Not matched", "Can I speak at your conference?"]],
      "Describe it once. It reaches the right person on the team.",
      "Describe your request…",
    ),
  },
};
const DEFAULT_DOMAIN = { knowledge: "workplace", triage: "support", insight: "sales" };

export function detectDomain(brief, archetype) {
  const text = String(brief || "");
  const score = (id) => (text.match(DOMAINS[id].match) || []).length;
  const ids = Object.keys(DOMAINS);
  const pick = (list) => list.map((id) => [id, score(id)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    pick(ids.filter((id) => !DOMAINS[id].fallback)) ||
    pick(ids.filter((id) => DOMAINS[id].fallback)) ||
    DEFAULT_DOMAIN[archetype] ||
    "workplace"
  );
}

export function packFor(domain, archetype) {
  const a = ARCHETYPES[archetype] || ARCHETYPES.knowledge;
  const own = DOMAINS[domain]?.[a.id];
  return {
    name: own?.name || a.source.name,
    text: own?.text || a.source.text,
    chips: clone(own?.chips || a.chips),
    intro: own?.intro || a.app.intro,
    placeholder: own?.placeholder || a.app.placeholder,
  };
}

const PRODUCT_NOUNS = [
  [/\bcrm\b/i, "CRM"],
  [/\btracker\b/i, "Tracker"],
  [/\bportal\b/i, "Portal"],
  [/\bchat ?bot\b|\bassistant\b|\bcopilot\b/i, "Assistant"],
  [/\bdashboard\b/i, "Dashboard"],
  [/\bhelp ?desk\b/i, "Help Desk"],
  [/\binbox\b/i, "Inbox"],
  [/\bplanner\b/i, "Planner"],
  [/\bhub\b/i, "Hub"],
];
const DOMAIN_NOUN = { knowledge: "Help Desk", triage: "Requests", insight: "Insights" };
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

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
    /\b(customers?|public|anyone|visitors|clients|shoppers|guests|patients|students|members|external)\b/i.test(
      text,
    ) && !/\b(my|our) (team|staff|employees|colleagues)\b/i.test(text)
      ? "public"
      : "team";
  const domain = detectDomain(text, best.id);
  const d = DOMAINS[domain];
  const noun = PRODUCT_NOUNS.find(([re]) => re.test(text))?.[1];
  const forWhom = text.match(/\bfor (?:my|our|the|a|an)\s+([a-z][a-z-]{2,20})\b/i)?.[1];
  const lead = text.match(/\b([a-z][a-z-]{2,20})\s+(?:crm|tracker|portal|dashboard|planner|hub|inbox|chat ?bot|assistant|copilot)\b/i)?.[1];
  const leadOk = lead && !/^(the|and|for|simple|small|internal|new|smart|basic|little|custom|our|your|their|with|build|make|create|want|need|agentic|good|great)$/i.test(lead);
  let subject = subjectFor(best.id, text),
    name = best.nameFor(subject);
  if (noun && leadOk) {
    subject = titleCase(lead.toLowerCase());
    name = `${subject} ${noun}`;
  } else if (!d.fallback) {
    const hit = (text.match(d.match) || [])[0]?.toLowerCase();
    subject = d.words[hit] || d.subject;
    name = `${subject} ${noun || DOMAIN_NOUN[best.id]}`;
  } else if (noun && forWhom && !/^(team|teams|company|business|staff|employees|customers|users|people)$/i.test(forWhom)) {
    subject = titleCase(forWhom.toLowerCase());
    name = `${subject} ${noun}`;
  }
  return {
    archetype: best.id,
    name,
    subject,
    audience,
    domain,
    confident: bestScore > 0 || !d.fallback,
  };
}

export function describe(x) {
  const a = archetypeOf(x),
    s = x.settings;
  return `${a.bits.length[s.length]} · ${a.bits.citations[s.citations]} · ${a.bits.unknown[s.unknown]}`;
}

export const DEFAULT_PAGES = {
  knowledge: [
    { id: "home", name: "Ask", kind: "home" },
    { id: "sources", name: "Sources", kind: "source" },
  ],
  triage: [
    { id: "home", name: "New request", kind: "home" },
    { id: "requests", name: "My requests", kind: "runs" },
  ],
  insight: [
    { id: "home", name: "Ask", kind: "home" },
    { id: "data", name: "Data", kind: "source" },
  ],
};

export function createProject(brief, imported = false, opts = {}) {
  const read = interpret(brief);
  const archetype = imported ? "knowledge" : opts.archetype || read.archetype;
  const a = ARCHETYPES[archetype];
  const domain = imported ? "workplace" : opts.domain || detectDomain(brief, archetype);
  const pk = packFor(domain, archetype);
  const name = imported
    ? "Northstar Support"
    : opts.name ||
      (archetype === read.archetype ? read.name : a.nameFor(subjectFor(archetype, brief)));
  const p = {
    id: crypto.randomUUID(),
    name,
    brief,
    imported,
    archetype,
    domain,
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
      feedback: false,
      signin: "",
    },
    source: pk.text,
    sourceName: pk.name,
    sourceKind: "sample",
    chips: pk.chips,
    copy: { h2: a.app.h2, intro: pk.intro, placeholder: pk.placeholder, button: a.app.button },
    pages: clone(DEFAULT_PAGES[archetype]),
    instructions: a.agent.does,
    changes: [],
    history: [],
    chat: [],
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
  if (!imported) {
    // What the prompt already asks for becomes part of the first version.
    const { ops } = detectOps(p, brief, "", { initial: true });
    for (const op of ops) applyOp(p, op);
    p.initialOps = ops.map((op) => describeOp(p, op));
  }
  p.versions = [];
  checkpoint(p, "First version");
  return p;
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

export const BLOCKED_TEXT =
  "This agent isn’t allowed to read the knowledge source, so it can’t answer from it. Enable “Read the knowledge source” in Tools.";

export function answer(p, question) {
  const tools = p.tools || ["read_source"];
  if (!tools.includes("read_source"))
    return { supported: false, blocked: true, text: BLOCKED_TEXT, citation: null };
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
    tools: clone(p.tools || ["read_source"]),
    agents: clone(p.agents || []),
    chips: clone(p.chips || archetypeOf(p).chips),
    copy: clone(p.copy || null),
    pages: clone(p.pages || DEFAULT_PAGES[p.archetype] || []),
    instructions: p.instructions || "",
    domain: p.domain || "workplace",
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

// ---------- Breadth pass: chat intents, runs, generated source, deploy ----------

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "app";
const pySlug = (s) => slug(s).replace(/-/g, "_");

export function chatIntent(text) {
  const t = String(text || "").toLowerCase();
  const change = {};
  let rename = null;
  const m = String(text || "").match(
    /(?:rename(?: it| the app)?(?: to)?|call it|name it)\s+["“]?([^"”]+?)["”]?\s*[.!]?\s*$/i,
  );
  if (m) rename = m[1].trim();
  if (/\b(shorter|short|brief|concise|less detail)\b/.test(t)) change.length = "short";
  else if (/\b(longer|more detail|detailed|elaborate|more context)\b/.test(t))
    change.length = "detailed";
  if (/\b(ask (a |for )?(follow|question|clarif)|clarify|follow-?up)/.test(t))
    change.unknown = "ask";
  else if (
    /\b(explain|send (it )?to a person|route to (a )?(person|human)|hand ?off|escalate)\b/.test(t)
  )
    change.unknown = "explain";
  if (/\b(hide|remove|no|without)\b.*\b(sources?|citations?|rule|rows|evidence)\b/.test(t))
    change.citations = false;
  else if (/\b(show|display|include|add)\b.*\b(sources?|citations?|rule|rows|evidence)\b/.test(t))
    change.citations = true;
  if (/\b(ocean|blue)\b/.test(t)) change.theme = "ocean";
  else if (/\b(forest|green)\b/.test(t)) change.theme = "forest";
  if (/\b(public|anyone|everyone|open to all|no sign-?in)\b/.test(t)) change.audience = "public";
  else if (/\b(team only|private|sign-?in required|invite only)\b/.test(t))
    change.audience = "team";
  return { change: Object.keys(change).length ? change : null, rename };
}

export function trace(p, r) {
  const a = archetypeOf(p),
    s = p.settings;
  const lines = p.source.split("\n").filter(Boolean).length;
  if (r.blocked)
    return [
      `${a.agent.name} received the input`,
      "Source access is disabled in Tools → nothing was read",
      "Returned a setup message instead of an answer",
    ];
  return [
    `${a.agent.name} received the input`,
    `Read ${p.sourceName} (${lines} lines, ${p.sourceKind === "sample" ? "sample" : "local"})`,
    r.supported
      ? `Matched: ${a.evidenceLabel(r) || "content"}`
      : `No match → ${a.bits.unknown[s.unknown]}`,
    `Applied ${a.bits.length[s.length].toLowerCase()} · ${a.bits.citations[s.citations]}`,
    ...(p.agents || [])
      .filter((x) => x.enabled !== false)
      .map((x) => `Handoff → ${x.name}: ${x.responsibility} (configured, not run)`),
  ];
}

export function recordRun(p, question, r) {
  p.runs ||= [];
  p.runs.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    input: question,
    output: r.text,
    supported: r.supported,
    steps: trace(p, r),
    revision: p.revision,
    ms: 3 + (String(question).length % 9),
  });
  if (p.runs.length > 25) p.runs.length = 25;
  return p.runs[0];
}

export function envVars(p) {
  const s = p.settings;
  const base = [{ name: "ARCHITECT_PROJECT_ID", status: "Managed" }];
  const byFramework = {
    "Lyzr managed": ["LYZR_API_KEY"],
    LangGraph: ["LANGCHAIN_API_KEY", "OPENAI_API_KEY"],
    CrewAI: ["OPENAI_API_KEY"],
    "OpenAI Agents SDK": ["OPENAI_API_KEY"],
    "Custom framework": [],
  };
  const names = new Set(byFramework[s.framework] || []);
  if (s.model.startsWith("Anthropic")) names.add("ANTHROPIC_API_KEY");
  if (s.model.startsWith("OpenAI")) names.add("OPENAI_API_KEY");
  const custom = p.env || [];
  const out = [...base];
  for (const n of names)
    out.push({
      name: n,
      status:
        n === "LYZR_API_KEY"
          ? "Managed"
          : custom.some((c) => c.name === n)
            ? "Set (demo)"
            : "Not set",
    });
  for (const c of custom)
    if (!out.some((o) => o.name === c.name))
      out.push({ name: c.name, status: "Set (demo)" });
  return out;
}

export function frameworkSetup(p) {
  const s = p.settings;
  const entry = s.customFramework || "";
  return (
    {
      "Lyzr managed": {
        status: "Ready (demo)",
        entry: `agents/${pySlug(archetypeOf(p).agent.name)}.yaml`,
        runtime: "Lyzr Agent Studio",
        steps: ["Agent configuration is managed for you", "Connect the knowledge source", "Test, then publish"],
      },
      LangGraph: {
        status: "Needs credentials",
        entry: entry || "agents/graph.py",
        runtime: "Python 3.11 · langgraph",
        steps: ["Set LANGCHAIN_API_KEY and OPENAI_API_KEY", "Install requirements.txt", "Run a test with the sample input"],
      },
      CrewAI: {
        status: "Needs credentials",
        entry: entry || "agents/crew.py",
        runtime: "Python 3.11 · crewai",
        steps: ["Set OPENAI_API_KEY", "Install requirements.txt", "Run the crew with the sample input"],
      },
      "OpenAI Agents SDK": {
        status: "Needs credentials",
        entry: entry || "agents/agent.py",
        runtime: "Python 3.11 · openai-agents",
        steps: ["Set OPENAI_API_KEY", "Install requirements.txt", "Run the agent with the sample input"],
      },
      "Custom framework": {
        status: entry ? "Not verified" : "Needs setup",
        entry: entry || "agents/main.py",
        runtime: "Your runtime",
        steps: ["Name the entry point that exposes run(input) → output", "Describe required configuration", "Run a test to verify the mapping"],
      },
    }[s.framework] || { status: "Unknown", entry: entry || "agents/main.py", runtime: "", steps: [] }
  );
}

function agentSource(p, a, s, agent, dataFile) {
  const setup = frameworkSetup(p);
  const prompt = `agents/prompts/${agent}.md`;
  if (s.framework === "LangGraph")
    return {
      path: setup.entry,
      text: `"""LangGraph workflow for ${p.name}. Generated by Architect; edit freely."""
from typing import TypedDict
from langgraph.graph import StateGraph, END

class State(TypedDict):
    question: str
    passages: list[str]
    answer: str

def retrieve(state: State) -> State:
    # Keyword lookup over ${dataFile}. Replace with your retriever.
    ...

def answer(state: State) -> State:
    # Instructions live in ${prompt}
    ...

def fallback(state: State) -> State:
    # ${cap(a.bits.unknown[s.unknown])}
    ...

graph = StateGraph(State)
graph.add_node("retrieve", retrieve)
graph.add_node("answer", answer)
graph.add_node("fallback", fallback)
graph.set_entry_point("retrieve")
graph.add_conditional_edges("retrieve", lambda st: "answer" if st["passages"] else "fallback")
graph.add_edge("answer", END)
graph.add_edge("fallback", END)
app = graph.compile()
`,
    };
  if (s.framework === "CrewAI")
    return {
      path: setup.entry,
      text: `"""CrewAI crew for ${p.name}. Generated by Architect; edit freely."""
from crewai import Agent, Task, Crew

${agent} = Agent(
    role="${a.agent.name}",
    goal="${a.agent.job}",
    backstory=open("${prompt}").read(),
    verbose=False,
)

task = Task(
    description="Answer {question} using only ${dataFile}. ${cap(a.bits.unknown[s.unknown])}.",
    expected_output="${a.bits.length[s.length]} · ${a.bits.citations[s.citations]}",
    agent=${agent},
)

crew = Crew(agents=[${agent}], tasks=[task])

def run(question: str) -> str:
    return crew.kickoff(inputs={"question": question})
`,
    };
  if (s.framework === "OpenAI Agents SDK")
    return {
      path: setup.entry,
      text: `"""OpenAI Agents SDK agent for ${p.name}. Generated by Architect; edit freely."""
from agents import Agent, Runner, function_tool

@function_tool
def search_source(query: str) -> list[str]:
    """Keyword lookup over ${dataFile}."""
    ...

${agent} = Agent(
    name="${a.agent.name}",
    instructions=open("${prompt}").read(),
    tools=[search_source],
)

def run(question: str) -> str:
    return Runner.run_sync(${agent}, question).final_output
`,
    };
  if (s.framework === "Custom framework")
    return {
      path: setup.entry,
      text: `"""Custom entry point for ${p.name}.

Architect calls run(input) and expects a dict with:
  text (str), supported (bool), citation (str | None)
Instructions: ${prompt}
Source: ${dataFile}
Status: ${setup.status}
"""

def run(input: str) -> dict:
    raise NotImplementedError("Wire your framework here")
`,
    };
  return {
    path: setup.entry,
    text: `# Lyzr managed agent for ${p.name}. Generated by Architect.
name: ${a.agent.name}
description: ${a.agent.job}
instructions_file: ${prompt}
model: ${s.model}
knowledge:
  - ${dataFile}
tools:
${(p.tools || ["read_source"]).map((t) => `  - ${t}`).join("\n")}
behavior:
  length: ${s.length}
  unknown: ${s.unknown}
  citations: ${s.citations}
`,
  };
}

export function generateFiles(p) {
  const a = archetypeOf(p),
    s = p.settings,
    agent = pySlug(a.agent.name),
    theme = THEMES[s.theme] || THEMES.forest,
    copy = p.copy || a.app,
    pages = p.pages || DEFAULT_PAGES[a.id] || [];
  const dataFile = `data/${slug(p.sourceName)}.${a.id === "insight" ? "csv" : "txt"}`;
  const who = s.audience === "team" ? "teammates" : "customers";
  const instructions = `# ${a.agent.name}

You are the ${a.agent.name} for ${p.name}. ${p.instructions || a.agent.does}

## Rules

- ${a.bits.length[s.length]}.
- ${cap(a.bits.unknown[s.unknown])}.
- ${cap(a.bits.citations[s.citations])}.
- Use only ${p.sourceName} (${dataFile}). Never invent content.
${(p.agents || []).length ? `\n## Handoffs\n\n${p.agents.map((x) => `- After answering, ${x.trigger.toLowerCase()}: ${x.name} (${x.responsibility.toLowerCase()})`).join("\n")}\n` : ""}`;
  const files = [
    {
      path: "README.md",
      area: "readme",
      text: `# ${p.name}

${a.promise(who, a.material)}

- Pattern: ${a.label}
- Agent: ${a.agent.name} on ${s.framework}
- Audience: ${s.audience === "team" ? "invited teammates (sign-in required)" : "anyone with the link"}

## Run locally

\`\`\`sh
npm run dev   # serves app/ and POST /api/ask at http://localhost:3000
npm test      # runs tests/behavior.test.mjs against the deterministic engine
\`\`\`

No dependencies; Node 20 or newer. The API in \`api/ask.mjs\` is the same deterministic engine the Architect preview uses, reading \`architect.json\` for behavior and tools and \`${dataFile}\` for content. Replace it with a model-backed implementation when you connect ${s.framework}.

Generated by Architect. Edit \`architect.json\`, the agent files or the data; Architect keeps the plan in sync with what is here.
`,
    },
    {
      path: "package.json",
      area: "config",
      text:
        JSON.stringify(
          {
            name: slug(p.name),
            private: true,
            type: "module",
            scripts: { dev: "node server.mjs", test: "node --test" },
            engines: { node: ">=20" },
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "server.mjs",
      area: "app",
      text: `// ${p.name} local server. Generated by Architect; no dependencies.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { ask } from "./api/ask.mjs";

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/ask") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { question } = JSON.parse(body || "{}");
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify(await ask(question)));
  }
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (path.includes("..")) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  try {
    const file = await readFile(new URL("./app" + path, import.meta.url));
    res.setHeader("content-type", types[path.slice(path.lastIndexOf("."))] || "application/octet-stream");
    res.end(file);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(3000, () => console.log("${p.name} running at http://localhost:3000"));
`,
    },
    {
      path: "api/ask.mjs",
      area: "app",
      text: `// ${p.name} · deterministic engine for the “${a.label}” pattern. Generated by Architect.
// Reads architect.json for behavior and tools, and ${dataFile} for content. No model call.
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(new URL("../architect.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("../" + cfg.source.file, import.meta.url), "utf8");

${parseTable.toString()}

${a.answer.toString()}

export async function ask(question) {
  if (!cfg.agent.tools.includes("read_source"))
    return { supported: false, blocked: true, text: ${JSON.stringify(BLOCKED_TEXT)}, citation: null };
  const project = { source, sourceName: cfg.source.name, settings: cfg.agent.behavior };
  return ${a.answer.name}(project, String(question ?? ""));
}
`,
    },
    {
      path: `app/theme-${s.theme}.css`,
      area: "app",
      text: `:root {
  --bg: ${theme.bg};
  --surface: ${theme.surface};
  --ink: ${theme.ink};
  --muted: ${theme.muted};
  --accent: ${theme.accent};
  --on-accent: ${theme.onAccent};
  --line: ${theme.line};
}
body { margin: 0; font: 16px/1.55 system-ui, sans-serif; background: var(--bg); color: var(--ink); }
nav { display: flex; gap: 18px; padding: 16px 20px; border-bottom: 1px solid var(--line); }
nav a { color: var(--muted); text-decoration: none; }
.feedback button { background: transparent; color: var(--ink); border: 1px solid var(--line); margin: 0 4px; padding: 4px 10px; }
main { max-width: 640px; margin: 40px auto; padding: 0 20px; }
textarea { width: 100%; min-height: 90px; padding: 10px; font: inherit; }
button { background: var(--accent); color: var(--on-accent); border: 0; border-radius: 6px; padding: 10px 16px; margin-top: 10px; font: inherit; }
#result { background: var(--surface); border-radius: 8px; padding: 20px; margin-top: 20px; }
blockquote { border-left: 3px solid var(--accent); margin: 12px 0; padding-left: 10px; white-space: pre-line; }
`,
    },
    {
      path: "architect.json",
      area: "config",
      text:
        JSON.stringify(
          {
            name: p.name,
            pattern: a.id,
            audience: s.audience,
            theme: s.theme,
            ui: {
              pages: pages.map((x) => ({ name: x.name, kind: x.kind })),
              feedback: !!s.feedback,
              signin: s.signin || (s.audience === "team" ? "Team sign-in" : ""),
            },
            agent: {
              name: a.agent.name,
              framework: s.framework,
              model: s.model,
              entry: frameworkSetup(p).entry,
              behavior: { length: s.length, unknown: s.unknown, citations: s.citations },
              tools: p.tools || ["read_source"],
              handoffs: (p.agents || []).map((x) => ({ name: x.name, responsibility: x.responsibility, trigger: x.trigger })),
            },
            source: { name: p.sourceName, file: dataFile },
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "app/index.html",
      area: "app",
      text: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${p.name}</title>
    <link rel="stylesheet" href="theme-${s.theme}.css" />
  </head>
  <body>
    <nav><strong>${htmlEsc(p.name)}</strong>${pages.map((x) => `<a href="#${slug(x.name)}">${htmlEsc(x.name)}</a>`).join("")}</nav>
    <main>
      <h1>${htmlEsc(copy.h2)}</h1>
      <p>${htmlEsc(copy.intro)}</p>
      <form id="ask"><textarea placeholder="${htmlEsc(copy.placeholder)}"></textarea><button>${htmlEsc(copy.button)}</button></form>
      <section id="result" hidden></section>
    </main>
    <script type="module" src="app.js"></script>
  </body>
</html>
`,
    },
    {
      path: "app/app.js",
      area: "app",
      text: `// ${p.name} front end. Generated by Architect; edit freely.
const settings = ${JSON.stringify({ length: s.length, unknown: s.unknown, citations: s.citations, feedback: !!s.feedback })};

document.querySelector("#ask").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = e.target.querySelector("textarea").value.trim();
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, settings }),
  });
  render(await res.json());
});

function render(r) {
  const out = document.querySelector("#result");
  out.hidden = false;
  out.innerHTML = \`<h2>\${r.supported ? ${JSON.stringify(a.app.found)} : ${JSON.stringify(a.app.missing)}}</h2><p>\${r.text}</p>\` +
    (r.citation && settings.citations ? \`<blockquote>\${r.citation}</blockquote>\` : "") +
    (settings.feedback ? \`<p class="feedback">Was this helpful? <button type="button">Helpful</button><button type="button">Not helpful</button></p>\` : "");
}
`,
    },
    { path: `agents/prompts/${agent}.md`, area: "config", text: instructions },
    { ...agentSource(p, a, s, agent, dataFile), area: "agent" },
    { path: dataFile, area: "data", text: p.source + "\n" },
    {
      path: "tests/behavior.test.mjs",
      area: "config",
      text: `import test from "node:test";
import assert from "node:assert/strict";
import { ask } from "../api/ask.mjs";

${(p.chips || a.chips)
  .map(
    ([label, q], i) => `test(${JSON.stringify(label)}, async () => {
  const r = await ask(${JSON.stringify(q)});
  assert.equal(r.supported, ${i < 2});${i < 2 && s.citations ? "\n  assert.ok(r.citation);" : ""}
});`,
  )
  .join("\n\n")}
`,
    },
    {
      path: ".env.example",
      area: "env",
      text: envVars(p)
        .map((v) => `${v.name}=${v.status === "Managed" ? "# managed by Architect" : ""}`)
        .join("\n") + "\n",
    },
    {
      path: ".github/workflows/deploy.yml",
      area: "deploy",
      text: `name: Deploy ${p.name}
on:
  push:
    branches: [${p.git.branch || "main"}]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
      - uses: architect/deploy@v1
        with:
          project: \${{ vars.ARCHITECT_PROJECT_ID }}
          environment: production
`,
    },
  ];
  return files;
}

export function changedAreas(p) {
  const pending = pendingChanges(p);
  const areas = new Set();
  if (p.git.committedRevision === 0) return new Set(["readme", "config", "app", "agent", "data", "env", "deploy"]);
  for (const c of pending) {
    if (c.areas) {
      c.areas.forEach((x) => areas.add(x));
      continue;
    }
    const r = c.reason.toLowerCase();
    if (/knowledge source/.test(r)) areas.add("data");
    else if (/renamed/.test(r)) areas.add("readme"), areas.add("config"), areas.add("app");
    else if (/setup|framework|entry/.test(r) || (c.before && c.after && (c.before.framework !== c.after.framework || c.before.customFramework !== c.after.customFramework || c.before.model !== c.after.model)))
      areas.add("agent"), areas.add("config"), areas.add("env");
    else if (/appearance/.test(r)) areas.add("app"), areas.add("config");
    else if (/tool|agent/.test(r)) areas.add("agent"), areas.add("config");
    else if (/variable/.test(r)) areas.add("env");
    else areas.add("config");
  }
  return areas;
}

export function rollback(p, release) {
  p.settings = clone(release.settings);
  p.source = release.source;
  p.sourceName = release.sourceName;
  p.sourceKind = release.sourceKind;
  p.name = release.name;
  p.tools = clone(release.tools || ["read_source"]);
  p.agents = clone(release.agents || []);
  if (release.chips) p.chips = clone(release.chips);
  if (release.copy) p.copy = clone(release.copy);
  if (release.pages) p.pages = clone(release.pages);
  if (release.instructions) p.instructions = release.instructions;
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason: `Rolled back to release ${release.number}`,
    at: new Date().toISOString(),
  });
  return publish(p);
}

export function addAgent(p, agent) {
  p.agents ||= [];
  const entry = {
    id: crypto.randomUUID(),
    enabled: true,
    trigger: "After the main agent answers",
    origin: "Created here",
    status: "Configured · not run in prototype",
    ...agent,
  };
  p.agents.push(entry);
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason: `Added agent: ${entry.name}`,
    at: new Date().toISOString(),
  });
  return entry;
}

export function removeAgent(p, id) {
  const i = (p.agents || []).findIndex((x) => x.id === id);
  if (i < 0) return false;
  const [gone] = p.agents.splice(i, 1);
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason: `Removed agent: ${gone.name}`,
    at: new Date().toISOString(),
  });
  return true;
}

export const TOOLS = [
  ["read_source", "Read the knowledge source", true],
  ["send_reply", "Send a reply by email", false],
  ["create_ticket", "Create a ticket in the helpdesk", false],
  ["lookup_record", "Look up a record in the database", false],
];

export function setTools(p, tools) {
  const before = (p.tools || ["read_source"]).slice().sort().join(",");
  const after = tools.slice().sort().join(",");
  if (before === after) return false;
  p.tools = tools;
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason: `Updated tools: ${tools.join(", ") || "none"}`,
    at: new Date().toISOString(),
  });
  return true;
}

export function addEnv(p, name) {
  const clean = String(name || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!clean) return null;
  p.env ||= [];
  if (p.env.some((e) => e.name === clean)) return null;
  p.env.push({ name: clean });
  p.revision++;
  p.changes.push({
    revision: p.revision,
    reason: `Added variable: ${clean}`,
    at: new Date().toISOString(),
  });
  return clean;
}

// ---------- Conversational building: any request becomes a real, restorable change ----------

export const THEMES = {
  forest: { label: "Forest", bg: "#F4F8F5", surface: "#FFFFFF", ink: "#173F36", muted: "#4F5F59", accent: "#1F5C4F", onAccent: "#FFFFFF", soft: "#EAF3EF", line: "#DCE7E2" },
  ocean: { label: "Ocean", bg: "#F2F6FA", surface: "#FFFFFF", ink: "#16324A", muted: "#4D6173", accent: "#245C8A", onAccent: "#FFFFFF", soft: "#E8F1F8", line: "#D8E3EC" },
  plum: { label: "Plum", bg: "#F8F4F7", surface: "#FFFFFF", ink: "#3A1F33", muted: "#6B5565", accent: "#7A3B69", onAccent: "#FFFFFF", soft: "#F3E8F0", line: "#E8DAE4" },
  amber: { label: "Amber", bg: "#FBF6EE", surface: "#FFFFFF", ink: "#3B2A12", muted: "#6E5B40", accent: "#9A4B16", onAccent: "#FFFFFF", soft: "#F7ECDC", line: "#EADFCB" },
  dark: { label: "Dark", bg: "#12171A", surface: "#1B2226", ink: "#EEF2EF", muted: "#A6B1AC", accent: "#7ED3AE", onAccent: "#10261D", soft: "#22302C", line: "#2C3A37", dark: true },
};

export const htmlEsc = (x) =>
  String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const PAGE_KINDS = [
  [/\b(faq|faqs|sources?|polic\w*|handbook|docs?|knowledge|articles?|menu|data|table|numbers)\b/i, "source"],
  [/\b(history|requests?|log|activity|past|recent|tickets?|questions?)\b/i, "runs"],
  [/\b(about|story|mission|team)\b/i, "about"],
  [/\b(contact|help|support|feedback|reach)\b/i, "contact"],
];
export const pageKind = (name) => PAGE_KINDS.find(([re]) => re.test(name))?.[1] || "generic";

const LANGS = ["spanish", "french", "german", "hindi", "arabic", "portuguese", "japanese", "italian", "dutch", "chinese", "korean", "tamil"];
const TONES = [
  [/\b(friendlier|friendly|warmer|warm)\b/, "Use a warm, friendly tone."],
  [/\b(formal|more professional|professional tone)\b/, "Use a formal, professional tone."],
  [/\b(casual|playful|relaxed)\b/, "Use a relaxed, conversational tone."],
  [/\b(empathetic|kinder|kind|polite|gentle)\b/, "Be kind and acknowledge how the person feels."],
  [/\bemojis?\b/, "Start each answer with one fitting emoji."],
];
const PAGE_WORDS =
  /\b(?:add|create|make|build|include|need|want|give (?:it|me|us))\s+(?:(?:a|an|another|the|new|separate|simple|dedicated|small)\s+)*([a-z][a-z0-9'&-]*(?:\s+[a-z][a-z0-9'&-]*){0,3}?)\s+(?:page|tab|screen|section|view)s?\b/i;
const PAGE_NOUNS =
  /\b(?:add|create|include|build)\s+(?:(?:a|an|the)\s+)?(leaderboard|faq|pricing|history|calendar|gallery|blog|reviews|testimonials|dashboard|profile|map)\b/i;
const AUTH_WORDS = /\b(login|log[\s-]?in|sign[\s-]?in|sign[\s-]?on|sign[\s-]?up|sso|authentication)\b/i;

export function detectOps(p, text, selection = "", { initial = false } = {}) {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  const ops = [];
  if (!initial && /^\s*(undo|revert|go back|undo that|roll ?back)\b/.test(t)) return { ops, undo: true };
  const { change, rename } = chatIntent(raw);
  const s = initial ? {} : { ...(change || {}) };
  // Themes and colour
  if (/\bdark\b/.test(t)) s.theme = /\b(no|remove|without|disable|turn off|not)\b[^.]*\bdark\b/.test(t) ? "forest" : "dark";
  else if (/\blight (mode|theme)\b/.test(t)) s.theme = "forest";
  if (/\b(purple|plum|violet)\b/.test(t)) s.theme = "plum";
  if (/\b(orange|amber|terracotta)\b/.test(t)) s.theme = "amber";
  if (initial && /\b(blue|ocean)\b/.test(t)) s.theme = "ocean";
  // Feedback on answers
  if (/\b(feedback|thumbs|ratings?|rate (?:each |the )?answers?|was (?:this|it) helpful|helpful button|not helpful)\b/.test(t))
    s.feedback = !/\b(remove|hide|no|without|turn off|drop)\b[^.]*\b(feedback|thumbs|rating)/.test(t);
  // Sign-in
  if (AUTH_WORDS.test(t) || /\b(google|microsoft|okta) (accounts?|login|sign)/.test(t)) {
    const provider = /google/.test(t) ? "Google" : /microsoft|azure|outlook/.test(t) ? "Microsoft" : /github/.test(t) ? "GitHub" : /okta|sso/.test(t) ? "SSO" : "Email link";
    if (!/\b(remove|no|without|drop)\b[^.]*\b(login|sign)/.test(t)) {
      s.signin = provider;
      s.audience = "team";
    } else {
      s.signin = "";
      s.audience = "public";
    }
  }
  // Escalation to a person, and the agent that does it
  const escalate = /escalat|hand(?:s|ed)?[\s-]?(?:it\s+)?off|goes? to (?:hr|a person|a human|someone|the team|a manager|support)|to a (?:person|human)|\b(?:on|via|to|in) slack\b/.test(t);
  if (escalate) {
    s.unknown = "explain";
    if (!(p.agents || []).some((x) => /escalat/i.test(x.name + x.responsibility)))
      ops.push({
        type: "agent",
        agent: {
          name: "Escalation Router",
          responsibility: "Escalate to a person",
          trigger: "When no answer is found",
          channel: /slack/.test(t) ? "Slack" : /teams/.test(t) ? "Microsoft Teams" : "Email",
          origin: "Created here",
        },
      });
  }
  // Agent tools
  const tools = new Set(p.tools || ["read_source"]);
  if (/\b(send|email)\b[^.]*\b(reply|replies|email|answer)/.test(t) && !initial) tools.add("send_reply");
  if (/\b(create|open|file|raise)\b[^.]*\btickets?\b/.test(t) && !initial) tools.add("create_ticket");
  if (/\b(look ?up|check)\b[^.]*\b(records?|database|account|order)\b/.test(t) && !initial) tools.add("lookup_record");
  if (tools.size !== (p.tools || ["read_source"]).length) ops.push({ type: "tools", tools: [...tools] });
  // Settings, only what actually differs
  const diff = Object.fromEntries(Object.entries(s).filter(([k, v]) => p.settings[k] !== v));
  if (Object.keys(diff).length) ops.unshift({ type: "settings", change: diff });
  if (rename && !initial) ops.push({ type: "rename", name: rename.slice(0, 50) });
  // Copy edits, including "change the text to X" on a selected element
  const said = (re) => raw.match(re)?.[1]?.trim().replace(/[.!]$/, "");
  const h2 =
    said(/(?:change|set|make|update)\s+(?:the\s+)?(?:title|headline|heading|welcome text|main text)\s+(?:to|say|read)\s+["“']?(.+?)["”']?\s*$/i) ||
    (selection === "hero" && said(/(?:change|set|make|update)\s+(?:it|the text|this)\s+(?:to|say|read)\s+["“']?(.+?)["”']?\s*$/i));
  if (h2 && !initial) ops.push({ type: "copy", field: "h2", value: h2.slice(0, 80) });
  const button =
    said(/(?:change|set|rename|make|update)\s+(?:the\s+)?button(?:\s+(?:text|label))?\s+(?:to|say|read)\s+["“']?(.+?)["”']?\s*$/i) ||
    (selection === "form" && said(/(?:change|set|make|update)\s+(?:it|the button|this)\s+(?:to|say|read)\s+["“']?(.+?)["”']?\s*$/i));
  if (button && !initial) ops.push({ type: "copy", field: "button", value: button.slice(0, 30) });
  const intro = said(/(?:change|set|update)\s+(?:the\s+)?(?:intro|subtitle|description|subheading)\s+(?:to|say|read)\s+["“']?(.+?)["”']?\s*$/i);
  if (intro && !initial) ops.push({ type: "copy", field: "intro", value: intro.slice(0, 140) });
  // Pages
  const removed = t.match(/\b(?:remove|delete|drop|hide)\s+(?:the\s+)?([a-z][a-z ]{1,30}?)\s+(?:page|tab)\b/)?.[1];
  if (removed && !initial) {
    const hit = (p.pages || []).find((x) => x.kind !== "home" && x.name.toLowerCase() === removed.trim());
    if (hit) ops.push({ type: "removePage", id: hit.id, name: hit.name });
  }
  const pageName = (raw.match(PAGE_WORDS)?.[1] || raw.match(PAGE_NOUNS)?.[1] || "").trim();
  if (pageName && !removed && !AUTH_WORDS.test(pageName) && !/^(this|that|it|home|main|landing)$/i.test(pageName)) {
    const name = titleCase(pageName.toLowerCase()).replace(/\bFaq\b/, "FAQ").slice(0, 28);
    if (!(p.pages || []).some((x) => x.name.toLowerCase() === name.toLowerCase()))
      ops.push({ type: "page", page: { id: slug(name) + "-" + Math.random().toString(36).slice(2, 6), name, kind: pageKind(name) } });
  }
  // Tone and language go to the agent's instructions
  const lines = [];
  for (const [re, line] of TONES) if (re.test(t)) lines.push(line);
  const lang = LANGS.find((l) => new RegExp(`\\b(?:in|into|to)\\s+${l}\\b`).test(t));
  if (lang) lines.push(`Reply in ${titleCase(lang)}.`);
  for (const line of lines)
    if (!String(p.instructions || "").includes(line) && !initial) ops.push({ type: "instructions", line });
  const device = !initial && /\b(mobile|phone|responsive|small screens?)\b/.test(t) ? "phone" : "";
  const data = !initial && /\b(upload|import|connect|paste|use)\b[^.]*\b(docs?|documents?|pdfs?|files?|faq|handbook|sheet|spreadsheet|csv|notion|drive|data)\b/.test(t);
  return { ops, device, data };
}

export function describeOp(p, op) {
  const a = archetypeOf(p);
  if (op.type === "settings") {
    const out = [];
    const c = op.change;
    if ("length" in c) out.push(c.length === "short" ? "Made answers shorter" : "Made answers more detailed");
    if ("citations" in c) out.push(c.citations ? `Showing the ${a.app.evidence.toLowerCase()} under each answer` : `Hid the ${a.app.evidence.toLowerCase()}`);
    if ("unknown" in c) out.push(c.unknown === "ask" ? "Asks a follow-up when unsure" : "Explains when there’s no answer and hands off");
    if ("theme" in c) out.push(`Switched the app to the ${THEMES[c.theme]?.label || c.theme} theme`);
    if ("feedback" in c) out.push(c.feedback ? "Added Helpful and Not helpful buttons to each answer" : "Removed the feedback buttons");
    if ("signin" in c) out.push(c.signin ? `Added ${c.signin} sign-in` : "Removed sign-in");
    else if ("audience" in c) out.push(c.audience === "public" ? "Opened the app to anyone with the link" : "Made the app sign-in only");
    return out.join(" · ");
  }
  if (op.type === "rename") return `Renamed the app to ${op.name}`;
  if (op.type === "copy") return `Changed the ${op.field === "h2" ? "headline" : op.field} to “${op.value}”`;
  if (op.type === "page") return `Added a ${op.page.name} page`;
  if (op.type === "removePage") return `Removed the ${op.name} page`;
  if (op.type === "agent") return `Added ${op.agent.name}: hands unanswered questions to a person on ${op.agent.channel}`;
  if (op.type === "instructions") return `Told ${a.agent.name}: “${op.line}”`;
  if (op.type === "instructionsSet") return `Rewrote ${a.agent.name}’s instructions`;
  if (op.type === "framework") return `Moved ${a.agent.name} to ${op.change.framework || p.settings.framework}${op.change.model ? ` · ${op.change.model}` : ""}`;
  if (op.type === "tools") {
    const added = op.tools.filter((x) => !(p.tools || ["read_source"]).includes(x));
    return `Let ${a.agent.name} ${added.map((x) => TOOLS.find((y) => y[0] === x)?.[1].toLowerCase() || x).join(" and ") || "use its tools"}`;
  }
  return "Updated the project";
}

export function applyOp(p, op) {
  if (op.type === "settings") p.settings = { ...p.settings, ...op.change };
  if (op.type === "rename") p.name = op.name;
  if (op.type === "copy") p.copy = { ...(p.copy || archetypeOf(p).app), [op.field]: op.value };
  if (op.type === "page") p.pages = [...(p.pages || []), op.page];
  if (op.type === "removePage") p.pages = (p.pages || []).filter((x) => x.id !== op.id);
  if (op.type === "agent")
    (p.agents ||= []).push({ id: crypto.randomUUID(), enabled: true, status: "Configured · not run in prototype", ...op.agent });
  if (op.type === "instructions") p.instructions = `${p.instructions || archetypeOf(p).agent.does}\n${op.line}`;
  if (op.type === "instructionsSet") p.instructions = op.value;
  if (op.type === "framework") p.settings = { ...p.settings, ...op.change };
  if (op.type === "tools") p.tools = op.tools;
}

export function diffFiles(before, after) {
  const map = new Map(before.map((f) => [f.path, f]));
  const out = [];
  const count = (a, b) => {
    const pool = new Map();
    for (const l of b) pool.set(l, (pool.get(l) || 0) + 1);
    let n = 0;
    for (const l of a) {
      if (pool.get(l)) pool.set(l, pool.get(l) - 1);
      else n++;
    }
    return n;
  };
  for (const f of after) {
    const old = map.get(f.path);
    map.delete(f.path);
    if (!old) out.push({ path: f.path, area: f.area, status: "A", add: f.text.split("\n").length, del: 0 });
    else if (old.text !== f.text) {
      const x = old.text.split("\n"),
        y = f.text.split("\n");
      out.push({ path: f.path, area: f.area, status: "M", add: count(y, x), del: count(x, y) });
    }
  }
  for (const f of map.values()) out.push({ path: f.path, area: f.area, status: "D", add: 0, del: f.text.split("\n").length });
  return out;
}

const STATE_KEYS = ["archetype", "name", "settings", "source", "sourceName", "sourceKind", "tools", "agents", "pages", "copy", "chips", "instructions"];
const stateOf = (p) => clone(Object.fromEntries(STATE_KEYS.map((k) => [k, p[k] ?? null])));

export function checkpoint(p, label) {
  p.versions ||= [];
  const v = {
    id: crypto.randomUUID(),
    n: (p.versions.at(-1)?.n || 0) + 1,
    label,
    revision: p.revision,
    at: new Date().toISOString(),
    state: stateOf(p),
  };
  p.versions.push(v);
  if (p.versions.length > 40) p.versions.splice(1, 1);
  return v;
}

export function applyOps(p, ops, label) {
  const before = generateFiles(p);
  const prior = clone(p.settings);
  for (const op of ops) applyOp(p, op);
  p.revision++;
  const files = diffFiles(before, generateFiles(p));
  const reason = label || ops.map((op) => describeOp(p, op)).join(" · ");
  if (JSON.stringify(prior) !== JSON.stringify(p.settings)) p.history.push({ settings: prior, revision: p.revision - 1, reason });
  p.changes.push({
    revision: p.revision,
    reason,
    at: new Date().toISOString(),
    before: prior,
    after: clone(p.settings),
    areas: [...new Set(files.map((f) => f.area))],
  });
  const version = checkpoint(p, reason);
  return { files, version };
}

export function restoreVersion(p, id) {
  const v = (p.versions || []).find((x) => x.id === id);
  if (!v) return null;
  const before = generateFiles(p);
  const prior = clone(p.settings);
  for (const [k, val] of Object.entries(clone(v.state))) if (val !== null) p[k] = val;
  p.revision++;
  const files = diffFiles(before, generateFiles(p));
  p.changes.push({
    revision: p.revision,
    reason: `Restored version ${v.n}`,
    at: new Date().toISOString(),
    before: prior,
    after: clone(p.settings),
    areas: [...new Set(files.map((f) => f.area))],
  });
  return { files, version: checkpoint(p, `Restored version ${v.n}: ${v.label}`) };
}

export function runChecks(x) {
  const chips = x.chips || archetypeOf(x).chips;
  const results = chips.map(([label, q], i) => {
    const r = answer(x, q);
    return { label, question: q, expected: i < 2, ok: r.supported === i < 2 };
  });
  return { results, passed: results.filter((r) => r.ok).length, total: results.length };
}

// Projects saved before this version get the fields the new workspace reads.
export function normalize(p) {
  const a = archetypeOf(p);
  if (p.domain && typeof p.domain === "object") (p.customDomain = p.domain), (p.domain = "workplace");
  p.domain ||= "workplace";
  if (!p.chips) p.chips = clone(a.chips);
  p.copy ||= { h2: a.app.h2, intro: a.app.intro, placeholder: a.app.placeholder, button: a.app.button };
  p.pages ||= clone(DEFAULT_PAGES[a.id]);
  p.instructions ||= a.agent.does;
  p.settings.feedback ??= false;
  p.settings.signin ??= "";
  p.chat ||= [];
  if (!p.versions?.length) {
    p.versions = [];
    checkpoint(p, "Saved version");
  }
  for (const r of p.releases || []) {
    r.archetype ||= p.archetype;
    r.chips ||= clone(p.chips);
    r.copy ||= clone(p.copy);
    r.pages ||= clone(p.pages);
  }
  return p;
}

export function switchArchetype(p, archetype) {
  const fresh = createProject(p.brief || p.name, false, { archetype, domain: p.domain, name: p.name, audience: p.settings.audience });
  const before = generateFiles(p);
  for (const k of ["archetype", "source", "sourceName", "sourceKind", "chips", "copy", "pages", "instructions"]) p[k] = fresh[k];
  p.revision++;
  const files = diffFiles(before, generateFiles(p));
  const reason = `Switched the starting point to “${ARCHETYPES[archetype].label}”`;
  p.changes.push({ revision: p.revision, reason, at: new Date().toISOString(), areas: [...new Set(files.map((f) => f.area))] });
  return { files, version: checkpoint(p, reason) };
}

// Files as they were at the last commit, rebuilt from the saved version state.
export function committedFiles(p) {
  const rev = p.git?.committedRevision || 0;
  if (!rev) return [];
  const v = [...(p.versions || [])].reverse().find((x) => x.revision <= rev);
  if (!v) return generateFiles(p);
  return generateFiles({ ...p, ...clone(v.state), git: p.git });
}
