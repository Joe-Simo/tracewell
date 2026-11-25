# Devpost "About the project" v2 (paste into the About field)

*Notes for whoever edits the Devpost page (not for pasting): replaces the Inspiration / What it does / How we built it body in docs/DEVPOST-FIELDS.md. Keep the Built with, Try it out and video fields as they are. Every claim below is backed by code, a test or the live demo site; the JUDGE-AUDIT.md file lists the evidence. Screenshots to add to the gallery are in docs/screenshots (six PNGs). Edit deadline: Dec 22, 2026 12:00 PM PT (3:00 PM ET).*

---

## Who it is for, and what is new

**Tracewell is for medical device software teams that already work in Jira and have to prove design controls to an auditor.** The new part is not another compliance workflow. It is **suspect-link propagation**: when a requirement changes after its test passed, Tracewell flags that test as suspect right away, instead of leaving a green pass that no longer proves the current design.

Around that sit a live trace matrix built from the Jira issues and links you already have, a READY / NOT READY release verdict with named blockers, a versioned trace report in Confluence, and a Rovo agent plus Atlassian MCP tools that answer the same questions in chat.

Tracewell checks traceability. It does not certify compliance, and the report says so.

## The problem, in one scene

A bolus calculator caps its suggested dose at 25 units. The test for that cap passed last week. After a hazard review the team lowers the cap to 20 units and edits the requirement. Nobody re-runs the test, and the release trace matrix, a spreadsheet, still shows a green pass. That quiet gap is what auditors look for.

## The same change, three ways

| | Spreadsheet trace matrix | Jira compliance-configuration app (audits workflows, statuses, transitions and required fields) | Tracewell |
| --- | --- | --- | --- |
| Requirement edited from 25 U to 20 U | Someone must remember to open the row and clear the test | The workflow can be configured so that edits are controlled, but the test stays Done and nothing links the edit to the test | A Forge trigger reads the changelog and comments on the passed test and on the requirement the moment the description changes |
| Is the old pass still shown as passing? | Yes, until someone edits the cell | Yes: that is not what this kind of app checks | No: the test is listed as a suspect result and a release blocker until it is completed again |
| "Is 2.1.0 ready?" | A manual review of every row | Not its job: it audits configuration | NOT READY: MED-9 failed, MED-10 not run, plus any suspect tests |
| Evidence for the auditor | The file | A configuration report, not a trace report | A Confluence page with the verdict, matrix and risk table, and one page version per release check |

We did not install or test any competing app. The middle column describes what the 2025 Specialized Industries third place, Compliant Workflows for Jira, says it does on its public Devpost page: audit and fix how Jira is configured, and report on it. That is a different job from tracing the work items, so the two are complementary, and a given app may do more than its page says.

## Try it the way a customer would

Everything below ran on a real Jira and Confluence developer site, installed from the Forge installation link, with demo data created through the public Jira REST API by a seed script (the way a customer admin would load data, with no backdoor into the app).

**Three minutes, no API token:** create two Tasks with labels `tw-design-input` and `tw-verification`, link them with Relates, move the test to Done, open the Tracewell project page, edit the requirement's description, then open the test and see the "suspect result" comment. The README "Judge path" has the exact steps, and a test (`test/quickpath.test.ts`) builds those same two Tasks and checks the gap and the comments.

**Full demo:** one seed command creates 15 linked items and two fix versions for a bolus calculator project. On our site that gave:

- Overview: 69% trace coverage (9 of 13 required links), 7 blockers.
- Release 2.1.0: NOT READY, with MED-9 failed and MED-10 not run.
- Editing the requirement MED-3 put suspect comments on its passed test MED-8 and on MED-3 within seconds.
- Risk table: hazard MED-12 partial (its control's verification is not passing), MED-13 open.
- Publishing the report created a Confluence page in the QMS space, and publishing again moved it to version 2 with the verdict as the version message.

## What it does

- **Issue panel** on every traced issue: what it traces to, what traces to it, its gaps, and what must be re-tested if it changes.
- **Project page** with four tabs: coverage and gaps by type, the trace matrix with CSV export, a hazard to risk control to verification table, and a release check for any fix version.
- **Suspect-link automation:** a content change (summary, description, Acceptance Criteria, labels) comments on every passed test below the item and on the item itself with the re-test list. Status moves and comments are ignored.
- **Confluence trace report** with issue keys linked back to Jira.
- **Rovo agent and skill:** ask "Is 2.1.0 ready to release?" or "What must be re-tested if MED-3 changes?".
- **MCP tools:** the five read-only actions are exposed through `rovo:mcp`, with an open SKILL.md for third-party agents. The publish action is not exposed.
- **Per-project settings** map your own issue types, labels and link types, so Tracewell fits an existing project.

## How it is built

Forge on Node.js 24, UI Kit for every screen, one resolver, a Jira product trigger, Rovo agent, skill, action and MCP modules, Jira REST v3 and Confluence REST v2 through `requestJira` and `requestConfluence`. No external servers and no egress. The trace engine is pure TypeScript with no Forge imports, so every rule runs in Vitest against an in-memory Jira and Confluence: 96 tests pass, plus 2 opt-in tests against a live site. The manifest is checked with the Forge CLI's own validator.

| Module | What it does | Result |
| --- | --- | --- |
| `jira:issuePanel`, `jira:projectPage`, `jira:projectSettingsPage` | Trace chain, gaps and impact on each issue; four-tab project page; JSON settings | Demo project: 69% coverage, gaps grouped by type |
| `trigger` (`avi:jira:updated:issue`, ignoreSelf) | Suspect-link propagation from the changelog | MED-8 and MED-3 commented after editing MED-3 |
| Confluence REST v2 | Create the report page, then update it on each publish | Version 2 on republish |
| `rovo:agent`, `rovo:skill`, 6 `action` modules | Grounded agent that only states what its actions return; reusable release-check skill | Actions run through the real Forge entry points in tests and against the demo site |
| `rovo:mcp` | Five read-only tools on the Atlassian MCP server | A test fails the build if any MCP tool is not a GET action |

## Best Agents and Best app with Atlassian MCP

The agent has six actions, including one that writes (publish the Confluence report), and the `design-control-release-check` skill that other agents can load. Its prompt only states facts returned by the actions and never says a product is compliant. The actions return short, capped JSON with a clear verdict so any agent can quote them. The MCP module exposes only the read tools, so an outside client cannot publish pages.

## What we could not verify, and what is not built

We believe in saying this plainly:

- **We have not seen the agent answer inside Rovo chat or called a tool from an MCP client.** Rovo chat was not available on our developer site, and the Forge MCP endpoint needs an OAuth sign-in we could not complete headless. The actions are tested through the Forge entry points and the same code ran against the demo site, but the chat and MCP clients are unverified.
- Pass and fail come from Jira status and a `tw-failed` label. Importing results from a test management or CI tool is not built.
- Tracewell reads one project at a time (links to other projects are ignored) and up to 1,000 traced issues. Past that it says so on the project page, and the results are incomplete.
- Repeated edits post repeated comments. The suspect state in the Tracewell views clears when the test is completed again.
- No electronic signatures or approvals. Tracewell does not replace a quality reviewer.

## What we learned

Agent actions work best when they return a short, structured verdict an agent can quote instead of raw issue data. And the most useful rule in traceability is small: a test is only evidence for the version of the requirement it ran against.

## What's next

Test results from CI and test management tools, links to code and builds through Teamwork Graph, signed review records, and a Marketplace listing.

## AI disclosure

Built with AI coding assistance. Grok Bot wrote most of the code, tests, scripts and documentation under the entrant's direction and ran the Forge CLI, the demo data seeding and the live checks. The demo video narration is a synthetic voice (Piper TTS) and the video says so. No AI-generated images, footage or music were used.
