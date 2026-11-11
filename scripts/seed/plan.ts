// Demo data for a judge or a screen recording: a small insulin bolus calculator
// project. Every item uses a tw- label, so it works on any Jira project with the
// default "Task" issue type and the built-in "Relates" link type. No admin setup.

export type SeedKind =
  | 'tw-user-need'
  | 'tw-design-input'
  | 'tw-design-output'
  | 'tw-verification'
  | 'tw-validation'
  | 'tw-hazard'
  | 'tw-risk-control';

export interface SeedItem {
  id: string;
  label: SeedKind;
  summary: string;
  description: string;
  versions?: string[];
  /** Move to a done status after creation (tests only). */
  done?: boolean;
  /** Also add the tw-failed label. */
  failed?: boolean;
  /** Ids this item traces to (upstream). */
  traces?: string[];
}

export const VERSIONS = ['2.1.0', '2.2.0'];

export const ITEMS: SeedItem[] = [
  { id: 'UN1', label: 'tw-user-need', summary: 'Patients get a safe bolus suggestion', description: 'A person with diabetes can ask for a meal bolus and gets a dose they can trust.', versions: ['2.1.0'] },
  { id: 'UN2', label: 'tw-user-need', summary: 'Patients see when they last dosed', description: 'Avoid stacking doses by showing the time and size of the last bolus.', versions: ['2.2.0'] },
  { id: 'DI1', label: 'tw-design-input', summary: 'Cap any suggested bolus at 25 units', description: 'The calculator never suggests more than 25 U in one bolus.', versions: ['2.1.0'], traces: ['UN1'] },
  { id: 'DI2', label: 'tw-design-input', summary: 'Subtract insulin on board from the suggestion', description: 'Active insulin from earlier boluses reduces the suggestion.', versions: ['2.1.0'], traces: ['UN1'] },
  { id: 'DI3', label: 'tw-design-input', summary: 'Show last bolus time and amount on the home screen', description: 'Home screen shows the last bolus within 1 second of opening.', versions: ['2.2.0'], traces: ['UN2'] },
  { id: 'DO1', label: 'tw-design-output', summary: 'Dose cap in the calculator module', description: 'calculator/cap.ts clamps the result.', traces: ['DI1'] },
  { id: 'DO2', label: 'tw-design-output', summary: 'Insulin on board model', description: 'Linear decay over the configured action time.', traces: ['DI2'] },
  { id: 'VT1', label: 'tw-verification', summary: 'Bolus above the cap is clamped to 25 U', description: 'Unit and integration test.', done: true, traces: ['DI1'] },
  { id: 'VT2', label: 'tw-verification', summary: 'Insulin on board reduces the suggestion', description: 'Table-driven test over 40 cases.', done: true, failed: true, traces: ['DI2'] },
  { id: 'VT3', label: 'tw-verification', summary: 'Unit confirmation dialog appears before dosing', description: 'UI test.', traces: ['RC1'] },
  { id: 'VA1', label: 'tw-validation', summary: 'Clinician usability study, 12 participants', description: 'Formative study report in Confluence.', done: true, traces: ['UN1'] },
  { id: 'HZ1', label: 'tw-hazard', summary: 'Overdose from wrong unit entry', description: 'User enters mmol/L where mg/dL is expected.', versions: ['2.1.0'] },
  { id: 'HZ2', label: 'tw-hazard', summary: 'Stacked boluses within the action time', description: 'User doses again before the first bolus has acted.', versions: ['2.2.0'] },
  { id: 'RC1', label: 'tw-risk-control', summary: 'Confirm units before dosing', description: 'Modal confirmation with the unit in large type.', traces: ['HZ1'] },
  { id: 'VT4', label: 'tw-verification', summary: 'Legacy smoke test', description: 'Kept from the old app; not linked to anything yet.', done: true },
];

/** Upstream edits to make after seeding, to show suspect-link detection live. */
export const DEMO_EDIT = { id: 'DI1', description: 'The calculator never suggests more than 20 U in one bolus (lowered from 25 U after the hazard review).' };

export function adf(text: string) {
  return { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

export function issueFields(item: SeedItem, projectKey: string, issueTypeId: string) {
  return {
    project: { key: projectKey },
    issuetype: { id: issueTypeId },
    summary: item.summary,
    description: adf(item.description),
    labels: [item.label, ...(item.failed ? ['tw-failed'] : [])],
    ...(item.versions ? { fixVersions: item.versions.map((name) => ({ name })) } : {}),
  };
}

export type Request = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any }>;

function ok(res: { status: number; body: any }, what: string) {
  if (res.status < 200 || res.status >= 300) throw new Error(`${what} failed with HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
  return res.body;
}

/** Create versions, issues, links and test results. Returns local id to Jira key. */
export async function seed(request: Request, projectKey: string, log: (s: string) => void = () => {}): Promise<Record<string, string>> {
  if (!/^[A-Z][A-Z0-9_]{0,49}$/.test(projectKey)) throw new Error(`Invalid project key: ${projectKey}`);
  const project = ok(await request('GET', `/rest/api/3/project/${projectKey}`), 'Project lookup');
  const types: { id: string; name: string; subtask?: boolean }[] = project.issueTypes ?? [];
  const type = types.find((t) => t.name === 'Task') ?? types.find((t) => !t.subtask);
  if (!type) throw new Error('The project has no usable issue type');
  const existing = new Set<string>(ok(await request('GET', `/rest/api/3/project/${projectKey}/versions`), 'Version list').map((v: { name: string }) => v.name));
  for (const name of VERSIONS) {
    if (existing.has(name)) continue;
    ok(await request('POST', '/rest/api/3/version', { name, projectId: project.id }), `Version ${name}`);
    log(`version ${name}`);
  }
  const keys: Record<string, string> = {};
  for (const item of ITEMS) {
    const body = ok(await request('POST', '/rest/api/3/issue', { fields: issueFields(item, projectKey, type.id) }), `Issue ${item.id}`);
    keys[item.id] = body.key;
    log(`${item.id} -> ${body.key} ${item.summary}`);
  }
  for (const item of ITEMS) {
    for (const up of item.traces ?? []) {
      ok(
        await request('POST', '/rest/api/3/issueLink', { type: { name: 'Relates' }, outwardIssue: { key: keys[up] }, inwardIssue: { key: keys[item.id] } }),
        `Link ${item.id} to ${up}`,
      );
    }
  }
  for (const item of ITEMS.filter((i) => i.done)) {
    const key = keys[item.id];
    const t = ok(await request('GET', `/rest/api/3/issue/${key}/transitions`), `Transitions for ${key}`);
    const done = (t.transitions ?? []).find((x: { to?: { statusCategory?: { key?: string } } }) => x.to?.statusCategory?.key === 'done');
    if (!done) throw new Error(`No transition to a done status for ${key}`);
    ok(await request('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: done.id } }), `Resolve ${key}`);
  }
  return keys;
}

/** Edit an upstream requirement so its passed tests become suspect. */
export async function demoEdit(request: Request, key: string): Promise<void> {
  ok(await request('PUT', `/rest/api/3/issue/${key}`, { fields: { description: adf(DEMO_EDIT.description) } }), `Edit ${key}`);
}
