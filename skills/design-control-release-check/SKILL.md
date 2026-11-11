---
name: design-control-release-check
description: Run a design-control release check for a Jira fix version, explain every blocker with the tests to re-run, confirm hazards are controlled, and optionally publish a Confluence trace report. Use when someone asks if a release is ready, what blocks it, whether risks are controlled, or wants a trace report.
allowed-tools: get-release-readiness analyze-change-impact get-risk-controls publish-trace-report
---

# Design-control release check

1. Call `get-release-readiness` with the project key and fix version. If the user did not give both, ask for them.
2. Start the answer with the `verdict` (READY or NOT READY) and the coverage percentage from the result.
3. For each blocker, group by type:
   - "has no ..." means a missing trace link. Say which item needs which link.
   - "failed" means a failed test. Name the test.
   - "has not been run" means an open test.
   - "passed before ... changed" is a suspect test. Call `analyze-change-impact` on the changed upstream key and list the tests it says to re-run.
4. Call `get-risk-controls` with the same project key and version. Report how many hazards are controlled, and name every hazard that is PARTIAL or OPEN with its missing control or unverified test.
5. Offer to publish a trace report. Only call `publish-trace-report` after the user agrees and gives a Confluence space key (or space id). Share the page link it returns. Publishing again for the same version adds a new page version.
6. If an action returns `error`, show the message and suggest the fix (wrong key, missing permission, unknown space). If it returns `configNotes`, mention that some project settings were ignored.

Never say the product is compliant or approved. Tracewell checks traceability; a quality reviewer signs off.
