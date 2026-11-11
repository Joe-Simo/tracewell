import type { TraceConfig } from './config';
import { DEFAULT_CONFIG } from './config';
import { KIND_LABEL } from './model';
import type { TraceItem } from './model';
import { isIssueKey } from './jira';
import { riskMatrix } from './matrix';
import { releaseScope } from './readiness';
import type { AtlassianClient } from './service';
import { checkProjectKey, issueTrace, loadContext, overview, projectOf, publishReport, readiness } from './service';

/**
 * Rovo action and MCP tool handlers. Each returns plain text-friendly JSON;
 * errors come back as { error } so the agent can explain them instead of failing.
 */
export type Payload = Record<string, unknown> & {
  context?: { jira?: { projectKey?: string; issueKey?: string }; confluence?: { spaceKey?: string } };
};

function str(p: Payload, name: string): string | undefined {
  const v = p[name];
  if (typeof v === 'number') return String(v);
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function projectFrom(p: Payload): string {
  const k = (str(p, 'projectKey') ?? p.context?.jira?.projectKey ?? '').toUpperCase();
  if (!k) throw new Error('projectKey is required');
  return checkProjectKey(k);
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

const line = (x: TraceItem) => `${x.key} (${KIND_LABEL[x.kind]}): ${x.summary}`;
const notes = (errors: string[]) => (errors.length ? { configNotes: errors } : {});

/** Gap lists can be long; the agent only needs enough to act on. */
export const MAX_LINES = 40;
function capped(lines: string[]): string[] {
  return lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `...and ${lines.length - MAX_LINES} more`] : lines;
}

export function makeActions(client: AtlassianClient, base: TraceConfig = DEFAULT_CONFIG) {
  return {
    getTraceGaps: (p: Payload) =>
      safe(async () => {
        const projectKey = projectFrom(p);
        const { graph, cfg, configErrors } = await loadContext(client, projectKey, base);
        const o = overview(graph, cfg, projectKey);
        return {
          projectKey,
          coverage: o.coverage,
          blockers: capped(o.gaps.filter((g) => g.severity === 'blocker').map((g) => g.message)),
          warnings: capped(o.gaps.filter((g) => g.severity === 'warning').map((g) => g.message)),
          ...notes(configErrors),
        };
      }),
    getTraceChain: (p: Payload) =>
      safe(async () => {
        const key = issueFrom(p);
        const { graph, cfg } = await loadContext(client, projectOf(key), base);
        const t = issueTrace(graph, cfg, key);
        if (!t) return { error: `${key} is not a traced item. Give it a design-control issue type or a tw- label.` };
        const { impact, ...rest } = t;
        return { ...rest, gaps: t.gaps.map((g) => g.message), ifChanged: impact?.text };
      }),
    analyzeChangeImpact: (p: Payload) =>
      safe(async () => {
        const key = issueFrom(p);
        const { graph, cfg } = await loadContext(client, projectOf(key), base);
        const t = issueTrace(graph, cfg, key);
        if (!t?.impact) return { error: `${key} is not a traced item.` };
        const i = t.impact;
        return {
          key,
          text: i.text,
          rerun: i.rerun.map(line),
          review: i.review.map(line),
          hazards: i.hazards.map((x) => `${x.key}: ${x.summary}`),
          userNeeds: i.needs.map((x) => `${x.key}: ${x.summary}`),
        };
      }),
    getReleaseReadiness: (p: Payload) =>
      safe(async () => {
        const projectKey = projectFrom(p);
        const version = str(p, 'version');
        if (!version) throw new Error('version is required');
        const { graph, cfg, configErrors } = await loadContext(client, projectKey, base);
        const r = readiness(graph, cfg, version);
        return {
          verdict: r.ready ? 'READY' : 'NOT READY',
          summary: r.summary,
          ready: r.ready,
          coverage: r.coverage,
          blockers: capped(r.blockers.map((b) => b.message)),
          warnings: capped(r.warnings.map((w) => w.message)),
          ...notes(configErrors),
        };
      }),
    getRiskControls: (p: Payload) =>
      safe(async () => {
        const projectKey = projectFrom(p);
        const version = str(p, 'version');
        const { graph } = await loadContext(client, projectKey, base);
        const rows = riskMatrix(graph, version ? releaseScope(graph, version) : undefined);
        return {
          projectKey,
          ...(version ? { version } : {}),
          hazards: rows.length,
          controlled: rows.filter((r) => r.state === 'controlled').length,
          rows: capped(
            rows.map(
              (r) =>
                `${r.hazard.key} ${r.hazard.summary}: ${r.state.toUpperCase()}; controls ${r.controls.map((c) => c.key).join(', ') || 'none'}; verified by ${r.verifications.map((v) => `${v.key} ${v.result ?? 'none'}`).join(', ') || 'nothing'}`,
            ),
          ),
        };
      }),
    publishTraceReport: (p: Payload) =>
      safe(async () => {
        const projectKey = projectFrom(p);
        const version = str(p, 'version');
        const spaceId = str(p, 'spaceId');
        const spaceKey = str(p, 'spaceKey') ?? p.context?.confluence?.spaceKey;
        if (!version) throw new Error('version is required');
        if (!spaceId && !spaceKey) throw new Error('Give a Confluence space key (for example QMS) or space id');
        const { graph, cfg } = await loadContext(client, projectKey, base);
        return publishReport(client, graph, cfg, { spaceId, spaceKey, version, projectKey });
      }),
  };
}
