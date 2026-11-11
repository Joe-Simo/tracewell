import { describe, expect, it } from 'vitest';
import { askPrompt, coverageAppearance, gapChart, groupGaps, plural, riskAppearance } from '../src/frontend/view';

describe('view helpers', () => {
  it('groups gaps in fix order', () => {
    const g = (type: string, key: string) => ({ type, key, severity: 'blocker', message: `${type} ${key}` });
    const groups = groupGaps([g('orphan', 'A-1'), g('failed', 'A-2'), g('orphan', 'A-3'), g('suspect', 'A-4')]);
    expect(groups.map((x) => x.label)).toEqual(['Failed test', 'Suspect result', 'Orphan']);
    expect(groups[2].gaps.map((x) => x.key)).toEqual(['A-1', 'A-3']);
  });
  it('maps states to lozenge appearances', () => {
    expect(riskAppearance('controlled')).toBe('success');
    expect(riskAppearance('partial')).toBe('moved');
    expect(riskAppearance('open')).toBe('removed');
    expect(coverageAppearance(100)).toBe('success');
    expect(coverageAppearance(85)).toBe('moved');
    expect(coverageAppearance(40)).toBe('removed');
  });
  it('builds chart rows and labels', () => {
    expect(gapChart([{ type: 'orphan', count: 2 }, { type: 'notRun', count: 1 }])).toEqual([
      { label: 'Not run', count: 1 },
      { label: 'Orphan', count: 2 },
    ]);
    expect(plural(1, 'gap')).toBe('1 gap');
    expect(plural(3, 'gap')).toBe('3 gaps');
  });
  it('asks Rovo the right question for the issue kind', () => {
    expect(askPrompt('MED-4', 'Verification')).toContain('still valid');
    expect(askPrompt('MED-2', 'Design input')).toBe('What must be re-tested and reviewed if MED-2 changes?');
  });
});
