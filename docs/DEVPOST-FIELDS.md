# Devpost fields: Tracewell (Codegeist 2026)

Draft: https://devpost.com/submit-to/31572-codegeist-2026-build-with-context-ship-with-confidence/manage/submissions/1298851-tracewell

One section per form field, in form order. Paste the text under each heading. Notes in *italics* are for the person filling the form, not for pasting.

Already filled on the draft: name, tagline, try-it link (repo), video (https://youtu.be/0EGxb5VNPWM).

---

## About the project (Markdown)

## Inspiration

Medical device teams live under design controls (FDA 21 CFR 820, ISO 13485, ISO 14971). They must prove that every user need is met by a requirement, every requirement is verified by a passing test, and every hazard is reduced by a risk control that is itself verified. Most teams keep that proof in a spreadsheet trace matrix that is rebuilt by hand before each release and is out of date the day after.

The most dangerous failure is quiet: a requirement changes after its test passed, and nobody re-runs the test. The old pass still looks green.

## What it does

Tracewell turns the Jira issues and links a team already has into a live design-control trace, and publishes the evidence to Confluence.

- **Issue panel** on every traced issue: what it traces to, what traces to it, its gaps, and what must be re-tested if it changes.
- **Project page** with four tabs: coverage and gaps by type, the full trace matrix (with CSV export), a hazard to risk control to verification table, and a release check for any fix version.
- **Suspect-link automation:** when the content of a requirement changes (summary, description, acceptance criteria, labels), Tracewell comments on every passed test below it and on the requirement with the re-test list. Status moves and comments do not trigger it.
- **Confluence trace report:** verdict, coverage, blockers, trace matrix and risk table, with issue keys linked back to Jira. Publishing again adds a page version, so Confluence page history becomes the audit trail.
- **Rovo agent and skill:** ask "Is 2.1.0 ready to release?" or "What must be re-tested if MED-3 changes?", or use the issue panel's Ask Tracewell button.
- **MCP tools:** the five read-only actions are exposed as tools through the Atlassian MCP server, with an open SKILL.md that third-party agents can load.
- **Per-project settings** map your own issue types, labels and link types, so Tracewell fits an existing project instead of forcing a new one.

Tracewell checks traceability. It does not certify compliance, and the report says so.

## How we built it

| Feature | How we used it | Why it mattered | One concrete result |
| --- | --- | --- | --- |
| Forge UI Kit (Jira issue panel, project page, project settings page) | All screens are UI Kit components fed by Forge resolvers that call Jira REST v3 as the user. | Native Jira look, no hosting, and users only see issues they can already see. | The demo project page shows 69% coverage (9 of 13 required links) and groups the gaps by type. |
| Forge trigger (`avi:jira:updated:issue`, ignoreSelf) | Reads the changelog, keeps only content fields, finds passed tests downstream and posts ADF comments as the app. | Catches the stale-test problem the moment it happens instead of at the next audit. | Editing requirement MED-3 on the demo site put suspect comments on its passed test MED-8 and on MED-3 within seconds. |
| Confluence REST v2 through Forge | Creates the trace report page, then updates the same page on every publish. | Page history gives reviewers a dated record of every release check. | Report page in the QMS space went to version 2 on republish, with the verdict as the version message. |
| Rovo agent, skill and actions | `tracewell-agent` has six actions (five reads plus publish report) and the reusable `design-control-release-check` skill. Actions return short, capped JSON with a clear verdict. | Release reviews start with a question, not a spreadsheet. A grounded verdict keeps the agent from guessing. | The same action code run against the demo site returns NOT READY for 2.1.0 with two blockers: MED-9 failed and MED-10 not run. |
| Atlassian MCP (`rovo:mcp`) | Exposes the five read-only actions as MCP tools. Write actions are not exposed. | Teams can run the release check from their own MCP client, with the user's own Jira permissions. | Five tools declared; a test fails the build if any MCP tool is not a read (GET) action. |
| Trace engine in plain TypeScript | No Forge imports in the rules, so every rule runs in Vitest against an in-memory Jira and Confluence. | Rules for gaps, coverage, risk state and suspect tests can be checked offline and fast. | 92 passing tests, plus 2 opt-in smoke tests against a live site. The manifest is checked with the Forge CLI's own validator. |

## Challenges we ran into

- **Link direction.** Jira links can be drawn either way, so Tracewell derives direction from the design-control chain (need, input, output, verification) instead of trusting the link name.
- **What counts as a change.** Only content edits should make a test suspect, not status moves or comments, so Tracewell reads the changelog field by field.
- **Workflows without a resolution.** Team-managed workflows can reach Done without setting a resolution date, which left passed tests looking unrun. Tracewell now falls back to the status change date.

## Accomplishments that we're proud of

A complete loop from data teams already keep in Jira: model, rules, UI, automation, agent, MCP and a Confluence audit trail, verified on a live site with seeded demo data.

## What we learned

Agent actions work best when they return short, structured verdicts an agent can quote, rather than raw issue data.

## What's next for Tracewell

Teamwork Graph links to code and builds, signed review records, and a Marketplace listing.

---

## Built with

*Tags, one at a time:*

atlassian-forge, forge-ui-kit, jira, confluence, rovo, mcp, typescript, react, node.js, jira-rest-api, confluence-rest-api, vitest

---

## Submitter Type
Individual

## Country
United States

## Canada province
N/A

## Organization
N/A

---

## Start date

11-10-26

*Source: first commit 3c360dd "Initial commit: Tracewell source and pnpm lockfile", 2026-11-10 09:09 AM ET. If the form wants another format: 11/10/2026.*

---

## New or Existing

New

*Verified: the first commit is Nov 10, 2026, after the Submission Period opened (Oct 27, 2026 9:00 AM PT). All 20 commits fall between Nov 10 and Nov 12, 2026.*

---

## Installation link

https://developer.atlassian.com/console/install/537ed219-00cd-47b6-9870-0dcbe1c6c5b2?signature=AYABeID4wKTwPCenDq1qf2IWr8AAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBjwYR6GYevZx4vppX39vAUwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDbuuMCEYRdu2xbDAQIBEIA7BfQiu%2Fg8RLL15ct1EqrAIz6QYaz5yZpM4Y7T%2F1Aom%2FNBWxnQL78GEk3uQ5w23Jkaok6PHJeLA8b%2FsE4AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFnY3ofpOJIzFZEv5LpttsyAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM%2Bg%2FZQy3zbscI67Q9AgEQgDtEDjGhz%2BNlYB773Vix5Xq1IM5FqIG%2BY9GilIDcmNSL75RMDnn1MLiSHz4spLn%2Bbc%2FEffR2lodypaR5IgAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAd0fLZY7AK61XusYS3a%2Ba1IAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwbCd%2BzAwGFnEIV5yYCARCAO5eNaBAun0PAWxyU2SwMEbVvMh0zAFqDz641UwXp5svkZLj1tcWaphidc21akSqy0XFlnbD9rXBtT2%2F0AgAAAAAMAAAQAAAAAAAAAAAAAAAAABK9FyhLu6h4KivRA%2B%2F27XL%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLWxY5k1JZoHLuQhfF0l7MrD5pl99eWvSOPqssOKnfalWswlgfj69haL9uDUivIwERHzKXmIkDKnUcDkgMfe84DYLY%3D&product=confluence&product=jira

---

## App ID

537ed219-00cd-47b6-9870-0dcbe1c6c5b2

---

## How does your app meet the main technology requirement?

Tracewell is an Atlassian Forge app (one manifest, Forge functions on the Node.js 24 runtime) that integrates Jira, Confluence and Rovo.

- **Forge:** hosts everything. UI Kit screens, resolvers, a product trigger, Rovo modules and the MCP module are all Forge modules, and Jira and Confluence are called through Forge's requestJira and requestConfluence, as the user for reads and as the app for trigger comments. No external servers.
- **Jira:** the system of record. Tracewell reads issues, links, fix versions and changelogs (REST v3), adds an issue panel, a project page and a project settings page, stores per-project settings as a project property, and listens to issue updates to post suspect-test comments.
- **Confluence:** the audit trail. Tracewell creates the trace report page in a chosen space and updates the same page on each publish, so each release check is a page version (REST v2).
- **Rovo:** the conversational layer. A Rovo agent, a reusable skill and six actions answer release and change-impact questions and can publish the report. The five read actions are also exposed as MCP tools through rovo:mcp.

---

## Category

Apps for Specialized Industries

**Why:** Tracewell is built for regulated product development, starting with medical devices. Its data model is the design-control chain from FDA 21 CFR 820 and ISO 13485 (user needs, design inputs, design outputs, verification, validation) plus ISO 14971 risk management (hazards, risk controls and their verification). The suspect-test rule and the versioned Confluence report exist because auditors in these industries ask for evidence that a changed requirement was re-verified. Automotive, aerospace and other regulated teams have the same chain, so the same model applies to them.

---

## Testing instructions

1. Install Tracewell with the installation link above on your own Atlassian Cloud site. It asks for both Jira and Confluence. A free Atlassian Cloud developer site works.
2. Load demo data in one of two ways.
   - **Seed script (about 1 minute):** clone https://github.com/Joe-Simo/tracewell. With Node.js 24 (no npm install needed for the seed), create an API token for your own account at https://id.atlassian.com/manage-profile/security/api-tokens, then create a Jira project (team-managed is fine; the seed uses the default Task issue type and the built-in Relates link, no admin setup) with key MED and run:
     `JIRA_SITE=https://your-site.atlassian.net JIRA_EMAIL=you@example.com JIRA_API_TOKEN=your-token node scripts/seed-demo.ts MED`
     It creates fix versions 2.1.0 and 2.2.0 and 15 linked items (user needs, requirements, design outputs, tests, a validation, hazards and a risk control) with test results set. At the end it prints the exact --edit command for the suspect-link demo. The token is read from the environment and never printed.
   - **By hand:** label a few issues with Tracewell labels (`tw-user-need`, `tw-design-input`, `tw-design-output`, `tw-verification`, `tw-validation`, `tw-hazard`, `tw-risk-control`), link them with the built-in Relates link, mark a failed test with `tw-failed`, and move passed tests to Done. The README table lists the issue type names Tracewell also recognises.
3. In the Jira project sidebar, open **Tracewell**. Check the Overview, Trace Matrix, Risks and Release tabs. On the seeded project, release 2.1.0 shows NOT READY with a failed test and an unrun test as blockers.
4. Open any traced issue to see the Tracewell issue panel (traces, gaps, re-test list).
5. Suspect links: edit the description of a requirement that has a passed test below it (on the seeded project, the dose cap requirement), or run `node scripts/seed-demo.ts MED --edit <issue-key>`. Within seconds, Tracewell comments on the passed test and on the requirement.
6. Release tab: publish the trace report to a Confluence space key you own. Publish again and open the page history to see version 2.
7. Project settings > Tracewell: edit the JSON mapping to use your own issue types, labels or link types. Invalid settings are reported and the defaults stay in use.
8. Rovo (if Rovo is enabled on your site): open Rovo chat, choose the Tracewell agent and ask "Is version 2.1.0 ready to release?" or "What must be re-tested if <requirement key> changes?". Note: we could not open Rovo chat on our own developer site, so we have tested the action code directly and through the Forge entry points, but not inside Rovo chat.
9. Offline: `pnpm install && pnpm test` runs 92 tests against an in-memory Jira and Confluence.

We do not share credentials for our demo site. Everything above runs on your own site.

---

## Tell us about your experience building with Forge

**What worked well**
- UI Kit gave us native-looking Jira screens (tabs, dynamic tables, charts, progress bars) with no hosting or CSS.
- requestJira and requestConfluence with asUser and asApp made the permission model easy to get right: reads run as the user, and only trigger comments run as the app.
- The product trigger with ignoreSelf let suspect-link automation react to edits without reacting to its own comments.
- The Forge CLI's manifest validator runs offline, so we wired it into our checks and caught manifest mistakes before deploying.
- forge logs made the live trigger easy to check.
- Turning existing actions into MCP tools was a manifest change, not new code.

**What we struggled with**
- Rovo chat access on our developer site: Rovo Home showed restricted content and we could not open Rovo chat, so we could not test the agent conversationally and the demo video shows the agent through its manifest, code and live action output instead.
- We could not find a headless way to call the deployed MCP tools. The Forge MCP endpoint needs an OAuth sign-in, so our MCP checks are offline tests plus live runs of the same action code.
- On a headless Linux box the CLI's keychain (keytar) failed. Setting FORGE_EMAIL and FORGE_API_TOKEN as environment variables worked.
- The first forge deploy failed with "Server error: undefined". Running it again with --verbose showed it completing.
- forge install for Confluence returned an "already installed" error, yet forge install list showed both the Jira and Confluence installs were fine.
- Limits we found from the validator rather than up front: function keys must be 23 characters or fewer, and jira:issuePanel needs an icon.
- Team-managed Jira workflows can reach Done without a resolution date, which we had to handle.

**What we would improve**
- A CLI command to invoke a Rovo action or MCP tool on an installed app, so agents can be tested without the chat UI.
- Clear Rovo availability on free developer sites, or a message that says why Rovo is restricted.
- Clearer deploy errors, and a documented headless login in the CLI's own error message.
- Show module limits (key length, required properties) in the manifest reference next to each module.

---

## AI tools used

- **Grok Bot (AI assistant)** wrote most of the code, tests, scripts and documentation under the entrant's direction, and ran the Forge CLI, the demo data seeding and the live checks.
- **Piper TTS** (open-source text to speech, en_US LJSpeech voice) generated the video narration. The video labels it as a synthetic voice.
- The video was assembled with ffmpeg from real screenshots of the app and rendered terminal cards, using scripts written by Grok Bot. The video closes with an AI-assisted development disclosure.
- No AI-generated images, video footage or music were used.

---

## Skills scale

*Pick the middle option (Intermediate, or 3 if the scale is 1 to 5).* The entrant's account already had Forge set up for other apps, but this is the first app using Rovo and MCP modules.

## Likely to build on Forge again

*Pick the second-highest option (Likely, or 4 if the scale is 1 to 5).* The platform worked well; the Rovo access issue is the main reason not to pick the top value.

---

## Bonus prize (single choice)

**Recommendation: Best Agents.**

Write-up to paste if the form asks for one:

The tracewell-agent Rovo agent has six actions and a reusable design-control-release-check skill. Its prompt is grounded: it only states facts returned by the actions and never certifies compliance. The actions return compact, capped JSON with a clear verdict so any agent can use them as tools, and they read the current issue or project from the Rovo context when no key is given. The agent can also act: it publishes or updates the Confluence trace report on request. The issue panel's Ask Tracewell button opens the agent with a prompt about the current issue.

*Reasoning (not for pasting):*
- *Neither bonus can be shown end to end in Rovo chat from our side, so the choice rests on which one judges can verify most easily and which one has the stronger story.*
- *MCP check: the Forge MCP endpoint https://mcp.atlassian.com/forge/537ed219-00cd-47b6-9870-0dcbe1c6c5b2 answers 401 and asks for an OAuth 2.1 Bearer token. API token (Basic) auth was refused. A made-up app id gets the same 401, so the endpoint response does not prove our tools are registered. Per Atlassian's docs, external MCP access also has to be enabled per tool by a site admin, and the connection needs a browser OAuth consent. So there is no Rovo-independent live proof of the MCP module today. What we can prove without Rovo applies to both bonuses equally: the action handlers run live against the demo site, the Forge entry points are tested through the real client wrapper, forge lint accepts rovo:mcp, and a test checks every MCP tool is a declared read action.*
- *For judges, the agent is likely the shorter path: on a site with Rovo, the agent ships with the app (we could not confirm the chat side on our site). External MCP use needs an admin to enable the tools plus an MCP client with OAuth sign-in.*
- *Best Agents also covers more of the app (six actions including a write action, a skill, and the Ask Tracewell button). In 2025, 2 of 3 first-place winners also won Best Rovo Apps (see plans/codegeist.md self-study).*
- *What would flip this: if someone completes the OAuth sign-in in a browser (for example with an MCP client pointed at the URL above, after enabling Tracewell's tools in Atlassian Administration) and gets a tools/list and one tool call on screen, the MCP bonus becomes provable and is likely less crowded.*

---

## Eligibility checkboxes

*Three boxes on the form. Joe or the Team Lead should read and tick them; nothing in this file substitutes for reading them.*
