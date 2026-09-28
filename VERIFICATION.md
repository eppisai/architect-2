# Verification — 28 September 2026

This verifies the UX prototype, not external service integration. All data entered during the checks was example data. No hiring form was submitted.

## Final coherence and artwork pass

Fresh local Codex browser checks covered both guided journeys:

- Home → guided create → retained idea at demo sign-in → build → sample answer → selection inspector → Detailed answer updates immediately → agent link opens the responsible agent’s Behavior configuration.
- Refinement → changed files → demo release. Displayed URL and Copy target use the same actual browser-local URL; the production domain is labeled separately as illustrative.
- Guided developer example → two setup-variable placeholders → data edit → two failed checks → reviewed source restore → five checks pass → feedback change → PR diff → merge → demo release.
- Guide position persists on reopening a project; it can be hidden and restored. Next is manual navigation, not task-completion tracking.
- Templates grouped by job; Gym member CRM inspection showed New request / My requests, Request sorter and a domain-specific sample question. Marketplace covers loaded. Knowledge / Database / App users retain shared navigation and explicit execution boundaries.
- Both generated icons retain real alpha channels. The five optimized images total about 190 KB.
- Desktop visual checks: Home, template groups/detail, walkthrough chooser, answer inspector, marketplace and release. Walkthrough chooser at 390px and 320px; workspace/publishing at 320px. Fixed minimum-width clipping that did not produce document overflow. Checked workspace at 320px has no visible buttons extending past the viewport.
- Marketplace and database search use a shared aligned field/action layout. Marketplace input and Search button measured identical top/bottom edges and 40px height after the user flagged the original alignment.
- No error-level console messages captured during local checks. These are bounded coherence checks, not participant validation or an exhaustive every-control accessibility audit.

## Automated checks

`node --test model.test.mjs capabilities.test.mjs`: **46 passed, 0 failed**. Includes running the exported Node applications and their tests, generated ZIP contents, configuration validation, developer edit/test/repair and PR states, database record/schema validation, workflow conditions and cycles, disconnected and disabled agents, listing/access validation, analytics opt-out, design tokens, and independent version/release snapshots.

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

## Visual/navigation revision checks

On 28 September, verified the redesigned desktop Home, retained-brief sign-in and build, workspace Preview and Agents, project-library navigation and active state, plus mobile menu → Marketplace → close. Home has no document horizontal overflow at 390px and 320px. Mobile menu hides background controls from focus, exposes an explicit close action and supports Escape. The unchanged 45 model/capability tests pass. These checks establish rendering and interaction behavior, not user endorsement of the visual direction.
