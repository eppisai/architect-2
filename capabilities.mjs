// Browser-local product capabilities. Remote services are explicitly simulated.
const copy = x => JSON.parse(JSON.stringify(x));
export function platform(p) {
  p.platform ||= {};
  const s = p.platform;
  s.architecture ||= 'managed';
  s.routes ||= [];
  s.routingConfigured ??= s.routes.length > 0;
  s.connections ||= [];
  s.collections ||= [{ name: 'feedback', fields: [{ name: 'message', type: 'string', required: true }, { name: 'helpful', type: 'boolean', required: true }], records: [] }];
  s.auth ||= { provider: 'Email', signup: true, sessionHours: 24 };
  s.analytics ??= true;
  s.marketplace ||= { enabled: false, category: 'Productivity', summary: '', description: '', tags: [] };
  s.agentOptions ||= { memory: false, approval: true, temperature: 0.3 };
  return s;
}
export function capabilityFiles(p) {
  const s = platform(copy(p));
  return [
    { path: 'agents/workflow.json', area: 'agents', text: JSON.stringify({ architecture: s.architecture, routes: s.routes, options: s.agentOptions, agents: p.agents || [], simulation: true }, null, 2) },
    { path: 'data/schema.json', area: 'data', text: JSON.stringify(s.collections.map(({ records, ...c }) => c), null, 2) },
    { path: 'data/records.json', area: 'data', text: JSON.stringify(Object.fromEntries(s.collections.map(c => [c.name, c.records])), null, 2) },
    { path: 'config/connections.json', area: 'agents', text: JSON.stringify(s.connections, null, 2) },
    { path: 'config/publishing.json', area: 'deploy', text: JSON.stringify({ analytics: s.analytics, marketplace: s.marketplace, auth: s.auth, simulation: true }, null, 2) },
    { path: 'design/tokens.json', area: 'app', text: JSON.stringify(s.design || { preset: p.settings.theme }, null, 2) },
    ...(s.architecture === 'repository' ? [{ path: 'agenticos/workbench.md', area: 'agents', text: '# Repository-owned agent workbench\n\n## Journeys\nInput → main agent → conditional handoffs → answer.\n\n## Skills\nReview agents/workflow.json and config/connections.json.\n\n## Observe\nUse Agents → Workflow → Test workflow to inspect simulated routes.\n\n## Ownership\nGitHub contains prompts, agent code and orchestration. The framework runtime is not executed by this prototype.\n' }] : []),
  ];
}
export function addCollection(p, name, fields) {
  const s = platform(p);
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(name)) throw Error('Use a lowercase name starting with a letter, with letters, numbers or underscores.');
  if (s.collections.some(c => c.name === name)) throw Error('A collection with this name already exists.');
  validateFields(fields);
  s.collections.push({ name, fields: copy(fields), records: [] });
}
export function validateFields(fields) {
  if (!Array.isArray(fields) || !fields.length) throw Error('Add at least one field.');
  const names = new Set();
  for (const f of fields) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(f.name) || f.name === 'id' || names.has(f.name)) throw Error('Field names must be unique lowercase identifiers; id is reserved.');
    if (!['string', 'number', 'boolean'].includes(f.type)) throw Error('Field type must be string, number or boolean.');
    names.add(f.name);
  }
}
export function validateRecord(fields, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Enter a JSON object, such as {"message":"Useful","helpful":true}.');
  for (const f of fields) {
    if (f.required && (value[f.name] == null || value[f.name] === '')) throw Error(`${f.name} is required.`);
    if (value[f.name] != null && typeof value[f.name] !== f.type) throw Error(`${f.name} must be a ${f.type}.`);
  }
  for (const key of Object.keys(value)) if (!fields.some(f => f.name === key)) throw Error(`${key} is not in the schema.`);
}
export function saveRecord(p, name, value, id = '') {
  const c = platform(p).collections.find(c => c.name === name);
  if (!c) throw Error('Collection not found.');
  validateRecord(c.fields, value);
  if (id) {
    const i = c.records.findIndex(r => r.id === id);
    if (i < 0) throw Error('Record no longer exists.');
    c.records[i] = { ...copy(value), id };
  } else c.records.push({ ...copy(value), id: crypto.randomUUID() });
}
export function saveSchema(p, name, fields) {
  validateFields(fields);
  const c = platform(p).collections.find(c => c.name === name);
  if (!c) throw Error('Collection not found.');
  for (const { id, ...row } of c.records) validateRecord(fields, row);
  c.fields = copy(fields);
}
export function saveRoute(p, route) {
  const ids = new Set(['main', ...(p.agents || []).map(a => a.id)]);
  if (!ids.has(route.from) || !ids.has(route.to)) throw Error('Choose two existing agents.');
  if (route.from === route.to) throw Error('An agent cannot hand off to itself.');
  if (!['always', 'answered', 'unanswered'].includes(route.when)) throw Error('Choose a route condition.');
  const routes = platform(p).routes.filter(r => r.id !== route.id);
  if (routes.some(r => r.from === route.from && r.to === route.to)) throw Error('That route already exists.');
  routes.push({ ...route, id: route.id || crypto.randomUUID() });
  const visits = new Set(), done = new Set();
  function visit(id) {
    if (visits.has(id)) throw Error('This creates a loop. Route forward to another agent or the answer.');
    if (done.has(id)) return;
    visits.add(id);
    routes.filter(r => r.from === id).forEach(r => visit(r.to));
    visits.delete(id); done.add(id);
  }
  ids.forEach(visit);
  platform(p).routes = routes;
  platform(p).routingConfigured = true;
}
export function workflowTrace(p, supported) {
  const nodes = [{ id: 'main', name: 'Main agent', status: 'completed' }];
  const used = new Set(['main']);
  const s = platform(p);
  const routes = s.routingConfigured ? s.routes : (p.agents || []).map(a => ({ from: 'main', to: a.id, when: /no answer/i.test(a.trigger) ? 'unanswered' : /on request/i.test(a.trigger) ? 'manual' : 'always' }));
  function walk(id) {
    for (const route of routes.filter(r => r.from === id)) {
      const a = (p.agents || []).find(a => a.id === route.to);
      if (!a || used.has(a.id)) continue;
      used.add(a.id);
      const active = a.enabled !== false && (route.when === 'always' || (route.when === 'answered' && supported) || (route.when === 'unanswered' && !supported));
      nodes.push({ id: a.id, name: a.name, status: active ? 'simulated' : 'skipped', condition: route.when });
      if (active) walk(a.id);
    }
  }
  walk('main');
  for (const a of p.agents || []) if (!used.has(a.id)) nodes.push({ id: a.id, name: a.name, status: 'unconnected' });
  return nodes;
}
export function validateConnection(c) {
  if (!c.name?.trim()) throw Error('Name this connection.');
  let u; try { u = new URL(c.endpoint); } catch { throw Error('Use a valid https endpoint.'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw Error('Use an https URL without embedded credentials.');
  if (u.search || u.hash) throw Error('Keep credentials and query parameters out of the endpoint URL.');
  if (!c.actions?.length) throw Error('Select at least one permitted action.');
  if (!c.scope?.trim()) throw Error('Specify the resource this connection may access.');
}
export function validateListing(listing, audience) {
  if (!listing.enabled) return;
  if (audience !== 'public') throw Error('Set app access to Anyone with the link before listing it.');
  if (!listing.summary.trim() || listing.summary.length > 160) throw Error('Add a summary of 1–160 characters.');
  if (listing.description.trim().length < 20) throw Error('Describe the app in at least 20 characters.');
  if (listing.tags.length > 8) throw Error('Use at most 8 tags.');
}
export function recordEvent(p, type, detail = {}) {
  if (!platform(p).analytics) return;
  p.events ||= [];
  p.events.push({ type, at: new Date().toISOString(), ...detail });
  if (p.events.length > 500) p.events.shift();
}
export function themeFor(p, themes) {
  const base = themes[p.settings.theme] || themes.forest;
  return p.platform?.design ? { ...base, ...p.platform.design.tokens } : base;
}
