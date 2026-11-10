import type { MatrixRow } from './matrix';
import type { Readiness } from './readiness';

/** Escape text for Confluence storage format (XHTML). */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Confluence storage-format body for a release trace report page. */
export function reportStorage(r: Readiness, rows: MatrixRow[], generatedAt: string): string {
  const status = r.ready
    ? '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">READY</ac:parameter></ac:structured-macro>'
    : '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Red</ac:parameter><ac:parameter ac:name="title">NOT READY</ac:parameter></ac:structured-macro>';
  const gapList = (title: string, gaps: Readiness['blockers']) =>
    gaps.length
      ? `<h2>${esc(title)}</h2><ul>${gaps.map((x) => `<li>${esc(x.message)}</li>`).join('')}</ul>`
      : '';
  const k = (xs: { key: string }[]) => esc(xs.map((x) => x.key).join(', ') || '-');
  const table =
    '<table><tbody><tr><th>User need</th><th>Design inputs</th><th>Design outputs</th><th>Verification</th><th>Validation</th></tr>' +
    rows
      .map(
        (row) =>
          `<tr><td>${esc(row.need.key)} ${esc(row.need.summary)}</td><td>${k(row.inputs)}</td><td>${k(row.outputs)}</td><td>${k(row.verifications)}</td><td>${k(row.validations)}</td></tr>`,
      )
      .join('') +
    '</tbody></table>';
  return [
    `<p>${status} ${esc(r.summary)}</p>`,
    `<p>Trace coverage: ${r.coverage.met} of ${r.coverage.required} required links (${r.coverage.percent}%). Generated ${esc(generatedAt)} by Tracewell from live Jira data.</p>`,
    gapList('Blockers', r.blockers),
    gapList('Warnings', r.warnings),
    '<h2>Trace matrix</h2>',
    table,
  ].join('');
}
