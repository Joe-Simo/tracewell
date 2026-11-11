import type { MatrixRow, RiskRow } from './matrix';
import type { Readiness } from './readiness';

/** Escape text for Confluence storage format (XHTML). */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function status(title: string, colour: 'Green' | 'Red' | 'Yellow' | 'Grey'): string {
  return `<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">${colour}</ac:parameter><ac:parameter ac:name="title">${esc(title)}</ac:parameter></ac:structured-macro>`;
}

const RISK_STATUS: Record<RiskRow['state'], [string, 'Green' | 'Yellow' | 'Red']> = {
  controlled: ['CONTROLLED', 'Green'],
  partial: ['PARTIAL', 'Yellow'],
  open: ['OPEN', 'Red'],
};

export interface ReportInput {
  readiness: Readiness;
  matrix: MatrixRow[];
  risks: RiskRow[];
  generatedAt: string;
  /** Jira site base URL, used to turn issue keys into links. Optional. */
  siteUrl?: string;
}

/** Confluence storage-format body for a release trace report page. */
export function reportStorage(input: ReportInput): string {
  const { readiness: r, matrix, risks, generatedAt, siteUrl } = input;
  const link = (key: string) =>
    siteUrl ? `<a href="${esc(`${siteUrl.replace(/\/$/, '')}/browse/${key}`)}">${esc(key)}</a>` : esc(key);
  const k = (xs: { key: string }[]) => (xs.length ? xs.map((x) => link(x.key)).join(', ') : '-');
  const gapList = (title: string, gaps: Readiness['blockers']) =>
    gaps.length ? `<h2>${esc(title)}</h2><ul>${gaps.map((x) => `<li>${esc(x.message)}</li>`).join('')}</ul>` : '';
  const trace =
    '<table><tbody><tr><th>User need</th><th>Design inputs</th><th>Design outputs</th><th>Verification</th><th>Validation</th></tr>' +
    matrix
      .map(
        (row) =>
          `<tr><td>${link(row.need.key)} ${esc(row.need.summary)}</td><td>${k(row.inputs)}</td><td>${k(row.outputs)}</td><td>${k(row.verifications)}</td><td>${k(row.validations)}</td></tr>`,
      )
      .join('') +
    '</tbody></table>';
  const risk = risks.length
    ? '<h2>Risk controls</h2><table><tbody><tr><th>Hazard</th><th>Risk controls</th><th>Verification</th><th>State</th></tr>' +
      risks
        .map(
          (row) =>
            `<tr><td>${link(row.hazard.key)} ${esc(row.hazard.summary)}</td><td>${k(row.controls)}</td><td>${k(row.verifications)}</td><td>${status(...RISK_STATUS[row.state])}</td></tr>`,
        )
        .join('') +
      '</tbody></table>'
    : '';
  return [
    `<p>${r.ready ? status('READY', 'Green') : status('NOT READY', 'Red')} ${esc(r.summary)}</p>`,
    `<p>Trace coverage: ${r.coverage.met} of ${r.coverage.required} required links (${r.coverage.percent}%). Generated ${esc(generatedAt)} by Tracewell from live Jira data. Each publish adds a new page version, so the page history is the audit trail.</p>`,
    gapList('Blockers', r.blockers),
    gapList('Warnings', r.warnings),
    '<h2>Trace matrix</h2>',
    trace,
    risk,
    '<p><em>Tracewell checks traceability. It does not certify compliance; a quality reviewer signs off.</em></p>',
  ].join('');
}
