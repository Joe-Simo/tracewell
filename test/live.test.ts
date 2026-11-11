import { describe, expect, it } from 'vitest';
import { makeActions } from '../src/lib/actions';
import type { AtlassianClient } from '../src/lib/service';

// Optional smoke test against a real site, run with:
//   TRACEWELL_LIVE=1 JIRA_SITE=... JIRA_EMAIL=... JIRA_API_TOKEN=... LIVE_PROJECT=MED LIVE_SPACE=QMS pnpm vitest run test/live.test.ts
// It reads the seeded demo project and publishes a report page. Skipped by default.
const live = process.env.TRACEWELL_LIVE === '1';
const site = (process.env.JIRA_SITE ?? '').replace(/\/$/, '');
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

const send = async (path: string, init?: { method?: string; body?: unknown }) => {
  const res = await fetch(site + path, {
    method: init?.method ?? 'GET',
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const client: AtlassianClient = { jira: send, confluence: send };
const project = process.env.LIVE_PROJECT ?? 'MED';

describe.skipIf(!live)('live site', () => {
  const a = makeActions(client);
  it('reads gaps, readiness and risk from the demo project', async () => {
    const gaps = await a.getTraceGaps({ projectKey: project });
    console.log(JSON.stringify(gaps, null, 1));
    expect(gaps).not.toHaveProperty('error');
    const ready = await a.getReleaseReadiness({ projectKey: project, version: '2.1.0' });
    console.log(JSON.stringify(ready, null, 1));
    expect(ready).toMatchObject({ verdict: 'NOT READY' });
    const risk = await a.getRiskControls({ projectKey: project });
    console.log(JSON.stringify(risk, null, 1));
    expect(risk).toMatchObject({ hazards: 2 });
  }, 60_000);
  it('publishes the trace report', async () => {
    const r = await a.publishTraceReport({ projectKey: project, version: '2.1.0', spaceKey: process.env.LIVE_SPACE ?? 'QMS' });
    console.log(JSON.stringify(r, null, 1));
    expect(r).toHaveProperty('id');
  }, 60_000);
});
