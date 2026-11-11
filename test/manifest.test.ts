import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import * as index from '../src/index';

// The Forge runtime only exists inside Forge; vitest hoists this stub above the imports.
vi.mock('@forge/api', () => ({ default: { asUser: vi.fn(), asApp: vi.fn() }, assumeTrustedRoute: (p: string) => p }));

const m = parse(readFileSync('manifest.yml', 'utf8'));
const exported = index as unknown as Record<string, unknown>;

describe('manifest', () => {
  const actions: { key: string; function: string; actionVerb?: string }[] = m.modules.action;
  const fns = new Map<string, string>(m.modules.function.map((f: { key: string; handler: string }) => [f.key, f.handler]));
  it('every function points at an exported handler', () => {
    for (const [key, handler] of fns) {
      expect(handler.startsWith('index.'), key).toBe(true);
      expect(typeof exported[handler.split('.')[1]], handler).toMatch(/function|object/);
    }
  });
  it('every action and trigger points at a declared function', () => {
    for (const a of actions) expect(fns.has(a.function), a.key).toBe(true);
    for (const t of m.modules.trigger) expect(fns.has(t.function), t.key).toBe(true);
  });
  it('agent, skill and MCP tools reference real actions', () => {
    const keys = new Set(actions.map((a) => a.key));
    for (const k of m.modules['rovo:agent'][0].actions) expect(keys.has(k), k).toBe(true);
    for (const k of m.modules['rovo:mcp'][0].tools) expect(keys.has(k), k).toBe(true);
    for (const k of m.modules['rovo:skill'][0].dependencies.tools) expect(keys.has(k), k).toBe(true);
  });
  it('MCP exposes only read tools', () => {
    const verbs = new Map(actions.map((a) => [a.key, a.actionVerb]));
    for (const k of m.modules['rovo:mcp'][0].tools) expect(verbs.get(k)).toBe('GET');
  });
  it('skill frontmatter matches the manifest and documents every tool', () => {
    const skill = m.modules['rovo:skill'][0];
    const dir = skill.source.dir;
    const md = readFileSync(`${dir}/SKILL.md`, 'utf8');
    expect(md).toMatch(new RegExp(`^---\\nname: ${dir.split('/').pop()}\\n`));
    const allowed = /allowed-tools: (.*)\n/.exec(md)![1].split(' ');
    expect(allowed.sort()).toEqual([...skill.dependencies.tools].sort());
    for (const t of allowed) expect(md.split('---')[2]).toContain(`\`${t}\``);
  });
  it('the agent prompt mentions every action it can call', () => {
    const prompt = readFileSync('resources/agent/prompt.txt', 'utf8');
    for (const k of m.modules['rovo:agent'][0].actions) expect(prompt, k).toContain(k);
  });
  it('resources exist and names fit the 30 character limit', () => {
    for (const r of m.resources) expect(existsSync(r.path), r.path).toBe(true);
    expect(m.modules['rovo:agent'][0].name.length).toBeLessThanOrEqual(30);
    expect(m.modules['rovo:mcp'][0].name.length).toBeLessThanOrEqual(30);
    for (const f of m.modules.function) expect(f.key.length, f.key).toBeLessThanOrEqual(23);
  });
  it('the suspect trigger ignores the app\'s own edits', () => {
    const t = m.modules.trigger[0];
    expect(t.events).toEqual(['avi:jira:updated:issue']);
    expect(t.filter.ignoreSelf).toBe(true);
  });
  it('makes no egress calls and asks only for the scopes it uses', () => {
    expect(m.permissions.external).toBeUndefined();
    expect([...m.permissions.scopes].sort()).toEqual(
      ['read:jira-work', 'write:jira-work', 'read:page:confluence', 'write:page:confluence', 'read:space:confluence'].sort(),
    );
  });
});
