// Seed the Tracewell demo project on a Jira Cloud site.
//
//   JIRA_SITE=https://your-site.atlassian.net JIRA_EMAIL=you@example.com JIRA_API_TOKEN=... \
//     node scripts/seed-demo.ts MED            # create the demo items in project MED
//   ... node scripts/seed-demo.ts MED --edit MED-3   # change a requirement to show suspect tests
//
// The token is read from the environment and never printed.
import { demoEdit, seed } from './seed/plan.ts';
import type { Request } from './seed/plan.ts';

const [projectKey, flag, editKey] = process.argv.slice(2);
const site = process.env.JIRA_SITE?.replace(/\/$/, '');
const email = process.env.JIRA_EMAIL;
const token = process.env.JIRA_API_TOKEN;
if (!projectKey || !site || !email || !token) {
  console.error('Usage: JIRA_SITE=... JIRA_EMAIL=... JIRA_API_TOKEN=... node scripts/seed-demo.ts PROJECTKEY [--edit ISSUEKEY]');
  process.exit(2);
}
const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
const request: Request = async (method, path, body) => {
  const res = await fetch(site + path, {
    method,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

async function main() {
  if (flag === '--edit') {
    if (!editKey) throw new Error('Give the issue key to edit');
    await demoEdit(request, editKey);
    console.log(`Edited ${editKey}. Its passed tests are now suspect.`);
  } else {
    const keys = await seed(request, projectKey, console.log);
    console.log(`Seeded ${Object.keys(keys).length} items. For the suspect demo run: node scripts/seed-demo.ts ${projectKey} --edit ${keys.DI1}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
