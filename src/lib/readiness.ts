import type { TraceConfig } from './config';
import type { TraceGraph } from './model';
import { ancestors, coverage, descendants, findGaps } from './rules';
import type { Coverage, Gap } from './rules';

export interface Readiness {
  version: string;
  ready: boolean;
  scope: number;
  coverage: Coverage;
  blockers: Gap[];
  warnings: Gap[];
  summary: string;
}

/** Items in a release plus everything they trace to, up and down. */
export function releaseScope(g: TraceGraph, version: string): Set<string> {
  const scope = new Set<string>();
  for (const it of g.items.values()) {
    if (!it.versions?.includes(version)) continue;
    scope.add(it.key);
    for (const a of ancestors(g, it.key)) scope.add(a.key);
    for (const d of descendants(g, it.key)) scope.add(d.key);
  }
  return scope;
}

export function releaseReadiness(g: TraceGraph, cfg: TraceConfig, version: string): Readiness {
  const scope = releaseScope(g, version);
  const gaps = findGaps(g, cfg, scope);
  const blockers = gaps.filter((x) => x.severity === 'blocker');
  const warnings = gaps.filter((x) => x.severity === 'warning');
  const cov = coverage(g, cfg, scope);
  const ready = scope.size > 0 && blockers.length === 0;
  const summary =
    scope.size === 0
      ? `No traced items are assigned to ${version}.`
      : ready
        ? `${version} is ready: ${scope.size} traced items, coverage ${cov.percent}%, no blockers${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}.`
        : `${version} is not ready: ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} across ${scope.size} traced items, coverage ${cov.percent}%.`;
  return { version, ready, scope: scope.size, coverage: cov, blockers, warnings, summary };
}
