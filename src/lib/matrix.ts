import { KIND_LABEL, byKey, downstreamOf } from './model';
import type { Kind, TraceGraph, TraceItem } from './model';

export interface MatrixRow {
  need: TraceItem;
  inputs: TraceItem[];
  outputs: TraceItem[];
  verifications: TraceItem[];
  validations: TraceItem[];
}

function collect(g: TraceGraph, from: TraceItem[], kind: Kind): TraceItem[] {
  const out = new Map<string, TraceItem>();
  for (const f of from) for (const d of downstreamOf(g, f.key)) if (d.kind === kind) out.set(d.key, d);
  return [...out.values()].sort(byKey);
}

export function traceMatrix(g: TraceGraph): MatrixRow[] {
  const needs = [...g.items.values()].filter((i) => i.kind === 'userNeed').sort(byKey);
  return needs.map((need) => {
    const inputs = collect(g, [need], 'designInput');
    return {
      need,
      inputs,
      outputs: collect(g, inputs, 'designOutput'),
      verifications: collect(g, inputs, 'verification'),
      validations: collect(g, [need], 'validation'),
    };
  });
}

function cell(v: string): string {
  // Quote every cell and neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

const keys = (xs: TraceItem[]) => xs.map((x) => x.key).join(' ');

export function matrixCsv(rows: MatrixRow[]): string {
  const head = [
    KIND_LABEL.userNeed,
    'Summary',
    KIND_LABEL.designInput,
    KIND_LABEL.designOutput,
    KIND_LABEL.verification,
    KIND_LABEL.validation,
  ];
  const lines = [head.map(cell).join(',')];
  for (const r of rows) {
    lines.push(
      [r.need.key, r.need.summary, keys(r.inputs), keys(r.outputs), keys(r.verifications), keys(r.validations)]
        .map(cell)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
