# Design rationale

## The problem

A person starting from an idea needs a useful first result and a way to correct it. A developer arriving with an existing project needs to understand what will be preserved, what changed, and whether it is safe to release. Both need to connect the visible application to its underlying behavior.

The assignment prioritizes design and end-to-end flows, then feature coverage. The prototype therefore invests in coherent state transitions and reversible changes before live infrastructure integrations.

## Five product decisions

| User need | Design decision | Tradeoff |
|---|---|---|
| Start without preparing a specification | Prompt on Home; authentication retains the idea; the plan appears in chat | The prototype uses bounded interpretation, so templates make its supported patterns discoverable |
| Understand and change the app | Chat beside Preview, with selection carrying context into a request | The builder must keep UI selection and behavior configuration consistent |
| Move between simple and technical work | Preview, Code, Agents and Data share one workspace; GitHub, Share and Publish remain global actions | Dense controls need progressive disclosure and a separate chat/app switch on phones |
| Continue an existing project confidently | Inspection first, setup requirements visible, changes on a branch, diff/checks before merge | Inspection is a prepared fixture; it does not prove arbitrary repository compatibility |
| Recover from a mistake | Changes create versions; failed checks propose a repair; releases preserve snapshots | Restoring code, restoring data and rolling back a release must have explicit, consistent boundaries |

Warm paper backgrounds, restrained color, consistent pill controls and two main typefaces keep the builder visually quiet. The preview has its own theme so users can distinguish the app they are making from the tool they are using.

## What informed the design

Research was recorded on **24–25 September 2026**. It combined official documentation, public UI inspection and bounded authenticated trials. It was not an exhaustive every-feature benchmark, a controlled comparison, or participant research. The takeaways below are design interpretations, not claims that competitors lack these capabilities.

| Reference | Research focus | Takeaway used here |
|---|---|---|
| [Architect / Lyzr](https://docs.lyzr.ai/enterprise/architect/build/build-guide) | Planning, mockup handoff, agent reuse and configuration | Keep the app and its agent behavior connected; distinguish generated sample output from a successful run |
| [Replit](https://docs.replit.com/) | Prompt-to-app and existing-project development | A useful workspace must communicate environment readiness as well as build progress |
| [Lovable](https://docs.lovable.dev/) | Visual iteration and generated-app trials | Make the result easy to try and refine; retain context between changes |
| [Emergent](https://help.emergent.sh/first-app) | Conversational clarification and iteration | Carry requirements and decisions through the build conversation |
| [v0](https://v0.app/docs/git-import) | Repository import and review | Connect source, environment setup, preview and PR review in one journey |
| [Rocket.new](https://docs.rocket.new/build/connectors/github/code-sync) | Visual/source changes and code synchronization | Make branch and sync direction understandable |
| [Cursor](https://cursor.com/docs/cloud-agent) | Repository context and isolated agent work | Existing-project support includes setup, testing and review, not just a file list |
| [Codex](https://learn.chatgpt.com/docs/environments/git-worktrees) | Worktree and branch-oriented tasks | Expose working scope and review boundaries without forcing them into the first prompt |
| [Claude Code](https://code.claude.com/docs/en/checkpointing) | Repository work and checkpoint recovery | Define what Restore actually recovers and test that promise |

The direct trials were uneven: Architect generation completed but two preview requests failed for undiagnosed reasons; a Replit-generated example encountered a runtime setup blocker; six Lovable UI executions and six direct Lyzr Studio responses were recorded. Different accounts, models and wrappers prevent a platform-quality ranking. Those observations motivated clearer setup, testing and recovery states rather than claims of superiority.

## Coverage and limits

The eight explicitly listed surfaces—authentication, Home, chat, preview, agents, building, GitHub and deployment—have interactive flows. Additional flows include import, code edits, diffs, test/repair, data, templates, reusable-agent examples, environment setup, versions, sharing roles, usage and settings.

The completion pass maps all 24 researched Architect capability families to interactive treatments; see [COVERAGE.md](COVERAGE.md). Agentlets, reusable design systems, database schema/record editing, analytics, listing settings and conditional agent workflows are now implemented. This is feature-flow coverage of the documented/observed baseline, not exhaustive account-level or production parity. Framework selection generates scaffolding and setup states; it does not execute every framework.

## What to test next with people

Ask a non-technical participant to change an answer's behavior and explain which agent is responsible. Ask a developer to identify what import preserved, fix a failing check and describe what will enter production. Observe wrong turns and uncertainty, especially around simulated setup, preview versus release, and the scope of restore. No participant validation has been conducted yet.

## Completion-pass design decisions

The agent graph makes responsibility and handoffs visible; selecting a node opens its configuration, and tests show conditional routes separately from the main deterministic answer. Database and app-user controls sit inside Data. Design systems sit beside Preview and on Home because users need them both before and after a build. Listing and analytics settings sit with Publish so discovery follows a reviewed release. None of these additions requires a separate developer mode.
