import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/config';
import { contentUpdated, fromJira, isIssueKey, projectJql } from '../src/lib/jira';
import { issue, medProject } from './fixture';

describe('jira adapter', () => {
  const { items, links } = fromJira(medProject(), DEFAULT_CONFIG);
  it('keeps only design-control issues', () => {
    expect(items.map((i) => i.key)).not.toContain('MED-11');
    expect(items).toHaveLength(10);
  });
  it('derives link direction from the chain, not the Jira link direction', () => {
    expect(links).toContainEqual({ from: 'MED-2', to: 'MED-1' });
    expect(links).toContainEqual({ from: 'MED-4', to: 'MED-2' });
    expect(links).toContainEqual({ from: 'MED-7', to: 'MED-6' });
  });
  it('dedupes links seen from both ends', () => {
    expect(links.filter((l) => l.from === 'MED-2' && l.to === 'MED-1')).toHaveLength(1);
  });
  it('records test results and completion time', () => {
    const t = items.find((i) => i.key === 'MED-4')!;
    expect(t.result).toBe('pass');
    expect(t.completedAt).toBe('2026-11-05T12:00:00.000+0000');
    expect(items.find((i) => i.key === 'MED-8')!.result).toBe('none');
  });
  it('marks a test failed by label', () => {
    const { items: xs } = fromJira([issue({ key: 'Q-1', type: 'Test Case', summary: 't', done: true, labels: ['tw-failed'] })], DEFAULT_CONFIG);
    expect(xs[0].result).toBe('fail');
  });
  it('content time ignores status changes', () => {
    expect(contentUpdated(medProject()[1])).toBe('2026-11-08T09:00:00.000+0000');
    expect(contentUpdated(medProject()[0])).toBe('2026-11-01T10:00:00.000+0000');
  });
  it('falls back to updated when no changelog', () => {
    const i = issue({ key: 'Q-2', type: 'Hazard', summary: 'h' });
    delete i.changelog;
    expect(contentUpdated(i)).toBe('2026-11-09T10:00:00.000+0000');
  });
  it('same-level links use the outward side as downstream', () => {
    const { links: ls } = fromJira(
      [issue({ key: 'S-1', type: 'Requirement', summary: 'a', links: [{ type: 'Relates', out: 'S-2' }] }), issue({ key: 'S-2', type: 'Requirement', summary: 'b' })],
      DEFAULT_CONFIG,
    );
    expect(ls).toEqual([{ from: 'S-1', to: 'S-2' }]);
  });
  it('ignores link types not in the config', () => {
    const { links: ls } = fromJira(
      [issue({ key: 'S-1', type: 'Requirement', summary: 'a', links: [{ type: 'Blocks', out: 'S-2' }] }), issue({ key: 'S-2', type: 'User Need', summary: 'b' })],
      DEFAULT_CONFIG,
    );
    expect(ls).toEqual([]);
  });
  it('builds safe JQL and rejects injection', () => {
    expect(projectJql('MED', DEFAULT_CONFIG)).toMatch(/^project = "MED" AND/);
    expect(() => projectJql('MED" OR 1=1', DEFAULT_CONFIG)).toThrow();
    expect(isIssueKey('MED-12')).toBe(true);
    expect(isIssueKey('med-12')).toBe(false);
  });
});
