// Pure presentation helpers shared by the UI Kit screens, kept here so they are unit tested.

export type Appearance = 'default' | 'success' | 'removed' | 'inprogress' | 'new' | 'moved';

export const GAP_LABEL: Record<string, string> = {
  missingTrace: 'Missing trace',
  orphan: 'Orphan',
  failed: 'Failed test',
  notRun: 'Not run',
  suspect: 'Suspect result',
};

export const GAP_ORDER = ['failed', 'suspect', 'notRun', 'missingTrace', 'orphan'];

export interface GapLike {
  type: string;
  severity: string;
  key: string;
  message: string;
}

/** Group gaps by type in the order a reviewer should fix them. */
export function groupGaps<T extends GapLike>(gaps: T[]): { type: string; label: string; gaps: T[] }[] {
  const by = new Map<string, T[]>();
  for (const g of gaps) by.set(g.type, [...(by.get(g.type) ?? []), g]);
  return GAP_ORDER.filter((t) => by.has(t)).map((t) => ({ type: t, label: GAP_LABEL[t] ?? t, gaps: by.get(t)! }));
}

export function riskAppearance(state: string): Appearance {
  return state === 'controlled' ? 'success' : state === 'partial' ? 'moved' : 'removed';
}

export function coverageAppearance(percent: number): Appearance {
  return percent >= 100 ? 'success' : percent >= 80 ? 'moved' : 'removed';
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Chart rows for gap counts, in fix order. */
export function gapChart(counts: { type: string; count: number }[]): { label: string; count: number }[] {
  const m = new Map(counts.map((c) => [c.type, c.count]));
  return GAP_ORDER.filter((t) => m.has(t)).map((t) => ({ label: GAP_LABEL[t], count: m.get(t)! }));
}

export function askPrompt(key: string, kind: string): string {
  return kind === 'Verification' || kind === 'Validation'
    ? `Explain the trace chain for ${key} and whether its result is still valid.`
    : `What must be re-tested and reviewed if ${key} changes?`;
}
