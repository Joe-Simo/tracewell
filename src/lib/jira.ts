import type { TraceConfig } from './config';
import { kindFor } from './config';
import type { Kind, TraceItem, TraceLink } from './model';

/** The subset of a Jira Cloud REST v3 issue that Tracewell reads. */
export interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    issuetype?: { name?: string };
    labels?: string[];
    status?: { name?: string; statusCategory?: { key?: string } };
    created?: string;
    updated?: string;
    resolutiondate?: string | null;
    fixVersions?: { name: string }[];
    issuelinks?: JiraLink[];
  };
  changelog?: { histories?: JiraHistory[] };
}

export interface JiraLink {
  type?: { name?: string };
  outwardIssue?: { key: string };
  inwardIssue?: { key: string };
}

export interface JiraHistory {
  created: string;
  items: { field: string }[];
}

/** Fields whose change makes downstream tests suspect. Status moves and comments do not. */
export const CONTENT_FIELDS = ['summary', 'description', 'Acceptance Criteria', 'labels'];

const RANK: Record<Kind, number> = {
  userNeed: 0,
  hazard: 0,
  designInput: 1,
  riskControl: 1,
  designOutput: 2,
  verification: 3,
  validation: 3,
};

/** Last time the item's content (not its status) changed. */
export function contentUpdated(issue: JiraIssue, fields: string[] = CONTENT_FIELDS): string {
  const created = issue.fields.created ?? issue.fields.updated ?? new Date(0).toISOString();
  const histories = issue.changelog?.histories;
  if (!histories) return issue.fields.updated ?? created;
  let latest = Date.parse(created);
  let latestIso = created;
  for (const h of histories) {
    if (!h.items.some((i) => fields.includes(i.field))) continue;
    const t = Date.parse(h.created);
    if (t > latest) {
      latest = t;
      latestIso = h.created;
    }
  }
  return latestIso;
}

export function toItem(issue: JiraIssue, cfg: TraceConfig): TraceItem | undefined {
  const f = issue.fields;
  const kind = kindFor(cfg, f.issuetype?.name ?? '', f.labels ?? []);
  if (!kind) return undefined;
  const done = f.status?.statusCategory?.key === 'done';
  const failed = (f.labels ?? []).map((l) => l.toLowerCase()).includes(cfg.failLabel);
  const isTest = kind === 'verification' || kind === 'validation';
  const item: TraceItem = {
    key: issue.key,
    kind,
    summary: f.summary ?? '',
    status: f.status?.name ?? '',
    done,
    updated: contentUpdated(issue),
    versions: (f.fixVersions ?? []).map((v) => v.name),
  };
  if (isTest) {
    item.result = failed ? 'fail' : done ? 'pass' : 'none';
    if (done && f.resolutiondate) item.completedAt = f.resolutiondate;
  }
  return item;
}

/**
 * Turn Jira issue links into trace links. Direction comes from the kinds:
 * the item further down the design-control chain traces to the one above.
 * When both sit at the same level, the outward side is treated as downstream.
 */
export function toLinks(issues: JiraIssue[], items: Map<string, TraceItem>, cfg: TraceConfig): TraceLink[] {
  const allowed = new Set(cfg.linkTypes.map((t) => t.toLowerCase()));
  const seen = new Set<string>();
  const out: TraceLink[] = [];
  for (const issue of issues) {
    const self = items.get(issue.key);
    if (!self) continue;
    for (const l of issue.fields.issuelinks ?? []) {
      if (!allowed.has((l.type?.name ?? '').toLowerCase())) continue;
      const otherKey = l.outwardIssue?.key ?? l.inwardIssue?.key;
      const other = otherKey ? items.get(otherKey) : undefined;
      if (!other) continue;
      let from: TraceItem;
      let to: TraceItem;
      if (RANK[self.kind] !== RANK[other.kind]) {
        [from, to] = RANK[self.kind] > RANK[other.kind] ? [self, other] : [other, self];
      } else {
        [from, to] = l.outwardIssue ? [self, other] : [other, self];
      }
      const id = `${from.key}>${to.key}`;
      if (seen.has(id) || seen.has(`${to.key}>${from.key}`)) continue;
      seen.add(id);
      out.push({ from: from.key, to: to.key });
    }
  }
  return out;
}

export function fromJira(issues: JiraIssue[], cfg: TraceConfig): { items: TraceItem[]; links: TraceLink[] } {
  const map = new Map<string, TraceItem>();
  for (const i of issues) {
    const it = toItem(i, cfg);
    if (it) map.set(it.key, it);
  }
  return { items: [...map.values()], links: toLinks(issues, map, cfg) };
}

/** JQL for the issues Tracewell reads in a project. Keys are validated to block JQL injection. */
export function projectJql(projectKey: string, cfg: TraceConfig): string {
  if (!/^[A-Z][A-Z0-9_]{0,49}$/.test(projectKey)) throw new Error(`Invalid project key: ${projectKey}`);
  const types = Object.keys(cfg.issueTypes).map((t) => `"${t.replace(/"/g, '')}"`);
  const labels = Object.keys(cfg.labels).map((l) => `"${l.replace(/"/g, '')}"`);
  return `project = "${projectKey}" AND (issuetype in (${types.join(', ')}) OR labels in (${labels.join(', ')})) ORDER BY key ASC`;
}

export function isIssueKey(k: string): boolean {
  return /^[A-Z][A-Z0-9_]{0,49}-\d+$/.test(k);
}
