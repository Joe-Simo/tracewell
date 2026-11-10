import type { TraceConfig } from './config';
import { DEFAULT_CONFIG } from './config';
import { KIND_LABEL } from './model';
import { isIssueKey } from './jira';
import type { AtlassianClient } from './service';
import { issueTrace, loadGraph, overview, projectOf, publishReport, readiness } from './service';

/**
 * Rovo action and MCP tool handlers. Each returns plain text-friendly JSON;
 * errors come back as { error } so the agent can explain them instead of failing.
 */
export type Payload = Record<string, unknown> & { context?: { jira?: { projectKey?: string; issueKey?: string } } };

function str(p: Payload, name: string): string | undefined {
  const v = p[name];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function projectFrom(p: Payload): string {
  const k = (str(p, 'projectKey') ?? p.context?.jira?.projectKey ?? '').toUpperCase();
  if (!k) throw new Error('projectKey is required');
  return k;
}

function issueFrom(p: Payload): string {
  const k = (str(p, 'issueKey') ?? p.context?.jira?.issueKey ?? '').toUpperCase();
  if (!isIssueKey(k)) throw new Error('issueKey must look like ABC-123');
  return k;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function makeActions(client: AtlassianClient, cfg: TraceConfig = DEFAULT_CONFIG) {
  return {
    getTraceGaps: (p: Payload) =>
      safe(async () => {
        const projectKey = projectFrom(p);
        const o = overview(await loadGraph(client, projectKey, cfg), cfg, projectKey);
        return {
          projectKey,
          coverage: o.coverage,
          blockers: o.gaps.filter((g) => g.severity === 'blocker').map((g) => g.message),
          warnings: o.gaps.filter((g) => g.severity === 'warning').map((g) => g.message),
        };
      }),
    getTraceChain: (p: Payload) =>
      safe(async () => {
        const key = issueFrom(p);
        const t = issueTrace(await loadGraph(client, projectOf(key), cfg), cfg, key);
        if (!t) return { error: `${key} is not a traced item. Give it a design-control issue type or a tw- label.` };
        return t;
      }),
    analyzeChangeImpact: (p: Payload) =>
      safe(async () => {
        const key = issueFrom(p);
        const t = issueTrace(await loadGraph(client, projectOf(key), cfg), cfg, key);
        if (!t?.impact) return { error: `${key} is not a traced item.` };
        const i = t.impact;
        return {
          key,
          text: i.text,
          rerun: i.rerun.map((x) => `${x.key} (${KIND_LABEL[x.kind]}): ${x.summary}`),
          review: i.review.map((x) => `${x.key} (${KIND_LABEL[x.kind]}): ${x.summary}`),
          hazards: i.hazards.map((x) => `${x.key}: ${x.summary}`),
        };
      }),
    getReleaseReadiness: (p: Payload) =>
      safe(async () => {
        const projectKey = projectFrom(p);
        const version = str(p, 'version');
        if (!version) throw new Error('version is required');
        const r = readiness(await loadGraph(client, projectKey, cfg), cfg, version);
        return {
          summary: r.summary,
          ready: r.ready,
          coverage: r.coverage,
          blockers: r.blockers.map((b) => b.message),
          warnings: r.warnings.map((w) => w.message),
        };
      }),
    publishTraceReport: (p: Payload) =>
      safe(async () => {
        const projectKey = projectFrom(p);
        const version = str(p, 'version');
        const spaceId = str(p, 'spaceId');
        if (!version || !spaceId) throw new Error('version and spaceId are required');
        const g = await loadGraph(client, projectKey, cfg);
        return publishReport(client, g, cfg, { spaceId, version, projectKey });
      }),
  };
}
