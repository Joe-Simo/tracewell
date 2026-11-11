import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeClient } from './fake-client';

// Route Forge's requestJira and requestConfluence to the in-memory fake, through
// the real index.ts client (JSON encoding, empty bodies, asUser vs asApp).
const fake = fakeClient();
const who = vi.hoisted(() => ({ calls: [] as string[] }));
function product(kind: string) {
  const respond = async (api: 'jira' | 'confluence', path: string, opts: { method?: string; body?: string }) => {
    who.calls.push(kind);
    const r = await fake[api](path, { method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined });
    return { status: r.status, text: async () => (r.body === null ? '' : JSON.stringify(r.body)) };
  };
  return {
    requestJira: (path: string, opts: { method?: string; body?: string }) => respond('jira', path, opts),
    requestConfluence: (path: string, opts: { method?: string; body?: string }) => respond('confluence', path, opts),
  };
}
vi.mock('@forge/api', () => ({
  default: { asUser: () => product('user'), asApp: () => product('app') },
  assumeTrustedRoute: (p: string) => p,
}));

let index: typeof import('../src/index');
beforeAll(async () => {
  index = await import('../src/index');
});

describe('Forge entry points', () => {
  it('Rovo actions run as the user', async () => {
    who.calls.length = 0;
    const r = (await index.getReleaseReadiness({ projectKey: 'MED', version: '2.1.0' })) as { verdict: string };
    expect(r.verdict).toBe('NOT READY');
    expect(new Set(who.calls)).toEqual(new Set(['user']));
  });
  it('the suspect trigger runs as the app and posts ADF comments', async () => {
    who.calls.length = 0;
    const r = await index.issueUpdated({ issue: { key: 'MED-2' }, changelog: { items: [{ field: 'summary' }] } });
    expect(r.commented).toEqual(['MED-4', 'MED-2']);
    expect(new Set(who.calls)).toEqual(new Set(['app']));
    const post = fake.calls.find((c) => c.path === '/rest/api/3/issue/MED-4/comment')!;
    expect((post.body as { body: { type: string } }).body.type).toBe('doc');
  });
  it('handles empty response bodies', async () => {
    const r = (await index.publishTraceReport({ projectKey: 'MED', version: '2.1.0', spaceKey: 'QMS' })) as { created: boolean };
    expect(r.created).toBe(true);
  });
});
