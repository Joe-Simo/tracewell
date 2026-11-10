import { describe, expect, it } from 'vitest';
import { buildGraph, byKey, downstreamOf, upstreamOf } from '../src/lib/model';
import type { TraceItem } from '../src/lib/model';
import { DEFAULT_CONFIG, kindFor, mergeConfig } from '../src/lib/config';

const it2 = (key: string, kind: TraceItem['kind']): TraceItem => ({ key, kind, summary: key, status: '', done: false, updated: '2026-01-01T00:00:00Z' });

describe('graph', () => {
  it('links both ways and ignores unknown or self links', () => {
    const g = buildGraph([it2('A-1', 'userNeed'), it2('A-2', 'designInput')], [
      { from: 'A-2', to: 'A-1' },
      { from: 'A-2', to: 'A-2' },
      { from: 'A-2', to: 'X-9' },
    ]);
    expect(upstreamOf(g, 'A-2').map((i) => i.key)).toEqual(['A-1']);
    expect(downstreamOf(g, 'A-1').map((i) => i.key)).toEqual(['A-2']);
    expect(upstreamOf(g, 'A-1')).toEqual([]);
  });
  it('sorts keys numerically', () => {
    expect(['A-10', 'A-2', 'B-1', 'A-1'].map((key) => ({ key })).sort(byKey).map((x) => x.key)).toEqual(['A-1', 'A-2', 'A-10', 'B-1']);
  });
});

describe('config', () => {
  it('maps issue types case-insensitively and lets labels win', () => {
    expect(kindFor(DEFAULT_CONFIG, 'Test Case')).toBe('verification');
    expect(kindFor(DEFAULT_CONFIG, 'Story')).toBeUndefined();
    expect(kindFor(DEFAULT_CONFIG, 'Story', ['TW-Hazard'])).toBe('hazard');
  });
  it('merges custom mappings without losing defaults', () => {
    const c = mergeConfig(DEFAULT_CONFIG, { issueTypes: { 'sw requirement': 'designInput' } });
    expect(kindFor(c, 'SW Requirement')).toBe('designInput');
    expect(kindFor(c, 'Hazard')).toBe('hazard');
  });
});
