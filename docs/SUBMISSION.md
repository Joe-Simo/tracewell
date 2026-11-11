# Devpost submission draft: Tracewell

Fill-ins still needed: INSTALL_LINK, YOUTUBE_URL, REPO_URL (optional).

## Category
Apps for Specialized Industries

## Bonus prizes
- Best Agents (rovo:agent + reusable rovo:skill + rovo actions)
- Best app with Atlassian MCP (rovo:mcp + open SKILL.md)

Rules: one grand prize and one bonus prize per submission. Select both bonuses if the form allows; the sponsor may reassign.

## Tagline
Design-control traceability that lives in Jira, catches stale test results the moment a requirement changes, and publishes the audit trail to Confluence.

## Inspiration
Medical device, automotive and other regulated teams have to prove that every user need is met, every requirement is verified and every hazard is controlled. That proof usually lives in a spreadsheet trace matrix that is rebuilt by hand before each release and is wrong the day after. The most dangerous failure is quiet: a requirement changes after its test passed, and nobody re-runs the test.

## What it does
Tracewell turns ordinary Jira issues and links into a live design-control trace:
- Issue panel on every traced issue: what it traces to, what traces to it, its gaps, and what must be re-tested if it changes.
- Project page: coverage, gaps by type, the full trace matrix (with CSV export), a hazard to risk control to verification table, and a release check for any fix version.
- Suspect-link automation: when a requirement's content changes, Tracewell comments on every passed test below it and on the requirement with the re-test list.
- Confluence trace report: verdict, coverage, blockers, trace matrix and risk table, with issue keys linked to Jira. Re-publishing adds a page version, so page history is the audit trail.
- Rovo agent and skill: ask "Is 2.1.0 ready to release?" or "What must be re-tested if MED-3 changes?" in Rovo chat, or from the issue panel's Ask Tracewell button.
- MCP server: the five read-only actions are exposed as tools through the Atlassian MCP server, with an open SKILL.md that third-party agents can load.
- Per-project settings map your own issue types, labels and link types.

## How we built it
Forge (Node.js 24 runtime), UI Kit for all screens, Forge resolvers, a Jira product trigger, Rovo agent, skill, action and MCP modules, and Jira REST v3 plus Confluence REST v2 called through `requestJira` and `requestConfluence`. The trace engine is pure TypeScript with no Forge imports, so every rule is covered by Vitest tests against an in-memory Jira and Confluence (TEST_COUNT tests). The manifest is checked with the Forge CLI's own validator.

## How it meets the main technology requirement
It is a Forge app (manifest plus Forge modules) that integrates Jira (issue panel, project page, project settings page, trigger, REST), Confluence (page create and versioned update) and Rovo (agent, skill, actions, MCP).

## Best Agents write-up
The `tracewell-agent` Rovo agent has six actions and a reusable `design-control-release-check` skill. Its prompt is grounded: it only states facts returned by the actions and never certifies compliance. The actions return compact, capped JSON with a clear verdict so any agent can use them as tools, and they read the current issue or project from the Rovo context when no key is given. The agent can also act: it publishes or updates the Confluence trace report on request.

## Best app with Atlassian MCP write-up
The `rovo:mcp` module exposes `get-trace-gaps`, `get-trace-chain`, `analyze-change-impact`, `get-release-readiness` and `get-risk-controls` through the Atlassian MCP server. Only read tools are exposed. `skills/design-control-release-check/SKILL.md` is an open skill file that a team can add to a third-party agent so it runs the same release check through MCP.

## Challenges
Link direction: Jira links can be drawn either way, so Tracewell derives direction from the design-control chain. Suspect detection: only content edits (summary, description, acceptance criteria, labels) should invalidate a test, not status moves or comments, so Tracewell reads the changelog.

## Accomplishments
A complete product loop: model, rules, UI, automation, agent, MCP and a Confluence audit trail, all from data teams already keep in Jira.

## What we learned
Rovo actions work best when they return short, structured verdicts that an agent can quote rather than raw data.

## What's next
Teamwork Graph links to code and builds, signed review records, and a Marketplace listing.

## Testing instructions
See README "Install (judges)". Install from INSTALL_LINK, then either label a few issues or run the seed script, open the Tracewell project page, and ask the Tracewell agent in Rovo "Is version 2.1.0 ready to release?".

## Built with
atlassian-forge, jira, confluence, rovo, mcp, typescript, react, ui-kit, vitest

## AI disclosure
Built with AI coding assistance. All features are tested and work as shown in the video.
