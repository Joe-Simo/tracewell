import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import * as index from '../src/index';

const m = parse(readFileSync('manifest.yml', 'utf8'));

describe('manifest', () => {
  const actions: { key: string; function: string }[] = m.modules.action;
  const fns = new Map<string, string>(m.modules.function.map((f: { key: string; handler: string }) => [f.key, f.handler]));
  it('every action points at an exported handler', () => {
    for (const a of actions) {
      const handler = fns.get(a.function)!;
      expect(handler, a.key).toBeTruthy();
      expect(typeof (index as Record<string, unknown>)[handler.split('.')[1]], handler).toBe('function');
    }
  });
  it('agent, skill and MCP tools reference real actions', () => {
    const keys = new Set(actions.map((a) => a.key));
    for (const k of m.modules['rovo:agent'][0].actions) expect(keys.has(k), k).toBe(true);
    for (const k of m.modules['rovo:mcp'][0].tools) expect(keys.has(k), k).toBe(true);
    for (const k of m.modules['rovo:skill'][0].dependencies.tools) expect(keys.has(k), k).toBe(true);
  });
  it('MCP exposes only read tools', () => {
    const verbs = new Map(actions.map((a: { key: string; actionVerb?: string }) => [a.key, a.actionVerb]));
    for (const k of m.modules['rovo:mcp'][0].tools) expect(verbs.get(k)).toBe('GET');
  });
  it('skill directory has a SKILL.md whose name matches', () => {
    const dir = m.modules['rovo:skill'][0].source.dir;
    const md = readFileSync(`${dir}/SKILL.md`, 'utf8');
    expect(md).toMatch(new RegExp(`^---\\nname: ${dir.split('/').pop()}\\n`));
  });
  it('resources exist and names fit the 30 character limit', () => {
    for (const r of m.resources) expect(existsSync(r.path), r.path).toBe(true);
    expect(m.modules['rovo:agent'][0].name.length).toBeLessThanOrEqual(30);
    expect(m.modules['rovo:mcp'][0].name.length).toBeLessThanOrEqual(30);
  });
  it('makes no egress calls', () => {
    expect(m.permissions.external).toBeUndefined();
  });
});
