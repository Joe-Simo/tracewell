# Judge audit: Tracewell (Codegeist 2026)

Audit date: Nov 25, 2026 (America/New_York). Repo HEAD before the audit: 962c6ff. Scores are my honest estimates on a 1 to 5 scale, not predictions of the judges. Half points are used where the evidence sits between two scores.

Sources read: the official rules (Stage 2 criteria, equally weighted), the public submission page https://devpost.com/software/tracewell-pnwoyc (fetched as text, so gallery images and the embedded video were not visible to me), the 2025 winners post, and the public Devpost pages of FleetOps, YardMaster and Compliant Workflows for Jira. Rovo and MCP behaviour was checked only in code, tests and the manifest; nothing was run in a browser.

## Scores by official criterion

Criteria text is quoted from the rules.

| Criterion | Before | After repo changes | After About v2 and gallery are pasted |
| --- | --- | --- | --- |
| Technological Implementation: genuine, working, non-trivial, not a shallow wrapper or a single hardcoded demo path | 4 | 4 | 4 |
| Design: complete, coherent product, not a proof of concept | 3 | 3.5 | 3.5 |
| Potential Impact: credible, specific case for a real problem and audience, and the solution addresses it based on what is demonstrated | 3.5 | 3.5 | 4 |
| Innovation/Idea: how novel, and does it differ from existing concepts | 3 | 3 | 3.5 |
| Presentation: video shows it working end to end, problem, audience, why, easy to follow | 3 | 3 | 3.5 |
| **Total (of 25)** | **16.5** | **17** | **18.5** |

"After repo changes" covers what this pass committed (README judge path, screenshots, limitations, the truncation fix). "After About v2" assumes someone pastes docs/DEVPOST-ABOUT-v2.md and adds the screenshots to the Devpost gallery. Neither raises the Technological Implementation score, because that needs the Rovo and MCP gap closed (gap 1).

### Evidence per criterion

**Technological Implementation, 4.** For: a Forge UI Kit app with three UI modules, a product trigger that reads the Jira changelog, Jira REST v3 and Confluence REST v2 with a versioned page update, a Rovo agent, skill and six actions, and a `rovo:mcp` module with a test that all MCP tools are GET. The trace engine is pure TypeScript with 96 passing Vitest tests (was 92) and the manifest passes the Forge CLI validator. A real run on a developer site produced suspect comments, a NOT READY verdict and a Confluence page at version 2. Against: the Rovo agent and MCP tools were never seen working in Rovo chat or an MCP client (`docs/DEVPOST-FIELDS.md` says so openly); pass and fail come only from Done status and a `tw-failed` label; the project load silently truncated at 1,000 issues (fixed in 1917a5b).

**Design, 3 before, 3.5 after.** For: native UI Kit screens (tabs, chart, progress bar, tables), issue panel, project page, settings page, CSV export, graceful config errors. Against: a fresh install shows an empty project page, and getting demo data needs either a token script or hand-made labelled issues; the settings page is a JSON text area; the saved Release-tab screenshot (not used in the README) shows the empty state before Check release is pressed, rather than a verdict. The README now gives a no-token path with real screenshots and documented limits, which makes the product easier to judge but does not change the product.

**Potential Impact, 3.5 before, 4 after the About text is replaced.** For: a specific audience (medical device software teams under FDA 21 CFR 820, ISO 13485, ISO 14971) and a specific failure (a test that passed before its requirement changed). Against: the lede was a generic Inspiration paragraph, and the demonstration is one seeded project. v2 opens with who it is for and a concrete 25 U to 20 U scene, and gives a reproducible path.

**Innovation/Idea, 3 before, 3.5 after.** Suspect links exist in classic requirements tools, so novelty here is bringing them natively into Jira and Confluence with Rovo and MCP access, not inventing the idea. The 2025 Specialized Industries third place, Compliant Workflows for Jira, audits Jira workflow configuration (statuses, transitions, required fields) and reports on it, which is a different job, but the old text never said how Tracewell differs. v2 and the README now make that explicit and say we did not test any competing app.

**Presentation, 3 before, 3.5 after.** The video is 3:15 and under the 5 minute limit, with a synthetic voice, captions and an honest AI disclosure. I sampled it: it is real screenshots with captions plus terminal cards, not a screen recording of the edit producing the suspect comment, and the Rovo section is terminal output of the same action code rather than Rovo chat. Its closing card says 92 tests (now 96). The public page text is clear and honest, but the lede was buried and the page text I could fetch showed no gallery images.

## Comparison with 2025 winners

Based on public text only (the 2025 winners post and each app's Devpost page). I did not see their videos.

| 2025 winner | What it showed that Tracewell does not | What Tracewell has that it does not |
| --- | --- | --- |
| FleetOps (1st, Specialized Industries; Best Rovo) | A Rovo agent presented as the way to get insight, with eleven example questions on its page. A multi-product loop (Jira Service Management, Assets, Rovo) with image analysis. Forge Storage and the Events Queue. A published Marketplace listing. Everything tied to an everyday operational workflow. | A regulated-industry chain with a rule (suspect results) that an auditor recognises. Versioned audit evidence in Confluence. No external AI service, no egress. |
| YardMaster (2nd, Specialized Industries; Best Rovo) | Four Atlassian products working together (Jira, Confluence, Jira Service Management, Rovo), a physical-world story with QR codes, and natural-language questions over Jira and Confluence data. | A narrower, more auditable domain with explicit gap and verdict logic and an offline test suite. |
| Compliant Workflows for Jira (3rd, Specialized Industries) | A very direct regulated-industry pitch (pharma, medtech, fintech) with a guided "apply fixes" action and a downloadable configuration report, and a beta waitlist after the contest. | It audits how Jira is configured. Tracewell traces the work items themselves and flags stale test evidence, so the two are complementary. |
| Frank. (1st, Business Teams; Best Rovo), from the winners post only | Answers in Rovo with permission-aware information and links back to Jira and Confluence. | Not comparable in domain. |

Pattern: both 2025 Specialized Industries podium apps that also won Best Rovo Apps showed the Rovo agent answering real questions. Tracewell's agent is its weakest-proven part.

## Ranked gap list

| # | Gap | Hurts | Status |
| --- | --- | --- | --- |
| 1 | The Rovo agent and MCP tools have never been seen working in Rovo chat or an MCP client, and the video shows terminal output instead. The Best Agents and MCP bonus prizes and the Technological Implementation score lean on this. | Technological Implementation, Presentation, both bonuses | Not fixable offline. Needs a browser: get Rovo access on the developer site, re-record the Rovo section, and if possible complete an MCP client OAuth sign-in. Honestly disclosed in README and About v2. |
| 2 | First-run experience: an installed app on a judge's site is empty, and demo data needs an API token script or hand-made labelled issues. There is no in-app onboarding or demo loader. | Design, Functionality check by judges | Partly fixed: README now has a no-token path (checked by `test/quickpath.test.ts`) and screenshots. An in-app "load demo data" or empty-state guide needs a code change plus `forge deploy`. |
| 3 | Presentation: lede buried, no side-by-side comparison, video is static screenshots plus terminal cards, gallery images unverified, closing card says 92 tests. | Presentation, Impact, Innovation | Partly fixed: docs/DEVPOST-ABOUT-v2.md leads with audience and what is new, with a comparison and honest limits, and six screenshots are in docs/screenshots. Pasting the text, adding the images and any video change need the browser. |
| 4 | Differentiation from Compliant Workflows for Jira was never stated. | Innovation | Fixed in README and About v2. |
| 5 | Silent 1,000-issue truncation and limits not listed. A traceability tool must not silently give incomplete results. | Technological Implementation, trust | Fixed: 1917a5b adds a visible notice on the project page and in agent replies (`configNotes`), with a test. README has a full Limitations section. Needs `forge deploy` to reach the live app. |
| 6 | Pass and fail come only from Done status and a label; no import from test tools or CI. | Technological Implementation, Impact | Not fixed. Roadmap item, stated in README and About v2. |
| 7 | Repeated edits post repeated suspect comments (no deduplication). | Design | Not fixed. Small code change, needs deploy. Listed in Limitations. |
| 8 | Breadth: Jira and Confluence only, four Rovo conversation starters, no Marketplace listing, no Teamwork Graph. Winners used more products and a larger set of example questions. | Innovation, Presentation | Not fixed. Adding more starters is a manifest change and a deploy. |

## What this pass changed

See `git log` on the branch. Code: a notice when a project is over the 1,000 issue read limit (`src/lib/service.ts`, `src/frontend/project-page.tsx`, SKILL.md wording) plus tests for it and for the README quick path. Docs: README rewritten as a judge path with screenshots, feature table, side-by-side comparison, limitations and verification; docs/DEVPOST-ABOUT-v2.md; test counts updated from 92 to 96 in the Devpost drafts.

Verification at the end of this pass: `pnpm test` gives 96 passed and 2 skipped (the two opt-in live tests); `pnpm typecheck` is clean; `pnpm validate:manifest` reports the manifest valid. `forge lint` could not run because the Forge CLI needs a login (keychain error on this machine), and nothing was deployed.
