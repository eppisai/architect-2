# Verification — 28 September 2026

This verifies the UX prototype, not external service integration. All data entered during the checks was example data. No hiring form was submitted.

## Automated checks

`node --test model.test.mjs capabilities.test.mjs`: **45 passed, 0 failed**. Includes running the exported Node applications and their tests, generated ZIP contents, configuration validation, developer edit/test/repair and PR states, database record/schema validation, workflow conditions and cycles, disconnected and disabled agents, listing/access validation, analytics opt-out, design tokens, and independent version/release snapshots.

JavaScript syntax checks and `git diff --check` also pass.

## Browser walkthroughs

Tested the local build in Codex's browser and Chrome:

- **New app:** prompt → retained brief at demo sign-in → progressive build → preview. Plan-first additionally opens plan/mockup review with both artifacts selected before building.
- **Agent workflow:** add a handoff agent → configure a conditional connection → test an unanswered request → see the main result and simulated downstream agent status.
- **Database:** open feedback collection → reject a string where a boolean is required → correct the value → save a record and a new project version.
- **Access and distribution:** set public access → configure a marketplace listing → publish → open the browser-local release → answer a question → leave feedback. Builder analytics updated across tabs to one question, one feedback response and a separate preview run.
- **Customization and connections:** create an organization design system → apply → verify the preview's accent; configure scoped MCP connection → simulated contract test; change ownership to repository/GitAgent.
- **Developer:** import example → resolve two missing variable placeholders → edit source → run five checks (two fail) → review and apply repair → five pass → change app → create PR → merge → publish release 1.
- **Discovery:** marketplace search → inspect architecture/preview → customize prompt → build. Consultant → task/context/tools → three suggestions → editable brief. Shared-project invitation → accept → editable example workspace.

No error-level console messages were captured in either local browser used for these walkthroughs.

## Responsive checks

Chrome viewport checks: Home, plan/mockup review and Agents at 390px; Database at 320px. Document scroll width matched viewport width. Desktop preview, workflow, dialogs and database were visually inspected. Previous developer Code checks at 390px and 320px are preserved from the earlier pass. These are bounded checks, not exhaustive device or accessibility certification.

## Boundaries

Real provider auth, remote GitHub operations, arbitrary imports, framework/terminal processes, organization isolation, billing and generated-app hosting are simulated. Preview answers use three deterministic patterns. Records, projects, releases and analytics persist in browser storage; release links require that storage. Custom framework and integration settings are exported configuration, not an executing external runtime. Research coverage is recorded in [COVERAGE.md](COVERAGE.md).
