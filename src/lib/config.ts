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
