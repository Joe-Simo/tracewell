import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/config';
import { fromJira } from '../src/lib/jira';
import { buildGraph } from '../src/lib/model';
import { ancestors, coverage, descendants, findGaps, suspectSources } from '../src/lib/rules';
import { changeImpact } from '../src/lib/impact';
import { releaseReadiness, releaseScope } from '../src/lib/readiness';
import { matrixCsv, riskMatrix, traceMatrix } from '../src/lib/matrix';
import { esc, reportStorage } from '../src/lib/report';
import { issue, medProject } from './fixture';

function graph(issues = medProject()) {
  const { items, links } = fromJira(issues, DEFAULT_CONFIG);
  return buildGraph(items, links);
}

describe('traversal', () => {
  const g = graph();
  it('walks ancestors and descendants', () => {
    expect(ancestors(g, 'MED-4').map((i) => i.key)).toEqual(['MED-1', 'MED-2']);
    expect(descendants(g, 'MED-1').map((i) => i.key)).toEqual(['MED-2', 'MED-3', 'MED-4', 'MED-5']);
  });
  it('survives cycles', () => {
    const c = buildGraph(
      [
        { key: 'C-1', kind: 'designInput', summary: '', status: '', done: false, updated: '2026-01-01T00:00:00Z' },
        { key: 'C-2', kind: 'designInput', summary: '', status: '', done: false, updated: '2026-01-01T00:00:00Z' },
      ],
      [
        { from: 'C-1', to: 'C-2' },
        { from: 'C-2', to: 'C-1' },
      ],
    );
    expect(ancestors(c, 'C-1').map((i) => i.key)).toEqual(['C-2']);
    expect(descendants(c, 'C-1').map((i) => i.key)).toEqual(['C-2']);
  });
});

describe('gaps', () => {
  const g = graph();
  const gaps = findGaps(g, DEFAULT_CONFIG);
  const of = (key: string) => gaps.filter((x) => x.key === key).map((x) => x.type);
  it('flags a suspect test when its requirement changed after it passed', () => {
    expect(suspectSources(g, g.items.get('MED-4')!).map((i) => i.key)).toEqual(['MED-2']);
    const s = gaps.find((x) => x.type === 'suspect')!;
    expect(s.key).toBe('MED-4');
    expect(s.message).toBe('Verification MED-4 passed before MED-2 changed. Re-run it.');
  });
  it('does not flag a validation that passed after its need was written', () => {
    expect(of('MED-5')).toEqual([]);
  });
  it('flags missing downstream links', () => {
    expect(of('MED-9')).toEqual(['missingTrace', 'missingTrace', 'orphan']);
    expect(gaps.find((x) => x.key === 'MED-6')).toBeUndefined();
  });
  it('flags open tests and orphans', () => {
    expect(of('MED-8')).toEqual(['notRun']);
    expect(of('MED-10')).toEqual(['orphan']);
  });
  it('flags failed tests as blockers', () => {
    const f = graph([
      issue({ key: 'F-1', type: 'Requirement', summary: 'r', links: [{ type: 'Verifies', in: 'F-2' }] }),
      issue({ key: 'F-2', type: 'Test Case', summary: 't', done: true, labels: ['tw-failed'], links: [{ type: 'Verifies', out: 'F-1' }] }),
    ]);
    const x = findGaps(f, DEFAULT_CONFIG).find((y) => y.key === 'F-2')!;
    expect(x.type).toBe('failed');
    expect(x.severity).toBe('blocker');
  });
  it('respects scope', () => {
    expect(findGaps(g, DEFAULT_CONFIG, new Set(['MED-3']))).toEqual([]);
  });
  it('computes coverage of required links', () => {
    expect(coverage(g, DEFAULT_CONFIG)).toEqual({ required: 8, met: 6, percent: 75 });
    expect(coverage(g, DEFAULT_CONFIG, new Set())).toEqual({ required: 0, met: 0, percent: 100 });
  });
});

describe('change impact', () => {
  const g = graph();
  it('lists tests to re-run and items to review', () => {
    const r = changeImpact(g, 'MED-1')!;
    expect(r.rerun.map((i) => i.key)).toEqual(['MED-4', 'MED-5']);
    expect(r.review.map((i) => i.key)).toEqual(['MED-2', 'MED-3']);
    expect(r.text).toContain('touches 4 downstream items');
  });
  it('names hazards on the path', () => {
    const r = changeImpact(g, 'MED-7')!;
    expect(r.hazards.map((i) => i.key)).toEqual(['MED-6']);
    expect(r.rerun.map((i) => i.key)).toEqual(['MED-8']);
  });
  it('handles leaves and unknown keys', () => {
    expect(changeImpact(g, 'MED-4')!.text).toContain('Nothing downstream depends on it.');
    expect(changeImpact(g, 'NOPE-1')).toBeUndefined();
  });
});

describe('release readiness', () => {
  const g = graph();
  it('scopes a release to its items and their full chains', () => {
    expect([...releaseScope(g, '2.1.0')].sort()).toEqual(['MED-1', 'MED-2', 'MED-3', 'MED-4', 'MED-5', 'MED-6', 'MED-7', 'MED-8']);
  });
  it('is not ready while a test is suspect or open', () => {
    const r = releaseReadiness(g, DEFAULT_CONFIG, '2.1.0');
    expect(r.ready).toBe(false);
    expect(r.blockers.map((b) => `${b.type}:${b.key}`)).toEqual(['suspect:MED-4', 'notRun:MED-8']);
    expect(r.summary).toBe('2.1.0 is not ready: 2 blockers across 8 traced items, coverage 100%.');
  });
  it('is ready once tests are re-run', () => {
    const issues = medProject();
    issues[3].fields.resolutiondate = '2026-11-09T12:00:00.000+0000';
    issues[7].fields.status = { name: 'Done', statusCategory: { key: 'done' } };
    issues[7].fields.resolutiondate = '2026-11-09T12:00:00.000+0000';
    const r = releaseReadiness(graph(issues), DEFAULT_CONFIG, '2.1.0');
    expect(r.ready).toBe(true);
    expect(r.summary).toBe('2.1.0 is ready: 8 traced items, coverage 100%, no blockers.');
  });
  it('says so when a version has no traced items', () => {
    const r = releaseReadiness(g, DEFAULT_CONFIG, '9.9.9');
    expect(r.ready).toBe(false);
    expect(r.summary).toBe('No traced items are assigned to 9.9.9.');
  });
});

describe('matrix and report', () => {
  const g = graph();
  it('builds one row per user need', () => {
    const rows = traceMatrix(g);
    expect(rows).toHaveLength(1);
    expect(rows[0].inputs.map((i) => i.key)).toEqual(['MED-2']);
    expect(rows[0].verifications.map((i) => i.key)).toEqual(['MED-4']);
    expect(rows[0].validations.map((i) => i.key)).toEqual(['MED-5']);
  });
  it('writes CSV with quoting and formula guards', () => {
    const rows = traceMatrix(g);
    rows[0].need = { ...rows[0].need, summary: '=HYPERLINK("x")' };
    const csv = matrixCsv(rows);
    expect(csv.split('\r\n')[0]).toBe('"User need","Summary","Design input","Design output","Verification","Validation"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('escapes storage format and shows the verdict', () => {
    expect(esc('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
    const html = reportStorage({
      readiness: releaseReadiness(g, DEFAULT_CONFIG, '2.1.0'),
      matrix: traceMatrix(g),
      risks: riskMatrix(g),
      generatedAt: '2026-11-09 18:00 UTC',
      siteUrl: 'https://example.atlassian.net/',
    });
    expect(html).toContain('NOT READY');
    expect(html).toContain('<h2>Blockers</h2>');
    expect(html).toContain('>MED-1</a> Patients get a safe bolus suggestion');
    expect(html).toContain('href="https://example.atlassian.net/browse/MED-4"');
    expect(html).toContain('<h2>Risk controls</h2>');
    expect(html).toContain('PARTIAL');
  });
  it('omits links when the site URL is unknown', () => {
    const html = reportStorage({ readiness: releaseReadiness(g, DEFAULT_CONFIG, '2.1.0'), matrix: traceMatrix(g), risks: [], generatedAt: 'now' });
    expect(html).not.toContain('<a href');
    expect(html).not.toContain('Risk controls');
  });
  it('scopes the matrix to a release', () => {
    expect(traceMatrix(g, new Set(['MED-9']))).toEqual([]);
    expect(traceMatrix(g, releaseScope(g, '2.1.0'))).toHaveLength(1);
  });
});

describe('risk matrix', () => {
  it('marks a hazard partial while its control is unverified', () => {
    const rows = riskMatrix(graph());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'partial' });
    expect(rows[0].controls.map((c) => c.key)).toEqual(['MED-7']);
    expect(rows[0].verifications.map((c) => c.key)).toEqual(['MED-8']);
  });
  it('marks a hazard controlled once every control has a passing test', () => {
    const issues = medProject();
    issues[7].fields.status = { name: 'Done', statusCategory: { key: 'done' } };
    issues[7].fields.resolutiondate = '2026-11-09T12:00:00.000+0000';
    expect(riskMatrix(graph(issues))[0].state).toBe('controlled');
  });
  it('marks a hazard with no control open', () => {
    const rows = riskMatrix(graph([issue({ key: 'H-1', type: 'Hazard', summary: 'Battery fire' })]));
    expect(rows[0].state).toBe('open');
  });
});
