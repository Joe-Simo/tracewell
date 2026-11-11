import type { TraceConfig } from './config';
import { DEFAULT_CONFIG } from './config';
import { isIssueKey } from './jira';
import type { AtlassianClient } from './service';
import { loadContext, projectOf } from './service';
import { changedContentFields, suspectNotice } from './suspect';
import type { Adf } from './suspect';

/** The parts of an avi:jira:updated:issue event Tracewell reads. */
export interface IssueUpdatedEvent {
  issue?: { key?: string };
  changelog?: { items?: { field?: string }[] };
}

export interface TriggerResult {
  key?: string;
  skipped?: string;
  commented: string[];
  failed: string[];
}

async function comment(client: AtlassianClient, key: string, body: Adf): Promise<boolean> {
  const res = await client.jira(`/rest/api/3/issue/${key}/comment`, { method: 'POST', body: { body } });
  return res.status === 201 || res.status === 200;
}

/**
 * Suspect-link automation: when the content of a traced requirement, hazard or
 * design item changes, comment on every passed test below it and on the item
 * itself, so nobody ships on a stale pass.
 */
export async function onIssueUpdated(
  client: AtlassianClient,
  event: IssueUpdatedEvent,
  base: TraceConfig = DEFAULT_CONFIG,
): Promise<TriggerResult> {
  const key = String(event.issue?.key ?? '');
  const out: TriggerResult = { key, commented: [], failed: [] };
  if (!isIssueKey(key)) return { ...out, skipped: 'no issue key' };
  const fields = changedContentFields(event.changelog?.items);
  if (!fields.length) return { ...out, skipped: 'no content change' };
  const { graph } = await loadContext(client, projectOf(key), base);
  const notice = suspectNotice(graph, key, fields);
  if (!notice) return { ...out, skipped: 'no downstream tests' };
  for (const test of notice.suspect) {
    (await comment(client, test.key, notice.testComment(test)) ? out.commented : out.failed).push(test.key);
  }
  (await comment(client, key, notice.sourceComment) ? out.commented : out.failed).push(key);
  return out;
}
