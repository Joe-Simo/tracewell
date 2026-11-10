import api, { assumeTrustedRoute } from '@forge/api';
import Resolver from '@forge/resolver';
import { DEFAULT_CONFIG } from './lib/config';
import { makeActions } from './lib/actions';
import type { Payload } from './lib/actions';
import type { AtlassianClient } from './lib/service';
import { issueTrace, loadGraph, overview, projectOf, readiness } from './lib/service';
import { matrixCsv } from './lib/matrix';

// Every path passed here is built from constants in src/lib/service.ts; keys are
// validated before they reach a path, so assumeTrustedRoute is safe.
const client: AtlassianClient = {
  async jira(path, init) {
    const res = await api.asUser().requestJira(assumeTrustedRoute(path), {
      method: init?.method ?? 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  },
  async confluence(path, init) {
    const res = await api.asUser().requestConfluence(assumeTrustedRoute(path), {
      method: init?.method ?? 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  },
};

const cfg = DEFAULT_CONFIG;
const actions = makeActions(client, cfg);

// Rovo actions and MCP tools
export const getTraceGaps = (p: Payload) => actions.getTraceGaps(p);
export const getTraceChain = (p: Payload) => actions.getTraceChain(p);
export const analyzeChangeImpact = (p: Payload) => actions.analyzeChangeImpact(p);
export const getReleaseReadiness = (p: Payload) => actions.getReleaseReadiness(p);
export const publishTraceReport = (p: Payload) => actions.publishTraceReport(p);

// UI resolvers
const resolver = new Resolver();

resolver.define('issueTrace', async ({ context }) => {
  const key = String(context?.extension?.issue?.key ?? '');
  const g = await loadGraph(client, projectOf(key), cfg);
  return issueTrace(g, cfg, key) ?? null;
});

resolver.define('overview', async ({ context }) => {
  const projectKey = String(context?.extension?.project?.key ?? '');
  const g = await loadGraph(client, projectKey, cfg);
  const o = overview(g, cfg, projectKey);
  return { ...o, csv: matrixCsv(o.matrix) };
});

resolver.define('readiness', async ({ payload, context }) => {
  const projectKey = String(context?.extension?.project?.key ?? '');
  const g = await loadGraph(client, projectKey, cfg);
  return readiness(g, cfg, String(payload?.version ?? ''));
});

export const uiResolver = resolver.getDefinitions();
