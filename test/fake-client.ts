import { vi } from 'vitest';
import type { JiraIssue } from '../src/lib/jira';
import type { AtlassianClient, ClientResponse } from '../src/lib/service';
import { medProject } from './fixture';

export type Call = { api: 'jira' | 'confluence'; method: string; path: string; body?: unknown };

export interface FakeOptions {
  pages?: JiraIssue[][];
  /** Value of the tracewell-config project property, or undefined for none. */
  config?: unknown;
  /** Extra routes checked before the defaults: return undefined to fall through. */
  route?: (call: Call) => ClientResponse | undefined;
}

/** In-memory Jira and Confluence that answers the calls Tracewell makes. */
export function fakeClient(opts: FakeOptions = {}): AtlassianClient & { calls: Call[] } {
  const pages = opts.pages ?? [medProject()];
  const calls: Call[] = [];
  let page = 0;
  let config = opts.config;
  const handle = (call: Call): ClientResponse => {
    calls.push(call);
    const custom = opts.route?.(call);
    if (custom) return custom;
    if (call.api === 'jira') {
      if (call.path === '/rest/api/3/search/jql') {
        // A search without a page token starts a new load from the first page.
        if (!(call.body as { nextPageToken?: string } | undefined)?.nextPageToken) page = 0;
        const issues = pages[page] ?? [];
        page++;
        return { status: 200, body: { issues, ...(page < pages.length ? { nextPageToken: `t${page}` } : {}) } };
      }
      if (call.path.includes('/properties/tracewell-config')) {
        if (call.method === 'PUT') {
          config = call.body;
          return { status: 200, body: null };
        }
        return config === undefined ? { status: 404, body: {} } : { status: 200, body: { key: 'tracewell-config', value: config } };
      }
      if (call.path === '/rest/api/3/serverInfo') return { status: 200, body: { baseUrl: 'https://demo.atlassian.net' } };
      if (call.path.endsWith('/comment')) return { status: 201, body: { id: '1' } };
      return { status: 404, body: {} };
    }
    if (call.path.startsWith('/wiki/api/v2/spaces')) return { status: 200, body: { results: [{ id: '123', key: 'QMS' }] } };
    if (call.path.startsWith('/wiki/api/v2/pages?')) return { status: 200, body: { results: [] } };
    if (call.method === 'POST' && call.path === '/wiki/api/v2/pages')
      return { status: 200, body: { id: '98765', version: { number: 1 }, _links: { base: 'https://demo.atlassian.net/wiki', webui: '/spaces/QMS/pages/98765' } } };
    if (call.method === 'PUT') return { status: 200, body: { id: call.path.split('/').pop(), version: (call.body as { version: unknown }).version } };
    return { status: 404, body: {} };
  };
  return {
    calls,
    jira: vi.fn(async (path: string, init?: { method?: string; body?: unknown }) =>
      handle({ api: 'jira', method: init?.method ?? 'GET', path, body: init?.body }),
    ),
    confluence: vi.fn(async (path: string, init?: { method?: string; body?: unknown }) =>
      handle({ api: 'confluence', method: init?.method ?? 'GET', path, body: init?.body }),
    ),
  };
}
