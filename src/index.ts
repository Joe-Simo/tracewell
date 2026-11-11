import api, { assumeTrustedRoute } from '@forge/api';
import Resolver from '@forge/resolver';
import { DEFAULT_CONFIG } from './lib/config';
import { makeActions } from './lib/actions';
import type { Payload } from './lib/actions';
import { matrixCsv } from './lib/matrix';
import type { AtlassianClient } from './lib/service';
import { issueTrace, loadConfig, loadContext, overview, projectOf, publishReport, readiness, saveConfig } from './lib/service';
import { onIssueUpdated } from './lib/trigger';
import type { IssueUpdatedEvent } from './lib/trigger';

// Every path passed here is built in src/lib from constants plus keys and ids
// that are validated or URI-encoded first, so assumeTrustedRoute is safe.
function makeClient(asApp: boolean): AtlassianClient {
  const who = () => (asApp ? api.asApp() : api.asUser());
  const send = async (product: 'jira' | 'confluence', path: string, init?: { method?: string; body?: unknown }) => {
    const opts = {
      method: init?.method ?? 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    };
    const res =
      product === 'jira'
        ? await who().requestJira(assumeTrustedRoute(path), opts)
        : await who().requestConfluence(assumeTrustedRoute(path), opts);
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: res.status, body };
  };
  return {
    jira: (path, init) => send('jira', path, init),
    confluence: (path, init) => send('confluence', path, init),
  };
}

const userClient = makeClient(false);
const appClient = makeClient(true);
const base = DEFAULT_CONFIG;
const actions = makeActions(userClient, base);

// Rovo actions and MCP tools (run as the user who asked).
export const getTraceGaps = (p: Payload) => actions.getTraceGaps(p);
export const getTraceChain = (p: Payload) => actions.getTraceChain(p);
export const analyzeChangeImpact = (p: Payload) => actions.analyzeChangeImpact(p);
export const getReleaseReadiness = (p: Payload) => actions.getReleaseReadiness(p);
export const getRiskControls = (p: Payload) => actions.getRiskControls(p);
export const publishTraceReport = (p: Payload) => actions.publishTraceReport(p);

// Suspect-link automation (runs as the app, on Jira issue updates).
export const issueUpdated = async (event: IssueUpdatedEvent) => {
  const result = await onIssueUpdated(appClient, event, base);
  // Issue keys and outcomes only, no issue content, so `forge logs` shows what happened.
  console.log(`tracewell suspect-trigger ${JSON.stringify(result)}`);
  return result;
};

// UI resolvers
type Ctx = { extension?: { issue?: { key?: string }; project?: { key?: string } } };
const projectKeyOf = (context: unknown) => String((context as Ctx)?.extension?.project?.key ?? '');

const resolver = new Resolver();

resolver.define('issueTrace', async ({ context }) => {
  const key = String((context as Ctx)?.extension?.issue?.key ?? '');
  const { graph, cfg } = await loadContext(userClient, projectOf(key), base);
  return issueTrace(graph, cfg, key) ?? null;
});

resolver.define('overview', async ({ context }) => {
  const projectKey = projectKeyOf(context);
  const { graph, cfg, configErrors } = await loadContext(userClient, projectKey, base);
  const o = overview(graph, cfg, projectKey);
  return { ...o, csv: matrixCsv(o.matrix), configErrors };
});

resolver.define('readiness', async ({ payload, context }) => {
  const { graph, cfg } = await loadContext(userClient, projectKeyOf(context), base);
  return readiness(graph, cfg, String(payload?.version ?? ''));
});

resolver.define('publish', async ({ payload, context }) => {
  const projectKey = projectKeyOf(context);
  try {
    const { graph, cfg } = await loadContext(userClient, projectKey, base);
    return await publishReport(userClient, graph, cfg, {
      projectKey,
      version: String(payload?.version ?? ''),
      spaceKey: String(payload?.spaceKey ?? '').trim(),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
});

resolver.define('getSettings', async ({ context }) => {
  const r = await loadConfig(userClient, projectKeyOf(context), base);
  return { text: r.raw ? JSON.stringify(r.raw, null, 2) : '', errors: r.errors, defaults: JSON.stringify(base, null, 2) };
});

resolver.define('saveSettings', async ({ payload, context }) => {
  const text = String(payload?.text ?? '').trim();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { saved: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
    }
  }
  return saveConfig(userClient, projectKeyOf(context), raw);
});

export const uiResolver = resolver.getDefinitions();
