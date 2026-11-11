import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, kindFor, parseConfig } from '../src/lib/config';
import { loadConfig, saveConfig } from '../src/lib/service';
import { fakeClient } from './fake-client';

describe('parseConfig', () => {
  it('returns defaults for no config', () => {
    expect(parseConfig(undefined)).toEqual({ config: DEFAULT_CONFIG, errors: [] });
    expect(parseConfig(null).config).toBe(DEFAULT_CONFIG);
  });
  it('merges valid overrides onto the defaults', () => {
    const { config, errors } = parseConfig({
      issueTypes: { 'Software Requirement': 'designInput' },
      linkTypes: ['Tests'],
      failLabel: 'QA-Failed',
      required: { designInput: ['verification'] },
      needsUpstream: ['verification'],
    });
    expect(errors).toEqual([]);
    expect(kindFor(config, 'software requirement')).toBe('designInput');
    expect(kindFor(config, 'Hazard')).toBe('hazard');
    expect(config.linkTypes).toEqual(['Tests']);
    expect(config.failLabel).toBe('qa-failed');
    expect(config.required.designInput).toEqual(['verification']);
    expect(config.required.userNeed).toEqual(DEFAULT_CONFIG.required.userNeed);
    expect(config.needsUpstream).toEqual(['verification']);
  });
  it('reports every bad entry and skips it', () => {
    const { config, errors } = parseConfig({
      issueTypes: { Bug: 'defect' },
      linkTypes: 'Relates',
      failLabel: 'two words',
      required: { epic: ['verification'], hazard: ['nope'] },
      extra: true,
    });
    expect(errors).toHaveLength(6);
    expect(errors[0]).toBe('Unknown setting "extra".');
    expect(kindFor(config, 'Bug')).toBeUndefined();
    expect(config.linkTypes).toEqual(DEFAULT_CONFIG.linkTypes);
  });
  it('rejects non-objects', () => {
    expect(parseConfig([1, 2]).errors).toEqual(['Config must be a JSON object.']);
  });
});

describe('project property storage', () => {
  it('saves only valid config', async () => {
    const c = fakeClient();
    expect(await saveConfig(c, 'MED', { issueTypes: { Story: 'nope' } })).toMatchObject({ saved: false });
    expect(c.calls.filter((x) => x.method === 'PUT')).toHaveLength(0);
    expect(await saveConfig(c, 'MED', { linkTypes: ['Tests'] })).toEqual({ saved: true, errors: [] });
    const loaded = await loadConfig(c, 'MED');
    expect(loaded.config.linkTypes).toEqual(['Tests']);
    expect(loaded.raw).toEqual({ linkTypes: ['Tests'] });
  });
  it('falls back to defaults when the property cannot be read', async () => {
    const c = fakeClient({ route: (call) => (call.path.includes('/properties/') ? { status: 500, body: {} } : undefined) });
    const r = await loadConfig(c, 'MED');
    expect(r.config).toBe(DEFAULT_CONFIG);
    expect(r.errors[0]).toMatch(/HTTP 500/);
  });
  it('validates the project key before building the path', async () => {
    await expect(loadConfig(fakeClient(), 'med/../x')).rejects.toThrow('Invalid project key');
  });
});
