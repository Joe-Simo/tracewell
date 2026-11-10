import { KIND_LABEL } from './model';
import type { TraceGraph, TraceItem } from './model';
import { ancestors, descendants } from './rules';

export interface ImpactReport {
  key: string;
  summary: string;
  /** Tests that must be re-run if this item changes. */
  rerun: TraceItem[];
  /** Design outputs and risk controls to review. */
  review: TraceItem[];
  /** Hazards whose controls sit below this item. */
  hazards: TraceItem[];
  /** User needs this item ultimately serves. */
  needs: TraceItem[];
  text: string;
}

export function changeImpact(g: TraceGraph, key: string): ImpactReport | undefined {
  const item = g.items.get(key);
  if (!item) return undefined;
  const below = descendants(g, key);
  const above = ancestors(g, key);
  const rerun = below.filter((i) => i.kind === 'verification' || i.kind === 'validation');
  const review = below.filter((i) => i.kind === 'designOutput' || i.kind === 'riskControl' || i.kind === 'designInput');
  const hazards = [...above, ...below].filter((i) => i.kind === 'hazard');
  const needs = above.filter((i) => i.kind === 'userNeed');
  const lines = [
    `Changing ${KIND_LABEL[item.kind].toLowerCase()} ${item.key} (${item.summary}) touches ${below.length} downstream item${below.length === 1 ? '' : 's'}.`,
  ];
  if (rerun.length) lines.push(`Re-run: ${rerun.map((i) => i.key).join(', ')}.`);
  if (review.length) lines.push(`Review: ${review.map((i) => i.key).join(', ')}.`);
  if (hazards.length) lines.push(`Hazards involved: ${hazards.map((i) => i.key).join(', ')}.`);
  if (needs.length) lines.push(`Serves user needs: ${needs.map((i) => i.key).join(', ')}.`);
  if (!below.length) lines.push('Nothing downstream depends on it.');
  return { key, summary: item.summary, rerun, review, hazards, needs, text: lines.join(' ') };
}
