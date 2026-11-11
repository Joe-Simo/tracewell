import type { TraceConfig } from './config';
import { CONFIG_PROPERTY, DEFAULT_CONFIG, parseConfig } from './config';
import { changeImpact } from './impact';
import type { ImpactReport } from './impact';
import { fromJira, isIssueKey, projectJql } from './jira';
import type { JiraIssue } from './jira';
import { riskMatrix, traceMatrix } from './matrix';
import type { MatrixRow, RiskRow } from './matrix';
import { KIND_LABEL, buildGraph, downstreamOf, upstreamOf } from './model';
import type { TraceGraph } from './model';
import { releaseReadiness, releaseScope } from './readiness';
import type { Readiness } from './readiness';
import { coverage, findGaps, suspectSources } from './rules';
import type { Coverage, Gap, GapType } from './rules';
import { reportStorage } from './report';

export interface ClientResponse {
  status: number;
  body: unknown;
}

/** Minimal Jira and Confluence transport, so the service runs under test without Forge. */
export interface AtlassianClient {
  jira(path: string, init?: { method?: string; body?: unknown }): Promise<ClientResponse>;
  confluence(path: string, init?: { method?: string; body?: unknown }): Promise<ClientResponse>;
}

export const FIELDS = [
  'summary',
  'issuetype',
  'labels',
  'status',
  'created',
  'updated',
  'resolutiondate',
  'statuscategorychangedate',
  'fixVersions',
  'issuelinks',
];

/** Hard cap so one call stays inside Forge's invocation time limit. */
export const MAX_ISSUES = 1000;

export function checkProjectKey(projectKey: string): string {
  if (!/^[A-Z][A-Z0-9_]{0,49}$/.test(projectKey)) throw new Error(`Invalid project key: ${projectKey}`);
  return projectKey;
}

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

const propertyPath = (projectKey: string) =>
  `/rest/api/3/project/${checkProjectKey(projectKey)}/properties/${CONFIG_PROPERTY}`;

/** Read the project's Tracewell settings. A missing property means defaults. */
export async function loadConfig(
  client: AtlassianClient,
  projectKey: string,
  base: TraceConfig = DEFAULT_CONFIG,
): Promise<{ config: TraceConfig; errors: string[]; raw: unknown }> {
  const res = await client.jira(propertyPath(projectKey));
  if (res.status === 404) return { config: base, errors: [], raw: null };
  if (res.status !== 200) return { config: base, errors: [`Could not read project settings (HTTP ${res.status}); using defaults.`], raw: null };
  const raw = (res.body as { value?: unknown })?.value ?? null;
  return { ...parseConfig(raw, base), raw };
}

/** Validate then store the project's Tracewell settings. Nothing is saved if any entry is invalid. */
export async function saveConfig(client: AtlassianClient, projectKey: string, raw: unknown): Promise<{ saved: boolean; errors: string[] }> {
  const { errors } = parseConfig(raw);
  if (errors.length) return { saved: false, errors };
  const res = await client.jira(propertyPath(projectKey), { method: 'PUT', body: raw });
  if (res.status !== 200 && res.status !== 201) return { saved: false, errors: [`Jira refused the settings (HTTP ${res.status}). You need project admin rights.`] };
  return { saved: true, errors: [] };
}

export interface TraceContext {
  graph: TraceGraph;
  cfg: TraceConfig;
  configErrors: string[];
}

export async function loadContext(client: AtlassianClient, projectKey: string, base: TraceConfig = DEFAULT_CONFIG): Promise<TraceContext> {
  const { config, errors } = await loadConfig(client, projectKey, base);
  return { graph: await loadGraph(client, projectKey, config), cfg: config, configErrors: errors };
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
  counts: { kind: string; label: string; count: number }[];
  gapCounts: { type: GapType; count: number }[];
  coverage: Coverage;
  gaps: Gap[];
  matrix: MatrixRow[];
  risks: RiskRow[];
  versions: string[];
}

export function overview(g: TraceGraph, cfg: TraceConfig, projectKey: string): ProjectOverview {
  const byKind = new Map<string, number>();
  const versions = new Set<string>();
  for (const it of g.items.values()) {
    byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + 1);
    for (const v of it.versions ?? []) versions.add(v);
  }
  const gaps = findGaps(g, cfg);
  const gapCount = new Map<GapType, number>();
  for (const x of gaps) gapCount.set(x.type, (gapCount.get(x.type) ?? 0) + 1);
  return {
    projectKey,
    counts: (Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[])
      .filter((k) => byKind.has(k))
      .map((k) => ({ kind: k, label: KIND_LABEL[k], count: byKind.get(k)! })),
    gapCounts: [...gapCount.entries()].map(([type, count]) => ({ type, count })),
    coverage: coverage(g, cfg),
    gaps,
    matrix: traceMatrix(g),
    risks: riskMatrix(g),
    versions: [...versions].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
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

/** Resolve a Confluence space from a numeric id or a space key. */
export async function resolveSpace(client: AtlassianClient, args: { spaceId?: string; spaceKey?: string }): Promise<string> {
  if (args.spaceId) {
    if (!/^\d+$/.test(args.spaceId)) throw new Error('spaceId must be a numeric Confluence space id');
    return args.spaceId;
  }
  const key = args.spaceKey ?? '';
  if (!/^~?[A-Za-z0-9]{1,255}$/.test(key)) throw new Error('Give a Confluence space key (for example QMS) or a numeric space id');
  const res = await client.confluence(`/wiki/api/v2/spaces?keys=${encodeURIComponent(key)}&limit=1`);
  if (res.status !== 200) throw new Error(`Confluence space lookup failed with HTTP ${res.status}`);
  const id = (res.body as { results?: { id?: string | number }[] })?.results?.[0]?.id;
  if (id === undefined) throw new Error(`No Confluence space with key ${key}, or you cannot see it`);
  return String(id);
}

export function reportTitle(projectKey: string, version: string): string {
  return `Tracewell trace report: ${projectKey} ${version}`;
}

export interface PublishResult {
  id: string;
  title: string;
  version: number;
  created: boolean;
  url?: string;
  ready: boolean;
  summary: string;
}

async function siteUrl(client: AtlassianClient): Promise<string | undefined> {
  try {
    const res = await client.jira('/rest/api/3/serverInfo');
    return res.status === 200 ? (res.body as { baseUrl?: string })?.baseUrl : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Publish the release trace report to Confluence. The first publish creates the
 * page; later publishes for the same project and version add a new version of
 * the same page, so Confluence page history becomes the audit trail.
 */
export async function publishReport(
  client: AtlassianClient,
  g: TraceGraph,
  cfg: TraceConfig,
  args: { spaceId?: string; spaceKey?: string; version: string; projectKey: string; now?: string },
): Promise<PublishResult> {
  checkProjectKey(args.projectKey);
  if (!args.version.trim() || args.version.length > 255) throw new Error('version is required');
  const spaceId = await resolveSpace(client, args);
  const now = args.now ?? new Date().toISOString();
  const r = releaseReadiness(g, cfg, args.version);
  const scope = releaseScope(g, args.version);
  const value = reportStorage({
    readiness: r,
    matrix: traceMatrix(g, scope),
    risks: riskMatrix(g, scope),
    generatedAt: `${now.slice(0, 16).replace('T', ' ')} UTC`,
    siteUrl: await siteUrl(client),
  });
  const title = reportTitle(args.projectKey, args.version);
  const found = await client.confluence(
    `/wiki/api/v2/pages?space-id=${spaceId}&title=${encodeURIComponent(title)}&status=current&limit=1`,
  );
  const existing =
    found.status === 200 ? (found.body as { results?: { id: string; version?: { number?: number } }[] })?.results?.[0] : undefined;
  const body = { representation: 'storage', value };
  const message = `${r.ready ? 'READY' : 'NOT READY'}: ${r.summary}`.slice(0, 255);
  const res = existing
    ? await client.confluence(`/wiki/api/v2/pages/${encodeURIComponent(existing.id)}`, {
        method: 'PUT',
        body: { id: existing.id, status: 'current', title, body, version: { number: (existing.version?.number ?? 1) + 1, message } },
      })
    : await client.confluence('/wiki/api/v2/pages', { method: 'POST', body: { spaceId, status: 'current', title, body } });
  if (res.status !== 200 && res.status !== 201)
    throw new Error(`Confluence page ${existing ? 'update' : 'create'} failed with HTTP ${res.status}`);
  const out = res.body as { id?: string | number; version?: { number?: number }; _links?: { base?: string; webui?: string } };
  const url = out?._links?.webui ? `${out._links.base ?? ''}${out._links.webui}` : undefined;
  return {
    id: String(out?.id ?? existing?.id ?? ''),
    title,
    version: out?.version?.number ?? (existing ? (existing.version?.number ?? 1) + 1 : 1),
    created: !existing,
    ...(url ? { url } : {}),
    ready: r.ready,
    summary: r.summary,
  };
}
