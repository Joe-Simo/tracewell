import type { TraceConfig } from './config';
import { DEFAULT_CONFIG } from './config';
import { changeImpact } from './impact';
import type { ImpactReport } from './impact';
import { fromJira, isIssueKey, projectJql } from './jira';
import type { JiraIssue } from './jira';
import { traceMatrix } from './matrix';
import type { MatrixRow } from './matrix';
import { KIND_LABEL, buildGraph, downstreamOf, upstreamOf } from './model';
import type { TraceGraph } from './model';
import { releaseReadiness } from './readiness';
import type { Readiness } from './readiness';
import { coverage, findGaps, suspectSources } from './rules';
import type { Coverage, Gap } from './rules';
import { reportStorage } from './report';

/** Minimal Jira and Confluence transport, so the service runs under test without Forge. */
export interface AtlassianClient {
  jira(path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; body: unknown }>;
  confluence(path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; body: unknown }>;
}

export const FIELDS = [
  'summary',
  'issuetype',
  'labels',
  'status',
  'created',
  'updated',
  'resolutiondate',
  'fixVersions',
  'issuelinks',
];

/** Hard cap so one call stays inside Forge's invocation time limit. */
export const MAX_ISSUES = 1000;

export async function loadIssues(client: AtlassianClient, projectKey: string, cfg: TraceConfig = DEFAULT_CONFIG): Promise<JiraIssue[]> {
  const jql = projectJql(projectKey, cfg);
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const res = await client.jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: { jql, fields: FIELDS, expand: 'changelog', maxResults: 100, ...(nextPageToken ? { nextPageToken } : {}) },
    });
    if (res.status !== 200) throw new Error(`Jira search failed with HTTP ${res.status}`);
    const body = res.body as { issues?: JiraIssue[]; nextPageToken?: string };
    issues.push(...(body.issues ?? []));
    nextPageToken = body.nextPageToken;
  } while (nextPageToken && issues.length < MAX_ISSUES);
  return issues.slice(0, MAX_ISSUES);
}

export async function loadGraph(client: AtlassianClient, projectKey: string, cfg: TraceConfig = DEFAULT_CONFIG): Promise<TraceGraph> {
  const { items, links } = fromJira(await loadIssues(client, projectKey, cfg), cfg);
  return buildGraph(items, links);
}

export function projectOf(issueKey: string): string {
  if (!isIssueKey(issueKey)) throw new Error(`Invalid issue key: ${issueKey}`);
  return issueKey.replace(/-\d+$/, '');
}

export interface ProjectOverview {
  projectKey: string;
  counts: Record<string, number>;
  coverage: Coverage;
  gaps: Gap[];
  matrix: MatrixRow[];
}

export function overview(g: TraceGraph, cfg: TraceConfig, projectKey: string): ProjectOverview {
  const counts: Record<string, number> = {};
  for (const it of g.items.values()) counts[it.kind] = (counts[it.kind] ?? 0) + 1;
  return { projectKey, counts, coverage: coverage(g, cfg), gaps: findGaps(g, cfg), matrix: traceMatrix(g) };
}

export interface IssueTrace {
  key: string;
  kind: string;
  summary: string;
  upstream: { key: string; kind: string; summary: string }[];
  downstream: { key: string; kind: string; summary: string; status: string }[];
  gaps: Gap[];
  suspectBecause: string[];
  impact?: ImpactReport;
}

export function issueTrace(g: TraceGraph, cfg: TraceConfig, key: string): IssueTrace | undefined {
  const it = g.items.get(key);
  if (!it) return undefined;
  const brief = (x: { key: string; kind: keyof typeof KIND_LABEL; summary: string }) => ({
    key: x.key,
    kind: KIND_LABEL[x.kind],
    summary: x.summary,
  });
  return {
    key,
    kind: KIND_LABEL[it.kind],
    summary: it.summary,
    upstream: upstreamOf(g, key).map(brief),
    downstream: downstreamOf(g, key).map((d) => ({ ...brief(d), status: d.status })),
    gaps: findGaps(g, cfg, new Set([key])),
    suspectBecause: suspectSources(g, it).map((s) => s.key),
    impact: changeImpact(g, key),
  };
}

export function readiness(g: TraceGraph, cfg: TraceConfig, version: string): Readiness {
  return releaseReadiness(g, cfg, version);
}

/** Publish a trace report page to a Confluence space. Returns the new page id. */
export async function publishReport(
  client: AtlassianClient,
  g: TraceGraph,
  cfg: TraceConfig,
  args: { spaceId: string; version: string; projectKey: string; now?: string },
): Promise<{ id: string; title: string }> {
  if (!/^\d+$/.test(args.spaceId)) throw new Error('spaceId must be a numeric Confluence space id');
  const now = args.now ?? new Date().toISOString();
  const r = releaseReadiness(g, cfg, args.version);
  const title = `Trace report ${args.projectKey} ${args.version} (${now.slice(0, 16).replace('T', ' ')} UTC)`;
  const res = await client.confluence('/wiki/api/v2/pages', {
    method: 'POST',
    body: {
      spaceId: args.spaceId,
      status: 'current',
      title,
      body: { representation: 'storage', value: reportStorage(r, traceMatrix(g), now) },
    },
  });
  if (res.status !== 200 && res.status !== 201) throw new Error(`Confluence page create failed with HTTP ${res.status}`);
  return { id: String((res.body as { id?: string }).id ?? ''), title };
}
