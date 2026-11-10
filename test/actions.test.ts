import { describe, expect, it, vi } from 'vitest';
import { makeActions } from '../src/lib/actions';
import { loadIssues, MAX_ISSUES } from '../src/lib/service';
import type { AtlassianClient } from '../src/lib/service';
import { medProject } from './fixture';

function fakeClient(pages = [medProject()]): AtlassianClient & { calls: { path: string; body?: unknown }[] } {
  const calls: { path: string; body?: unknown }[] = [];
  let page = 0;
  return {
    calls,
    jira: vi.fn(async (path: string, init?: { body?: unknown }) => {
      calls.push({ path, body: init?.body });
      const issues = pages[page] ?? [];
      page++;
      return { status: 200, body: { issues, ...(page < pages.length ? { nextPageToken: `t${page}` } : {}) } };
    }),
    confluence: vi.fn(async (path: string, init?: { body?: unknown }) => {
      calls.push({ path, body: init?.body });
      return { status: 200, body: { id: '98765' } };
    }),
  };
}

describe('loading', () => {
  it('pages through search results with the next page token', async () => {
    const all = medProject();
    const c = fakeClient([all.slice(0, 5), all.slice(5)]);
    const issues = await loadIssues(c, 'MED');
    expect(issues).toHaveLength(all.length);
    expect((c.calls[1].body as { nextPageToken: string }).nextPageToken).toBe('t1');
    expect((c.calls[0].body as { expand: string }).expand).toBe('changelog');
  });
  it('stops at the issue cap', async () => {
    const big = Array.from({ length: 100 }, () => medProject()[0]);
    const c = fakeClient(Array.from({ length: 15 }, () => big));
    expect(await loadIssues(c, 'MED')).toHaveLength(MAX_ISSUES);
  });
  it('reports HTTP failures', async () => {
    const c: AtlassianClient = { jira: async () => ({ status: 403, body: {} }), confluence: async () => ({ status: 200, body: {} }) };
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
  it('uses the Jira context when no key is given', async () => {
    const r = (await makeActions(fakeClient()).getTraceChain({ context: { jira: { issueKey: 'MED-2' } } })) as { upstream: { key: string }[] };
    expect(r.upstream.map((u) => u.key)).toEqual(['MED-1']);
  });
  it('rejects bad keys without calling Jira', async () => {
    const c = fakeClient();
    expect(await makeActions(c).analyzeChangeImpact({ issueKey: 'not a key' })).toEqual({ error: 'issueKey must look like ABC-123' });
    expect(c.calls).toHaveLength(0);
  });
  it('explains untraced issues', async () => {
    const r = await makeActions(fakeClient()).getTraceChain({ issueKey: 'MED-11' });
    expect(r).toEqual({ error: 'MED-11 is not a traced item. Give it a design-control issue type or a tw- label.' });
  });
  it('analyze-change-impact lists re-runs', async () => {
    const r = (await makeActions(fakeClient()).analyzeChangeImpact({ issueKey: 'MED-2' })) as { rerun: string[] };
    expect(r.rerun).toEqual(['MED-4 (Verification): Bolus above cap is clamped']);
  });
  it('get-release-readiness needs a version', async () => {
    expect(await makeActions(fakeClient()).getReleaseReadiness({ projectKey: 'MED' })).toEqual({ error: 'version is required' });
    const r = (await makeActions(fakeClient()).getReleaseReadiness({ projectKey: 'MED', version: '2.1.0' })) as { ready: boolean };
    expect(r.ready).toBe(false);
  });
  it('publish-trace-report creates a Confluence page in the given space', async () => {
    const c = fakeClient();
    const r = await makeActions(c).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceId: '123' });
    expect(r).toMatchObject({ id: '98765' });
    const post = c.calls.find((x) => x.path === '/wiki/api/v2/pages')!;
    expect((post.body as { spaceId: string }).spaceId).toBe('123');
  });
  it('publish-trace-report rejects a non-numeric space id', async () => {
    const r = await makeActions(fakeClient()).publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceId: 'abc' });
    expect(r).toEqual({ error: 'spaceId must be a numeric Confluence space id' });
  });
});
