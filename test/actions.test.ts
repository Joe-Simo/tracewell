import { describe, expect, it } from 'vitest';
import { makeActions, MAX_LINES } from '../src/lib/actions';
import { loadIssues, MAX_ISSUES } from '../src/lib/service';
import type { AtlassianClient } from '../src/lib/service';
import { fakeClient } from './fake-client';
import { issue, medProject } from './fixture';

describe('loading', () => {
  it('pages through search results with the next page token', async () => {
    const all = medProject();
    const c = fakeClient({ pages: [all.slice(0, 5), all.slice(5)] });
    const issues = await loadIssues(c, 'MED');
    expect(issues).toHaveLength(all.length);
    const searches = c.calls.filter((x) => x.path === '/rest/api/3/search/jql');
    expect((searches[1].body as { nextPageToken: string }).nextPageToken).toBe('t1');
    expect((searches[0].body as { expand: string }).expand).toBe('changelog');
  });
  it('stops at the issue cap', async () => {
    const big = Array.from({ length: 100 }, () => medProject()[0]);
    const c = fakeClient({ pages: Array.from({ length: 15 }, () => big) });
    expect(await loadIssues(c, 'MED')).toHaveLength(MAX_ISSUES);
  });
  it('reports HTTP failures', async () => {
    const c: AtlassianClient = {
      jira: async (path) => (path.includes('/properties/') ? { status: 404, body: {} } : { status: 403, body: {} }),
      confluence: async () => ({ status: 200, body: {} }),
    };
    const r = await makeActions(c).getTraceGaps({ projectKey: 'MED' });
    expect(r).toEqual({ error: 'Jira search failed with HTTP 403' });
  });
});

describe('rovo actions', () => {
  it('get-trace-gaps returns blockers and warnings as text', async () => {
    const r = (await makeActions(fakeClient()).getTraceGaps({ projectKey: 'med' })) as { blockers: string[]; warnings: string[] };
    expect(r.blockers).toContain('Verification MED-4 passed before MED-2 changed. Re-run it.');
    expect(r.warnings).toContain('Verification MED-10 does not trace to anything upstream.');
  });
  it('caps long gap lists so the agent stays inside its context', async () => {
    const many = Array.from({ length: MAX_LINES + 5 }, (_, i) => issue({ key: `BIG-${i + 1}`, type: 'Requirement', summary: 'r' }));
    const r = (await makeActions(fakeClient({ pages: [many] })).getTraceGaps({ projectKey: 'BIG' })) as { blockers: string[] };
    expect(r.blockers).toHaveLength(MAX_LINES + 1);
    expect(r.blockers.at(-1)).toMatch(/^\.\.\.and \d+ more$/);
  });
  it('uses the Jira context when no key is given', async () => {
    const r = (await makeActions(fakeClient()).getTraceChain({ context: { jira: { issueKey: 'MED-2' } } })) as {
      upstream: { key: string }[];
      ifChanged: string;
    };
    expect(r.upstream.map((u) => u.key)).toEqual(['MED-1']);
    expect(r.ifChanged).toContain('Re-run: MED-4.');
  });
  it('rejects bad keys without calling Jira', async () => {
    const c = fakeClient();
    expect(await makeActions(c).analyzeChangeImpact({ issueKey: 'not a key' })).toEqual({ error: 'issueKey must look like ABC-123' });
    expect(await makeActions(c).getTraceGaps({ projectKey: 'bad key"' })).toEqual({ error: 'Invalid project key: BAD KEY"' });
    expect(c.calls).toHaveLength(0);
  });
  it('explains untraced issues', async () => {
    const r = await makeActions(fakeClient()).getTraceChain({ issueKey: 'MED-11' });
    expect(r).toEqual({ error: 'MED-11 is not a traced item. Give it a design-control issue type or a tw- label.' });
  });
  it('analyze-change-impact lists re-runs and the user needs at stake', async () => {
    const r = (await makeActions(fakeClient()).analyzeChangeImpact({ issueKey: 'MED-2' })) as { rerun: string[]; userNeeds: string[] };
    expect(r.rerun).toEqual(['MED-4 (Verification): Bolus above cap is clamped']);
    expect(r.userNeeds).toEqual(['MED-1: Patients get a safe bolus suggestion']);
  });
  it('get-release-readiness needs a version and leads with the verdict', async () => {
    expect(await makeActions(fakeClient()).getReleaseReadiness({ projectKey: 'MED' })).toEqual({ error: 'version is required' });
    const r = (await makeActions(fakeClient()).getReleaseReadiness({ projectKey: 'MED', version: '2.1.0' })) as { ready: boolean; verdict: string };
    expect(r.ready).toBe(false);
    expect(r.verdict).toBe('NOT READY');
  });
  it('get-risk-controls summarises hazards', async () => {
    const r = (await makeActions(fakeClient()).getRiskControls({ projectKey: 'MED', version: '2.1.0' })) as {
      hazards: number;
      controlled: number;
      rows: string[];
    };
    expect(r.hazards).toBe(1);
    expect(r.controlled).toBe(0);
    expect(r.rows[0]).toBe('MED-6 Overdose from wrong unit entry: PARTIAL; controls MED-7; verified by MED-8 none');
  });
});

describe('project settings', () => {
  it('applies a saved project config', async () => {
    // Treat "Story" as a design input: MED-11 joins the trace and has no output or test.
    const c = fakeClient({ config: { issueTypes: { Story: 'designInput' } } });
    const r = (await makeActions(c).getTraceGaps({ projectKey: 'MED' })) as { blockers: string[] };
    expect(r.blockers).toContain('Design input MED-11 has no design output.');
  });
  it('reports bad config entries but keeps working', async () => {
    const c = fakeClient({ config: { issueTypes: { Story: 'epic' }, colour: 'red' } });
    const r = (await makeActions(c).getTraceGaps({ projectKey: 'MED' })) as { configNotes: string[]; blockers: string[] };
    expect(r.configNotes).toHaveLength(2);
    expect(r.blockers.length).toBeGreaterThan(0);
  });
});

describe('publish-trace-report', () => {
  it('creates a page in a space given by id, with links to Jira', async () => {
    const c = fakeClient();
    const r = await makeActions(c).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceId: '123' });
    expect(r).toMatchObject({ id: '98765', created: true, version: 1, ready: false, url: 'https://demo.atlassian.net/wiki/spaces/QMS/pages/98765' });
    const post = c.calls.find((x) => x.method === 'POST' && x.path === '/wiki/api/v2/pages')!;
    const body = post.body as { spaceId: string; title: string; body: { value: string } };
    expect(body.spaceId).toBe('123');
    expect(body.title).toBe('Tracewell trace report: MED 2.1.0');
    expect(body.body.value).toContain('https://demo.atlassian.net/browse/MED-4');
    expect(body.body.value).not.toContain('MED-9');
  });
  it('resolves a space key', async () => {
    const c = fakeClient();
    const r = await makeActions(c).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceKey: 'QMS' });
    expect(r).toMatchObject({ created: true });
    expect(c.calls.some((x) => x.path === '/wiki/api/v2/spaces?keys=QMS&limit=1')).toBe(true);
  });
  it('adds a new version when the report page already exists', async () => {
    const c = fakeClient({
      route: (call) =>
        call.path.startsWith('/wiki/api/v2/pages?') ? { status: 200, body: { results: [{ id: '555', version: { number: 3 } }] } } : undefined,
    });
    const r = await makeActions(c).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceId: '123' });
    expect(r).toMatchObject({ id: '555', created: false, version: 4 });
    const put = c.calls.find((x) => x.method === 'PUT')!;
    expect(put.path).toBe('/wiki/api/v2/pages/555');
    expect((put.body as { version: { message: string } }).version.message).toMatch(/^NOT READY: /);
  });
  it('rejects a bad space id or key', async () => {
    expect(await makeActions(fakeClient()).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceId: 'abc' })).toEqual({
      error: 'spaceId must be a numeric Confluence space id',
    });
    expect(await makeActions(fakeClient()).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceKey: 'a b' })).toEqual({
      error: 'Give a Confluence space key (for example QMS) or a numeric space id',
    });
    expect(await makeActions(fakeClient()).publishTraceReport({ projectKey: 'MED', version: '2.1.0' })).toEqual({
      error: 'Give a Confluence space key (for example QMS) or space id',
    });
  });
  it('explains a missing space', async () => {
    const c = fakeClient({ route: (call) => (call.path.startsWith('/wiki/api/v2/spaces') ? { status: 200, body: { results: [] } } : undefined) });
    expect(await makeActions(c).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceKey: 'NOPE' })).toEqual({
      error: 'No Confluence space with key NOPE, or you cannot see it',
    });
  });
});
