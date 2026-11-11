# Tracewell

Design-control traceability for Jira and Confluence, built on Atlassian Forge with a Rovo agent and an MCP server.

Teams that build regulated products (medical device software, automotive, aerospace) must prove that every user need is met by requirements, every requirement is implemented and verified, and every hazard is controlled and the control verified. Most teams keep that proof in spreadsheets that go stale the moment a requirement changes. Tracewell reads the trace straight from Jira, finds the gaps, flags tests that passed before their requirement changed, and publishes the trace report to Confluence.

## What it does

- **Trace model.** User needs, design inputs, design outputs, verification, validation, hazards and risk controls, mapped from Jira issue types or `tw-` labels. Trace links are ordinary Jira issue links; direction comes from the design-control chain, so it does not matter which way a link was drawn.
- **Gap rules.** Missing downstream trace, orphans, failed tests, tests not run, and suspect results (a test that passed before anything upstream of it changed). Only content edits count; status moves and comments do not.
- **Suspect-link automation.** A Jira trigger watches traced items. When the summary, description, acceptance criteria or labels of a requirement change, Tracewell comments on every passed test below it ("suspect result, re-run before release") and on the requirement itself with the full re-test list.
- **Change impact.** For any item: tests to re-run, items to review, hazards involved and the user needs at stake.
- **Release readiness.** For a fix version: the items in the release plus their full chains, coverage, blockers and warnings, with a READY / NOT READY verdict.
- **Risk controls.** Hazard to risk control to verification table, with each hazard marked controlled, partial or open.
- **Confluence trace report.** One click (or one Rovo request) publishes the release report with the verdict, coverage, blockers, trace matrix and risk table, with issue keys linked back to Jira. Publishing again for the same release adds a page version, so Confluence page history becomes the audit trail.
- **Per-project settings.** A Jira project settings page maps your own issue types, labels and link types, and sets which trace links are required. Settings are validated and stored as a Jira project property.

## Forge modules

| Module | Use |
| --- | --- |
| `jira:issuePanel` | Trace chain, gaps, suspect warning and change impact on every traced issue, plus an "Ask Tracewell" button that opens the Rovo agent |
| `jira:projectPage` | Tabs for overview (coverage, gap chart), trace matrix with CSV, risk table and release check with Confluence publish |
| `jira:projectSettingsPage` | Project configuration |
| `trigger` (`avi:jira:updated:issue`) | Suspect-link automation |
| `rovo:agent` | The Tracewell agent with conversation starters |
| `rovo:skill` | `design-control-release-check`, a reusable skill (SKILL.md) other agents can use |
| `action` x6 | `get-trace-gaps`, `get-trace-chain`, `analyze-change-impact`, `get-release-readiness`, `get-risk-controls`, `publish-trace-report` |
| `rovo:mcp` | Exposes the five read-only actions as tools on the Atlassian MCP server |

Scopes: `read:jira-work`, `write:jira-work` (comments and the settings property), `read:space:confluence`, `read:page:confluence`, `write:page:confluence`. No egress: Tracewell calls only Atlassian APIs.

## Links

- Source: https://github.com/Joe-Simo/tracewell
- Installation link: https://developer.atlassian.com/console/install/537ed219-00cd-47b6-9870-0dcbe1c6c5b2?signature=AYABeID4wKTwPCenDq1qf2IWr8AAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBjwYR6GYevZx4vppX39vAUwAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDDbuuMCEYRdu2xbDAQIBEIA7BfQiu%2Fg8RLL15ct1EqrAIz6QYaz5yZpM4Y7T%2F1Aom%2FNBWxnQL78GEk3uQ5w23Jkaok6PHJeLA8b%2FsE4AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFnY3ofpOJIzFZEv5LpttsyAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM%2Bg%2FZQy3zbscI67Q9AgEQgDtEDjGhz%2BNlYB773Vix5Xq1IM5FqIG%2BY9GilIDcmNSL75RMDnn1MLiSHz4spLn%2Bbc%2FEffR2lodypaR5IgAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAd0fLZY7AK61XusYS3a%2Ba1IAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwbCd%2BzAwGFnEIV5yYCARCAO5eNaBAun0PAWxyU2SwMEbVvMh0zAFqDz641UwXp5svkZLj1tcWaphidc21akSqy0XFlnbD9rXBtT2%2F0AgAAAAAMAAAQAAAAAAAAAAAAAAAAABK9FyhLu6h4KivRA%2B%2F27XL%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADLWxY5k1JZoHLuQhfF0l7MrD5pl99eWvSOPqssOKnfalWswlgfj69haL9uDUivIwERHzKXmIkDKnUcDkgMfe84DYLY%3D&product=confluence&product=jira (Forge distribution link, being generated in the developer console)

## Install (judges)

1. Open the installation link and install Tracewell on your Jira and Confluence site (it asks for both).
2. In any Jira project, create a few issues with Tracewell labels, or use issue types with these names:

   | Kind | Issue type names | Label |
   | --- | --- | --- |
   | User need | User Need | `tw-user-need` |
   | Design input | Requirement, Design Input | `tw-design-input` |
   | Design output | Design Output, Specification | `tw-design-output` |
   | Verification | Test Case, Verification | `tw-verification` |
   | Validation | Validation | `tw-validation` |
   | Hazard | Hazard, Risk | `tw-hazard` |
   | Risk control | Risk Control, Mitigation | `tw-risk-control` |

   Link them with the built-in **Relates** link (or Traces, Verifies, Mitigates, Implements). Mark a test as failed with the `tw-failed` label; a test passes when it is moved to a done status. Set fix versions to group items into a release.
3. Or seed the full demo project in one command (needs a Jira API token for your own site; the token is read from the environment and never printed):

   ```
   JIRA_SITE=https://your-site.atlassian.net JIRA_EMAIL=you@example.com JIRA_API_TOKEN=... node scripts/seed-demo.ts MED
   ```

4. Open the project sidebar item **Tracewell**, or any traced issue, or ask the Tracewell agent in Rovo: "Is version 2.1.0 ready to release?"
5. To see suspect-link automation, edit the description of a requirement that has a passed test below it (or run `node scripts/seed-demo.ts MED --edit <key>`), then open the test.

## Develop

```
pnpm install
pnpm test               # 92 vitest tests, fully offline against an in-memory Jira and Confluence
                        # plus an opt-in live smoke test: see test/live.test.ts
pnpm typecheck
pnpm validate:manifest  # the Forge CLI's own manifest validator, offline
forge deploy && forge install
```

All trace logic is in `src/lib` as pure TypeScript with no Forge imports. `src/index.ts` is the only file that touches the Forge runtime.

## Limits

Tracewell checks traceability. It does not certify compliance with ISO 13485, IEC 62304, ISO 14971 or FDA 21 CFR 820, and it does not replace a quality reviewer. One project load reads up to 1,000 traced issues.

Built with AI coding assistance; every rule is covered by tests.
