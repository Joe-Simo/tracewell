import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/config';
import { fromJira } from '../src/lib/jira';
import { buildGraph } from '../src/lib/model';
import { changedContentFields, suspectNotice } from '../src/lib/suspect';
import { onIssueUpdated } from '../src/lib/trigger';
import { fakeClient } from './fake-client';
import { medProject } from './fixture';

const graph = () => {
  const { items, links } = fromJira(medProject(), DEFAULT_CONFIG);
  return buildGraph(items, links);
};

describe('suspect notices', () => {
  it('counts only content fields as changes', () => {
    expect(changedContentFields([{ field: 'status' }, { field: 'description' }, { field: 'description' }, {}])).toEqual(['description']);
    expect(changedContentFields(undefined)).toEqual([]);
  });
  it('splits downstream tests into suspect passes and pending runs', () => {
    const n = suspectNotice(graph(), 'MED-1', ['summary'])!;
    expect(n.suspect.map((x) => x.key)).toEqual(['MED-4', 'MED-5']);
    expect(n.pending).toEqual([]);
    const text = JSON.stringify(n.sourceComment);
    expect(text).toContain('the summary of user need MED-1 changed.');
    expect(text).toContain('2 passed tests are now suspect');
  });
  it('lists open tests separately', () => {
    const n = suspectNotice(graph(), 'MED-6', ['description'])!;
    expect(n.suspect).toEqual([]);
    expect(n.pending.map((x) => x.key)).toEqual(['MED-8']);
    expect(JSON.stringify(n.sourceComment)).toContain('Still open or failing:');
  });
  it('writes a valid ADF comment for each test', () => {
    const n = suspectNotice(graph(), 'MED-2', ['description'])!;
    const adf = n.testComment(n.suspect[0]);
    expect(adf).toMatchObject({ type: 'doc', version: 1 });
    expect(JSON.stringify(adf)).toContain('MED-4 passed before the description of MED-2 (Cap suggested bolus at 25 units) changed.');
  });
  it('returns nothing for leaves, unknown keys or no change', () => {
    expect(suspectNotice(graph(), 'MED-4', ['summary'])).toBeUndefined();
    expect(suspectNotice(graph(), 'NOPE-1', ['summary'])).toBeUndefined();
    expect(suspectNotice(graph(), 'MED-2', [])).toBeUndefined();
  });
});

describe('issue updated trigger', () => {
  it('comments on suspect tests and the changed item', async () => {
    const c = fakeClient();
    const r = await onIssueUpdated(c, { issue: { key: 'MED-2' }, changelog: { items: [{ field: 'description' }] } });
    expect(r).toEqual({ key: 'MED-2', commented: ['MED-4', 'MED-2'], failed: [] });
    const posts = c.calls.filter((x) => x.method === 'POST' && x.path.endsWith('/comment')).map((x) => x.path);
    expect(posts).toEqual(['/rest/api/3/issue/MED-4/comment', '/rest/api/3/issue/MED-2/comment']);
  });
  it('ignores status-only edits without reading Jira', async () => {
    const c = fakeClient();
    const r = await onIssueUpdated(c, { issue: { key: 'MED-2' }, changelog: { items: [{ field: 'status' }] } });
    expect(r.skipped).toBe('no content change');
    expect(c.calls).toHaveLength(0);
  });
  it('skips bad keys and items with no tests below', async () => {
    expect((await onIssueUpdated(fakeClient(), { issue: { key: 'x' } })).skipped).toBe('no issue key');
    const r = await onIssueUpdated(fakeClient(), { issue: { key: 'MED-4' }, changelog: { items: [{ field: 'summary' }] } });
    expect(r.skipped).toBe('no downstream tests');
  });
  it('records comment failures', async () => {
    const c = fakeClient({ route: (call) => (call.path.endsWith('/comment') ? { status: 403, body: {} } : undefined) });
    const r = await onIssueUpdated(c, { issue: { key: 'MED-2' }, changelog: { items: [{ field: 'summary' }] } });
    expect(r.failed).toEqual(['MED-4', 'MED-2']);
  });
});
