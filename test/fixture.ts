import type { JiraIssue } from '../src/lib/jira';

type Spec = {
  key: string;
  type: string;
  summary: string;
  done?: boolean;
  created?: string;
  resolved?: string;
  labels?: string[];
  versions?: string[];
  links?: { type: string; out?: string; in?: string }[];
  edits?: { at: string; field: string }[];
};

export function issue(s: Spec): JiraIssue {
  return {
    key: s.key,
    fields: {
      summary: s.summary,
      issuetype: { name: s.type },
      labels: s.labels ?? [],
      status: { name: s.done ? 'Done' : 'In Progress', statusCategory: { key: s.done ? 'done' : 'indeterminate' } },
      created: s.created ?? '2026-11-01T10:00:00.000+0000',
      updated: '2026-11-09T10:00:00.000+0000',
      resolutiondate: s.resolved ?? null,
      fixVersions: (s.versions ?? []).map((name) => ({ name })),
      issuelinks: (s.links ?? []).map((l) => ({
        type: { name: l.type },
        ...(l.out ? { outwardIssue: { key: l.out } } : {}),
        ...(l.in ? { inwardIssue: { key: l.in } } : {}),
      })),
    },
    changelog: { histories: (s.edits ?? []).map((e) => ({ created: e.at, items: [{ field: e.field }] })) },
  };
}

/**
 * A small insulin-dose calculator project:
 * MED-1 user need -> MED-2 design input -> MED-3 design output, MED-4 verification (passed)
 * MED-1 -> MED-5 validation (passed)
 * MED-6 hazard -> MED-7 risk control -> MED-8 verification (open)
 * MED-9 design input with nothing below it, MED-10 orphan verification.
 * MED-2 was edited after MED-4 passed, so MED-4 is suspect.
 */
export function medProject(): JiraIssue[] {
  return [
    issue({ key: 'MED-1', type: 'User Need', summary: 'Patients get a safe bolus suggestion', versions: ['2.1.0'], links: [{ type: 'Traces', in: 'MED-2' }, { type: 'Traces', in: 'MED-5' }] }),
    issue({
      key: 'MED-2',
      type: 'Requirement',
      summary: 'Cap suggested bolus at 25 units',
      versions: ['2.1.0'],
      links: [{ type: 'Traces', out: 'MED-1' }, { type: 'Implements', in: 'MED-3' }, { type: 'Verifies', in: 'MED-4' }],
      edits: [
        { at: '2026-11-08T09:00:00.000+0000', field: 'description' },
        { at: '2026-11-09T09:00:00.000+0000', field: 'status' },
      ],
    }),
    issue({ key: 'MED-3', type: 'Design Output', summary: 'Dose cap in calculator module', done: true, links: [{ type: 'Implements', out: 'MED-2' }] }),
    issue({ key: 'MED-4', type: 'Test Case', summary: 'Bolus above cap is clamped', done: true, resolved: '2026-11-05T12:00:00.000+0000', links: [{ type: 'Verifies', out: 'MED-2' }] }),
    issue({ key: 'MED-5', type: 'Validation', summary: 'Clinician usability study', done: true, resolved: '2026-11-06T12:00:00.000+0000', links: [{ type: 'Traces', out: 'MED-1' }] }),
    issue({ key: 'MED-6', type: 'Hazard', summary: 'Overdose from wrong unit entry', versions: ['2.1.0'], links: [{ type: 'Mitigates', in: 'MED-7' }] }),
    issue({ key: 'MED-7', type: 'Risk Control', summary: 'Confirm units before dosing', links: [{ type: 'Mitigates', out: 'MED-6' }, { type: 'Verifies', in: 'MED-8' }] }),
    issue({ key: 'MED-8', type: 'Test Case', summary: 'Unit confirmation dialog appears', links: [{ type: 'Verifies', out: 'MED-7' }] }),
    issue({ key: 'MED-9', type: 'Requirement', summary: 'Show last dose time', versions: ['2.2.0'], links: [] }),
    issue({ key: 'MED-10', type: 'Test Case', summary: 'Legacy smoke test', done: true, resolved: '2026-11-02T12:00:00.000+0000' }),
    issue({ key: 'MED-11', type: 'Story', summary: 'Not a design-control item', links: [{ type: 'Relates', out: 'MED-2' }] }),
  ];
}
