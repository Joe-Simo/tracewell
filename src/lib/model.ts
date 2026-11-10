// Core trace model. Pure data, no Forge imports, so every rule is unit tested.

export type Kind =
  | 'userNeed'
  | 'designInput'
  | 'designOutput'
  | 'verification'
  | 'validation'
  | 'hazard'
  | 'riskControl';

export const KINDS: Kind[] = [
  'userNeed',
  'designInput',
  'designOutput',
  'verification',
  'validation',
  'hazard',
  'riskControl',
];

export const KIND_LABEL: Record<Kind, string> = {
  userNeed: 'User need',
  designInput: 'Design input',
  designOutput: 'Design output',
  verification: 'Verification',
  validation: 'Validation',
  hazard: 'Hazard',
  riskControl: 'Risk control',
};

export type TestResult = 'pass' | 'fail' | 'none';

export interface TraceItem {
  key: string;
  kind: Kind;
  summary: string;
  status: string;
  done: boolean;
  /** ISO timestamp of the last change to the item's content. */
  updated: string;
  /** ISO timestamp when a verification or validation was last completed. */
  completedAt?: string;
  result?: TestResult;
  versions?: string[];
}

/** A directed trace link: `from` is downstream and traces to `to` (upstream). */
export interface TraceLink {
  from: string;
  to: string;
}

export interface TraceGraph {
  items: Map<string, TraceItem>;
  /** upstream keys for each item */
  up: Map<string, Set<string>>;
  /** downstream keys for each item */
  down: Map<string, Set<string>>;
}

export function buildGraph(items: TraceItem[], links: TraceLink[]): TraceGraph {
  const map = new Map<string, TraceItem>();
  for (const it of items) map.set(it.key, it);
  const up = new Map<string, Set<string>>();
  const down = new Map<string, Set<string>>();
  for (const k of map.keys()) {
    up.set(k, new Set());
    down.set(k, new Set());
  }
  for (const l of links) {
    if (l.from === l.to) continue;
    if (!map.has(l.from) || !map.has(l.to)) continue;
    up.get(l.from)!.add(l.to);
    down.get(l.to)!.add(l.from);
  }
  return { items: map, up, down };
}

export function upstreamOf(g: TraceGraph, key: string): TraceItem[] {
  return [...(g.up.get(key) ?? [])].map((k) => g.items.get(k)!).sort(byKey);
}

export function downstreamOf(g: TraceGraph, key: string): TraceItem[] {
  return [...(g.down.get(key) ?? [])].map((k) => g.items.get(k)!).sort(byKey);
}

export function byKey(a: { key: string }, b: { key: string }): number {
  const [pa, na] = splitKey(a.key);
  const [pb, nb] = splitKey(b.key);
  if (pa !== pb) return pa < pb ? -1 : 1;
  return na - nb;
}

function splitKey(k: string): [string, number] {
  const m = /^(.*?)-(\d+)$/.exec(k);
  return m ? [m[1], Number(m[2])] : [k, 0];
}
