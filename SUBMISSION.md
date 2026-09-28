# Architect 2.0 — submission

**Live prototype:** https://architect-2-aman.vercel.app  
**Public source:** https://github.com/eppisai/architect-2

**Architecture:** [diagram](architecture-diagram.png) · [decisions and technology choices](ARCHITECTURE.md). Both files are in the public repository. The diagram is a proposed production architecture, with the current prototype boundary stated explicitly.

## Submission copy

I designed Architect 2.0 around two starting points: a person with an idea and a developer with an existing repository. Both use one workspace to build, try, inspect and release an agentic application.

Three decisions shape the experience:

- **Connect the interface to behavior.** Select an answer in Preview to discover the responsible agent and change its behavior in context.
- **Reveal technical depth when it is useful.** Preview, Code, Agents and Data share project state; developers get setup, diffs, tests and PR review without a separate product or mode.
- **Make changes recoverable.** Changes become inspectable versions; failed checks lead to a reviewable repair; publishing creates a snapshot with rollback.

On the live site, choose **Take a guided walkthrough**. “Create and improve an app” demonstrates prompt → build → selection → refinement → publish. “Continue an existing project” demonstrates example import → setup → edit → failed tests → repair → PR → publish. Each creates a separate example and provides optional guidance beside the workspace.

The prototype has working browser persistence, supported edits, local answers, database/schema validation, version recovery and runnable source export. AI generation uses three deterministic patterns. Sign-in providers, remote imports/GitHub, external frameworks and deployments are simulated. Demo release links work only in the browser that created them.

## Product summary

Architect 2.0 brings creating an agentic application and continuing an existing project into one workspace. Start with an idea or a repository, try the app, change its interface and agent behavior, review the resulting files, and publish a version.

The core design connects what people see to what the application does. Select an answer card in Preview to inspect the agent behind it. Plain-language changes, agent settings, data and generated files share project state, so users can move between levels of detail without switching products.

## For non-technical users

Describe the outcome, review the first plan, and try a working example as it appears. Refine it through chat or by selecting something in the preview. Understand what the agent may do, test a question, and restore an earlier version when a change goes wrong.

## For technical users

Start from an imported example, inspect framework and setup requirements, and work on a branch. Edit configuration or data, inspect file diffs, run checks, review a proposed fix, and merge a simulated pull request before publishing. Download a runnable source project for local work. Framework presets and a custom entry-point flow demonstrate how developers would retain implementation control.

## Reviewer walkthrough — about five minutes

No account, credentials or API keys are required. Provider buttons simulate sign-in; “Look around a demo workspace instead” also continues your pending action. Projects persist in the browser used to create them.

### 1. Create and improve an app

1. On Home, enter **“Build a policy assistant for our team with sources and feedback buttons”** and select **Build it**. The sign-in dialog retains the idea; continue with the demo option.
2. Watch the plan and build milestones. In Preview, ask **“Can I carry over my leave?”** using the sample question. Inspect the answer and source.
3. Turn on **Select**, click the answer card, and inspect its behavior. Open **Agents** to inspect instructions, source permissions, framework setup and the test trace.
4. Ask the chat to **“make the answers shorter and use a dark mode”**. Open a changed-file chip to see its diff. Use **Version history** to restore the previous version if desired.
5. Open **GitHub** and walk through the demo connection. Then choose **Publish**. Open the release in the same browser and try its sample question.

### 2. Continue a developer project

1. Return Home, choose **Import a repository → Try the example → Open in workspace**. The inspection describes a prepared React/Clerk/LangGraph scenario; the exported runtime is the prototype’s small Node application, not that repository.
2. Open **Code → Start app**. Add the two missing variable names as prompted. These are sample setup states; no real secrets or server processes are used.
3. Open **example-handbook.txt → Edit**, replace its content with **“Working hours: Core hours are 10 to 3.”**, and Save. **Run tests** shows two failed sample-answer checks.
4. Choose **Fix with Architect**, then the proposed source restore in chat. The checks rerun and pass. Add feedback buttons through chat to leave a useful change on the branch.
5. Choose **Publish → Open PR**. Review the diff and checks, create the demo PR, merge it, and publish. **Download** in Code exports actual files you can run locally.

## Implementation boundaries

- **Working:** browser persistence; deterministic answers, routing and tabular calculations; supported chat edits; configuration/data editing; source diffs; version restore; test/repair; release snapshots/rollback; ZIP export and a runnable Node server.
- **Simulated:** language-model generation, OAuth/email, repository/ZIP inspection, GitHub writes, terminal process execution, invitations, provider/model switching, agent-framework execution, domain verification and external deployment.
- Any prompt is accepted, but generation selects among **three application patterns** with domain-specific sample content. It is not arbitrary AI code generation.
- Code edits outside configuration and data are preserved in versions, releases and export; the embedded preview does not execute those files.
- Generated-app sign-in is a UI flow, not an access-control boundary. Release and preview links require the same browser storage and are not cross-device sharing.

## Validation and scope

The repository has **46 passing model tests**, including actual exported-server checks, exported test suites, invalid configuration, code restore and release rollback. Desktop and phone walkthroughs cover the core journeys. The [coverage checklist](COVERAGE.md) maps all explicit requirements and the 24 researched current-Architect capability families to the prototype. These checks do not establish production integration or exhaustive account-level parity.

The completed prototype also covers agent workflow routing, scoped connections, collections/schema editing, reusable design systems, agentlet discovery, marketplace listing configuration, analytics and app-user/session settings. The next engineering step after this UX prototype is real repository/runtime support, authentication and a shared database.

See [design rationale and research takeaways](DESIGN.md) for the reasoning behind the experience. AI tools assisted research synthesis, implementation and verification; this is a prototype submission, not a production-service claim.

## Additional feature walkthrough — three minutes

1. **Agents:** inspect the workflow, add a specialist and connect it on “No answer is found.” Run a question outside the source and inspect the simulated handoff. Connections demonstrates MCP/OpenAPI/A2A with scoped permissions.
2. **Data:** switch to Database, add a record and view its schema. App users configures the app's access and session flows.
3. **Preview:** open Design system, create a personal or organization palette and apply it. The preview and exported tokens update together.
4. **Publish:** open Analytics and marketplace, save listing details with public access, publish, then ask a question in the release. Analytics records the question and feedback in this browser.
5. **Home:** explore Marketplace, Prompt library, customized templates, consultant recommendations and the Shared with me example invitation.

See [COVERAGE.md](COVERAGE.md) for requirement-by-requirement evidence and [VERIFICATION.md](VERIFICATION.md) for validation.
