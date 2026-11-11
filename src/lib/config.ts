import { KINDS } from './model';
import type { Kind } from './model';

/**
 * How Jira data maps onto the trace model. Defaults follow a common
 * design-control setup: one Jira issue type per item kind, and the built-in
 * "Relates" link or a custom "Traces" link between them.
 */
export interface TraceConfig {
  /** Jira issue type name (case insensitive) or label to kind. */
  issueTypes: Record<string, Kind>;
  labels: Record<string, Kind>;
  /** Link type names that count as trace links. */
  linkTypes: string[];
  /** Field or label that records a failed test. */
  failLabel: string;
  /** Which kinds each kind must trace down to. */
  required: Partial<Record<Kind, Kind[]>>;
  /** Kinds that must have at least one upstream item (no orphans). */
  needsUpstream: Kind[];
}

export const DEFAULT_CONFIG: TraceConfig = {
  issueTypes: {
    'user need': 'userNeed',
    requirement: 'designInput',
    'design input': 'designInput',
    'design output': 'designOutput',
    specification: 'designOutput',
    'test case': 'verification',
    verification: 'verification',
    validation: 'validation',
    hazard: 'hazard',
    risk: 'hazard',
    'risk control': 'riskControl',
    mitigation: 'riskControl',
  },
  labels: {
    'tw-user-need': 'userNeed',
    'tw-design-input': 'designInput',
    'tw-design-output': 'designOutput',
    'tw-verification': 'verification',
    'tw-validation': 'validation',
    'tw-hazard': 'hazard',
    'tw-risk-control': 'riskControl',
  },
  linkTypes: ['Traces', 'Relates', 'Verifies', 'Mitigates', 'Implements'],
  failLabel: 'tw-failed',
  required: {
    userNeed: ['designInput', 'validation'],
    designInput: ['designOutput', 'verification'],
    hazard: ['riskControl'],
    riskControl: ['verification'],
  },
  needsUpstream: ['designInput', 'designOutput', 'verification', 'validation', 'riskControl'],
};

export function kindFor(
  cfg: TraceConfig,
  issueType: string,
  labels: string[] = [],
): Kind | undefined {
  for (const l of labels) {
    const k = cfg.labels[l.toLowerCase()];
    if (k) return k;
  }
  return cfg.issueTypes[issueType.trim().toLowerCase()];
}

export function mergeConfig(base: TraceConfig, patch: Partial<TraceConfig>): TraceConfig {
  return {
    ...base,
    ...patch,
    issueTypes: { ...base.issueTypes, ...(patch.issueTypes ?? {}) },
    labels: { ...base.labels, ...(patch.labels ?? {}) },
    required: { ...base.required, ...(patch.required ?? {}) },
  };
}

/** Jira project property that holds a team's overrides to DEFAULT_CONFIG. */
export const CONFIG_PROPERTY = 'tracewell-config';

export interface ConfigResult {
  config: TraceConfig;
  errors: string[];
}

const KIND_SET = new Set<string>(KINDS);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function kindMap(v: unknown, field: string, errors: string[]): Record<string, Kind> | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) {
    errors.push(`${field} must be an object of name to kind.`);
    return undefined;
  }
  const out: Record<string, Kind> = {};
  for (const [name, kind] of Object.entries(v)) {
    if (typeof kind === 'string' && KIND_SET.has(kind)) out[name.trim().toLowerCase()] = kind as Kind;
    else errors.push(`${field}.${name}: "${String(kind)}" is not a kind. Use one of ${KINDS.join(', ')}.`);
  }
  return out;
}

function kindList(v: unknown, field: string, errors: string[]): Kind[] | undefined {
  if (!Array.isArray(v)) {
    errors.push(`${field} must be a list of kinds.`);
    return undefined;
  }
  const out: Kind[] = [];
  for (const k of v) {
    if (typeof k === 'string' && KIND_SET.has(k)) out.push(k as Kind);
    else errors.push(`${field}: "${String(k)}" is not a kind.`);
  }
  return out;
}

/**
 * Validate a team's config overrides (from the project property) and merge
 * them onto the defaults. Bad entries are reported and skipped, never thrown,
 * so one typo does not take the whole app down.
 */
export function parseConfig(raw: unknown, base: TraceConfig = DEFAULT_CONFIG): ConfigResult {
  const errors: string[] = [];
  if (raw === undefined || raw === null) return { config: base, errors };
  if (!isObj(raw)) return { config: base, errors: ['Config must be a JSON object.'] };
  const known = new Set(['issueTypes', 'labels', 'linkTypes', 'failLabel', 'required', 'needsUpstream']);
  for (const k of Object.keys(raw)) if (!known.has(k)) errors.push(`Unknown setting "${k}".`);
  const patch: Partial<TraceConfig> = {};
  const issueTypes = kindMap(raw.issueTypes, 'issueTypes', errors);
  if (issueTypes) patch.issueTypes = issueTypes;
  const labels = kindMap(raw.labels, 'labels', errors);
  if (labels) patch.labels = labels;
  if (raw.linkTypes !== undefined) {
    if (Array.isArray(raw.linkTypes) && raw.linkTypes.every((t) => typeof t === 'string' && t.trim()))
      patch.linkTypes = (raw.linkTypes as string[]).map((t) => t.trim());
    else errors.push('linkTypes must be a list of Jira link type names.');
  }
  if (raw.failLabel !== undefined) {
    if (typeof raw.failLabel === 'string' && /^\S+$/.test(raw.failLabel)) patch.failLabel = raw.failLabel.toLowerCase();
    else errors.push('failLabel must be a single Jira label.');
  }
  if (raw.required !== undefined) {
    if (!isObj(raw.required)) errors.push('required must be an object of kind to list of kinds.');
    else {
      const req: Partial<Record<Kind, Kind[]>> = {};
      for (const [k, v] of Object.entries(raw.required)) {
        if (!KIND_SET.has(k)) {
          errors.push(`required.${k}: not a kind.`);
          continue;
        }
        const list = kindList(v, `required.${k}`, errors);
        if (list) req[k as Kind] = list;
      }
      patch.required = req;
    }
  }
  if (raw.needsUpstream !== undefined) {
    const list = kindList(raw.needsUpstream, 'needsUpstream', errors);
    if (list) patch.needsUpstream = list;
  }
  return { config: mergeConfig(base, patch), errors };
}
