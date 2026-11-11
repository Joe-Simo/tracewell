import { CONTENT_FIELDS } from './jira';
import { KIND_LABEL } from './model';
import type { TraceGraph, TraceItem } from './model';
import { descendants } from './rules';

/** Atlassian Document Format, only the parts Tracewell writes. */
type AdfText = { type: 'text'; text: string; marks?: { type: 'strong' }[] };
type AdfParagraph = { type: 'paragraph'; content: AdfText[] };
type AdfList = { type: 'bulletList'; content: { type: 'listItem'; content: AdfParagraph[] }[] };
export type Adf = { type: 'doc'; version: 1; content: (AdfParagraph | AdfList)[] };

const p = (...content: AdfText[]): AdfParagraph => ({ type: 'paragraph', content });
const t = (text: string): AdfText => ({ type: 'text', text });
const b = (text: string): AdfText => ({ type: 'text', text, marks: [{ type: 'strong' }] });
const list = (lines: string[]): AdfList => ({
  type: 'bulletList',
  content: lines.map((l) => ({ type: 'listItem', content: [p(t(l))] })),
});

/** Field names that changed in a Jira changelog and count as content. */
export function changedContentFields(items: { field?: string }[] | undefined, fields: string[] = CONTENT_FIELDS): string[] {
  const out = new Set<string>();
  for (const i of items ?? []) if (i.field && fields.includes(i.field)) out.add(i.field);
  return [...out];
}

export interface SuspectNotice {
  key: string;
  /** Downstream tests that had passed and are now suspect. */
  suspect: TraceItem[];
  /** Downstream tests that were not passing anyway and still need a run. */
  pending: TraceItem[];
  /** Comment for the changed item. */
  sourceComment: Adf;
  /** Comment for each suspect test. */
  testComment: (test: TraceItem) => Adf;
}

/**
 * When a traced item's content changes, every passed test below it no longer
 * proves the current design. Build the comments that say so. Returns undefined
 * when nothing downstream is a test.
 */
export function suspectNotice(g: TraceGraph, key: string, fields: string[]): SuspectNotice | undefined {
  const item = g.items.get(key);
  if (!item || fields.length === 0) return undefined;
  const tests = descendants(g, key).filter((d) => d.kind === 'verification' || d.kind === 'validation');
  if (tests.length === 0) return undefined;
  const suspect = tests.filter((x) => x.result === 'pass');
  const pending = tests.filter((x) => x.result !== 'pass');
  const what = fields.join(', ');
  const label = (x: TraceItem) => `${x.key} (${KIND_LABEL[x.kind]}): ${x.summary}`;
  const content: (AdfParagraph | AdfList)[] = [
    p(b('Tracewell: '), t(`the ${what} of ${KIND_LABEL[item.kind].toLowerCase()} ${key} changed.`)),
  ];
  if (suspect.length) content.push(p(t(`${suspect.length} passed test${suspect.length === 1 ? ' is' : 's are'} now suspect and must be re-run before release:`)), list(suspect.map(label)));
  if (pending.length) content.push(p(t('Still open or failing:')), list(pending.map(label)));
  return {
    key,
    suspect,
    pending,
    sourceComment: { type: 'doc', version: 1, content },
    testComment: (test) => ({
      type: 'doc',
      version: 1,
      content: [
        p(
          b('Tracewell: suspect result. '),
          t(`${test.key} passed before the ${what} of ${key} (${item.summary}) changed. Re-run it and record the new result before release.`),
        ),
      ],
    }),
  };
}
