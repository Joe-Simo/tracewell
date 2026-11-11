import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/config';
import { fromJira } from '../src/lib/jira';
import type { JiraIssue } from '../src/lib/jira';
import { riskMatrix } from '../src/lib/matrix';
import { buildGraph } from '../src/lib/model';
import { releaseReadiness } from '../src/lib/readiness';
import { suspectNotice } from '../src/lib/suspect';
import { DEMO_EDIT, ITEMS, VERSIONS, demoEdit, seed } from '../scripts/seed/plan';
import type { Request } from '../scripts/seed/plan';

/** A tiny in-memory Jira that records what the seed script creates. */
function memoryJira() {
  let clock = Date.parse('2026-11-20T10:00:00Z');
  const tick = () => new Date((clock += 60_000)).toISOString();
  const issues = new Map<string, JiraIssue>();
  const versions: string[] = [];
  const request: Request = async (method, path, body: any) => {
    if (method === 'GET' && path === '/rest/api/3/project/MED')
      return { status: 200, body: { id: '10000', issueTypes: [{ id: '3', name: 'Task' }, { id: '5', name: 'Sub-task', subtask: true }] } };
    if (method === 'GET' && path === '/rest/api/3/project/MED/versions') return { status: 200, body: versions.map((name) => ({ name })) };
    if (method === 'POST' && path === '/rest/api/3/version') {
      versions.push(body.name);
      return { status: 201, body: {} };
    }
    if (method === 'POST' && path === '/rest/api/3/issue') {
      const key = `MED-${issues.size + 1}`;
      const at = tick();
      issues.set(key, {
        key,
        fields: {
          summary: body.fields.summary,
          issuetype: { name: 'Task' },
          labels: body.fields.labels,
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          created: at,
          updated: at,
          resolutiondate: null,
          fixVersions: body.fields.fixVersions ?? [],
          issuelinks: [],
        },
        changelog: { histories: [] },
      });
      return { status: 201, body: { key } };
    }
    if (method === 'POST' && path === '/rest/api/3/issueLink') {
      const out = issues.get(body.outwardIssue.key)!;
      const inn = issues.get(body.inwardIssue.key)!;
      out.fields.issuelinks!.push({ type: { name: body.type.name }, inwardIssue: { key: inn.key } });
      inn.fields.issuelinks!.push({ type: { name: body.type.name }, outwardIssue: { key: out.key } });
      return { status: 201, body: null };
    }
    const tr = /^\/rest\/api\/3\/issue\/(MED-\d+)\/transitions$/.exec(path);
    if (tr && method === 'GET')
      return { status: 200, body: { transitions: [{ id: '11', to: { statusCategory: { key: 'indeterminate' } } }, { id: '31', to: { statusCategory: { key: 'done' } } }] } };
    if (tr && method === 'POST') {
      expect(body.transition.id).toBe('31');
      const i = issues.get(tr[1])!;
      i.fields.status = { name: 'Done', statusCategory: { key: 'done' } };
      i.fields.resolutiondate = tick();
      return { status: 204, body: null };
    }
    const edit = /^\/rest\/api\/3\/issue\/(MED-\d+)$/.exec(path);
    if (edit && method === 'PUT') {
      issues.get(edit[1])!.changelog!.histories!.push({ created: tick(), items: [{ field: 'description' }] });
      return { status: 204, body: null };
    }
    return { status: 404, body: { path } };
  };
  return { request, issues, versions };
}

describe('demo seed', () => {
  it('only references items it defines', () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    for (const i of ITEMS) for (const t of i.traces ?? []) expect(ids.has(t), `${i.id} -> ${t}`).toBe(true);
    expect(ids.has(DEMO_EDIT.id)).toBe(true);
  });

  it('seeds a project that tells the demo story', async () => {
    const jira = memoryJira();
    const keys = await seed(jira.request, 'MED');
    expect(Object.keys(keys)).toHaveLength(ITEMS.length);
    expect(jira.versions).toEqual(VERSIONS);
    const { items, links } = fromJira([...jira.issues.values()], DEFAULT_CONFIG);
    expect(items).toHaveLength(ITEMS.length);
    const g = buildGraph(items, links);

    const r = releaseReadiness(g, DEFAULT_CONFIG, '2.1.0');
    expect(r.ready).toBe(false);
    expect(r.blockers.map((b) => `${b.type}:${b.key}`).sort()).toEqual([`failed:${keys.VT2}`, `notRun:${keys.VT3}`].sort());
    expect(riskMatrix(g).map((x) => x.state)).toEqual(['partial', 'open']);

    // Editing the dose cap requirement makes its passed test suspect.
    await demoEdit(jira.request, keys.DI1);
    const after = fromJira([...jira.issues.values()], DEFAULT_CONFIG);
    const g2 = buildGraph(after.items, after.links);
    const r2 = releaseReadiness(g2, DEFAULT_CONFIG, '2.1.0');
    expect(r2.blockers.map((b) => `${b.type}:${b.key}`)).toContain(`suspect:${keys.VT1}`);
    expect(suspectNotice(g2, keys.DI1, ['description'])!.suspect.map((x) => x.key)).toEqual([keys.VT1]);
  });

  it('skips versions that already exist and rejects bad keys', async () => {
    const jira = memoryJira();
    jira.versions.push('2.1.0');
    await seed(jira.request, 'MED');
    expect(jira.versions).toEqual(['2.1.0', '2.2.0']);
    await expect(seed(jira.request, 'med; drop')).rejects.toThrow('Invalid project key');
  });
});
