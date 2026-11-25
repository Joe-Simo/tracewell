import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/config';
import { fromJira } from '../src/lib/jira';
import { buildGraph } from '../src/lib/model';
import { findGaps } from '../src/lib/rules';
import { onIssueUpdated } from '../src/lib/trigger';
import { fakeClient } from './fake-client';
import { issue } from './fixture';

// The README "Try it in 3 minutes" flow: two plain Jira Tasks that carry Tracewell labels,
// one relates link, the test moved to Done, then the requirement's description is edited.
const tasks = (edited: boolean) => [
  issue({
    key: 'TRY-1',
    type: 'Task',
    summary: 'Cap dose at 25 U',
    labels: ['tw-design-input'],
    created: '2026-11-20T10:00:00.000+0000',
    links: [{ type: 'Relates', in: 'TRY-2' }],
    edits: edited ? [{ at: '2026-11-20T10:10:00.000+0000', field: 'description' }] : [],
  }),
  issue({
    key: 'TRY-2',
    type: 'Task',
    summary: 'Dose cap test',
    labels: ['tw-verification'],
    done: true,
    created: '2026-11-20T10:01:00.000+0000',
    resolved: '2026-11-20T10:05:00.000+0000',
    links: [{ type: 'Relates', out: 'TRY-1' }],
  }),
];

const gapsFor = (edited: boolean) => {
  const { items, links } = fromJira(tasks(edited), DEFAULT_CONFIG);
  return findGaps(buildGraph(items, links), DEFAULT_CONFIG);
};

describe('README quick path with plain Tasks and labels', () => {
  it('before the edit the test has passed and is not suspect', () => {
    const gaps = gapsFor(false);
    expect(gaps.map((g) => `${g.type}:${g.key}`).sort()).toEqual(['missingTrace:TRY-1', 'orphan:TRY-1']);
    expect(gaps.find((g) => g.type === 'missingTrace')?.missing).toBe('designOutput');
  });
  it('after the description edit the passed test is suspect', () => {
    const suspect = gapsFor(true).filter((g) => g.type === 'suspect');
    expect(suspect).toHaveLength(1);
    expect(suspect[0]).toMatchObject({ key: 'TRY-2', severity: 'blocker', changed: ['TRY-1'] });
  });
  it('the trigger comments on the test and on the requirement', async () => {
    const c = fakeClient({ pages: [tasks(true)] });
    const r = await onIssueUpdated(c, { issue: { key: 'TRY-1' }, changelog: { items: [{ field: 'description' }] } });
    expect(r).toEqual({ key: 'TRY-1', commented: ['TRY-2', 'TRY-1'], failed: [] });
  });
});
