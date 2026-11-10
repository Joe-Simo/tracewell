import type { TraceConfig } from './config';
import { KIND_LABEL, byKey, downstreamOf, upstreamOf } from './model';
import type { Kind, TraceGraph, TraceItem } from './model';

export type GapType = 'missingTrace' | 'orphan' | 'failed' | 'notRun' | 'suspect';
export type Severity = 'blocker' | 'warning';

export interface Gap {
  type: GapType;
  severity: Severity;
  key: string;
  kind: Kind;
  message: string;
  /** For missingTrace: the kind that is missing. */
  missing?: Kind;
  /** For suspect: upstream items changed after the test last passed. */
  changed?: string[];
}

export interface Coverage {
  /** Trace obligations the config requires in this scope. */
  required: number;
  /** Obligations met. */
  met: number;
  percent: number;
}

const TESTS: Kind[] = ['verification', 'validation'];

export function ancestors(g: TraceGraph, key: string): TraceItem[] {
  const seen = new Set<string>();
  const stack = [...(g.up.get(key) ?? [])];
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k) || k === key) continue;
    seen.add(k);
    for (const u of g.up.get(k) ?? []) stack.push(u);
  }
  return [...seen].map((k) => g.items.get(k)!).sort(byKey);
}

export function descendants(g: TraceGraph, key: string): TraceItem[] {
  const seen = new Set<string>();
  const stack = [...(g.down.get(key) ?? [])];
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k) || k === key) continue;
    seen.add(k);
    for (const d of g.down.get(k) ?? []) stack.push(d);
  }
  return [...seen].map((k) => g.items.get(k)!).sort(byKey);
}

/** Upstream items whose content changed after this test was last completed. */
export function suspectSources(g: TraceGraph, test: TraceItem): TraceItem[] {
  if (!TESTS.includes(test.kind) || !test.completedAt) return [];
  const done = Date.parse(test.completedAt);
  return ancestors(g, test.key).filter((a) => Date.parse(a.updated) > done);
}

export function findGaps(g: TraceGraph, cfg: TraceConfig, scope?: Set<string>): Gap[] {
  const gaps: Gap[] = [];
  const inScope = (k: string) => !scope || scope.has(k);
  for (const it of [...g.items.values()].sort(byKey)) {
    if (!inScope(it.key)) continue;
    const down = downstreamOf(g, it.key);
    for (const need of cfg.required[it.kind] ?? []) {
      if (!down.some((d) => d.kind === need)) {
        gaps.push({
          type: 'missingTrace',
          severity: 'blocker',
          key: it.key,
          kind: it.kind,
          missing: need,
          message: `${KIND_LABEL[it.kind]} ${it.key} has no ${KIND_LABEL[need].toLowerCase()}.`,
        });
      }
    }
    if (cfg.needsUpstream.includes(it.kind) && upstreamOf(g, it.key).length === 0) {
      gaps.push({
        type: 'orphan',
        severity: 'warning',
        key: it.key,
        kind: it.kind,
        message: `${KIND_LABEL[it.kind]} ${it.key} does not trace to anything upstream.`,
      });
    }
    if (TESTS.includes(it.kind)) {
      if (it.result === 'fail') {
        gaps.push({
          type: 'failed',
          severity: 'blocker',
          key: it.key,
          kind: it.kind,
          message: `${KIND_LABEL[it.kind]} ${it.key} failed.`,
        });
      } else if (!it.done || it.result === 'none' || !it.completedAt) {
        gaps.push({
          type: 'notRun',
          severity: 'blocker',
          key: it.key,
          kind: it.kind,
          message: `${KIND_LABEL[it.kind]} ${it.key} has not been run to completion.`,
        });
      } else {
        const changed = suspectSources(g, it);
        if (changed.length) {
          gaps.push({
            type: 'suspect',
            severity: 'blocker',
            key: it.key,
            kind: it.kind,
            changed: changed.map((c) => c.key),
            message: `${KIND_LABEL[it.kind]} ${it.key} passed before ${changed
              .map((c) => c.key)
              .join(', ')} changed. Re-run it.`,
          });
        }
      }
    }
  }
  return gaps;
}

export function coverage(g: TraceGraph, cfg: TraceConfig, scope?: Set<string>): Coverage {
  let required = 0;
  let met = 0;
  for (const it of g.items.values()) {
    if (scope && !scope.has(it.key)) continue;
    const down = downstreamOf(g, it.key);
    for (const need of cfg.required[it.kind] ?? []) {
      required++;
      if (down.some((d) => d.kind === need)) met++;
    }
  }
  const percent = required === 0 ? 100 : Math.round((met / required) * 100);
  return { required, met, percent };
}
