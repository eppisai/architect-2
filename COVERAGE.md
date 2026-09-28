# Assignment coverage and evidence

Updated 28 September 2026. This is the submission's feature-flow checklist, not a claim of production integration or exhaustive account/plan parity. The brief explicitly permits dummy flows. Every explicit requirement and every capability in the researched A01–A24 Architect baseline has a navigable prototype treatment.

## Required journeys

| Requirement | Implemented journey | Execution boundary |
|---|---|---|
| Authentication | Prompt retained → Google/GitHub/email or demo entry → account → sign out | Provider authentication and email simulated |
| Homepage | Prompt, plan-first, context, agents, consultant, templates, prompt library, marketplace, design systems, project filters | Generation chooses three app patterns |
| Entire agentic app from a prompt | Plan → optional plan/mockup review → streamed build → interactive preview → chat refinement | Deterministic interpretation and answers |
| Import and continue | GitHub/ZIP/example → access/compatibility states → inspection → branch → setup → first change | Prepared repository fixture; arbitrary import is not executed |
| Agents in any framework | Managed Lyzr, LangGraph, CrewAI, OpenAI Agents SDK, custom framework/entry point → generated source → setup | Framework scaffolds and custom contract; no framework runtime |
| Chat and preview | Plan/build modes, attachments, mentions, stop/resume, file changes, device views, selection-to-agent, undo | Supported changes really alter local project state |
| GitHub | Connect → auto/manual commits → branch → diff/checks → PR → merge → publishing gate | Remote operations simulated |
| Deployment | Access/domain → preflight → release progress → recipient → analytics → releases/log/rollback | Browser-local release, not external app hosting |
| Hosting and source | Public Vercel prototype and public GitHub repository | Real hosted prototype; generated apps remain local demos |

## Current Architect preservation map

The A identifiers correspond to the dated research inventory in `homework/02-architect-baseline.md` in the parent workspace. Official documentation was rechecked on 28 September for build, database/auth, publishing, agentlets and themes/context. The authenticated live Home/sidebar and theme manager were also inspected on that date. The live theme manager exposed presets, personal and organization themes; the prototype supplies its own smaller preset catalogue and comparable creation/application flows.

| ID | Capability | Where to demonstrate it |
|---|---|---|
| A01 | Consultant | Home → Ask the consultant → audience/task/context/tools → three ideas → edit brief → build |
| A02 | Prompt library | Home → Prompt library → use case → editable prompt → build |
| A03 | Templates | Home → template → customize the brief → build |
| A04 | Agentlets | Home → Marketplace → category/search → preview + architecture → customize; locally listed releases also appear |
| A05 | Planning/mockup/build | Plan first → plan → Review plan and mockup → Build with these → progressive build |
| A06 | Iteration | Chat or select-to-edit → changed files → version → restore |
| A07 | Agent configuration/testing | Agents → graph node → instructions/behavior → Test → Runs |
| A08 | Context attachments | Composer → files/links; text/CSV knowledge import in Data. Images/PDFs are reference metadata, not parsed embeddings |
| A09 | Themes/design systems | Preview → Design system; or Home → Design systems → preset/personal/organization → create/edit/apply |
| A10 | Reuse Studio agents | Home → Use my agents; Agents → Add agent → Studio → attach → configure local copy |
| A11 | Studio handoff | Agents → Advanced settings or attached Studio agent → Open Lyzr Studio |
| A12 | Database collections/schema | Data → Database → create collection → records/search/edit/delete → view/edit schema; schema changes validate existing data |
| A13 | App accounts/sessions | Data → App users → provider/access/signup/session settings → preview sign-in/create-account/expired-session; published team gate |
| A14 | GitHub destination | GitHub → repository → connect |
| A15 | Automatic source commits | GitHub → auto-commit toggle → versions → commit/push status |
| A16 | Source export | Code → Download; runnable Node project, schema/records/workflow/design configuration included |
| A17 | Hosting/domains | Publish → domain example → access/preflight → release → open recipient; DNS and generated-app hosting simulated |
| A18 | Analytics/marketplace publishing | Publish → Analytics and marketplace → listing fields + public-access validation → publish → local marketplace; recipient questions/feedback recorded in analytics |
| A19 | Shared projects/invitations | Share → invite → manage role/remove; Home → Shared with me → example invitation → accept |
| A20 | Usage | Account → Usage → illustrative balance + actual per-project versions/test runs/releases |
| A21 | Model settings | Agents → main agent → Framework and model; Advanced settings → memory/temperature/approval configuration |
| A22 | Repair | Code → edit → Run tests → Fix with Architect → review repair → rerun |
| A23 | Plans/help/resources | Account → Plan; Home footer → Help and resources; no checkout or support messages sent |
| A24 | Managed vs repository-owned agents | Plan ownership or Agents → Architecture → Lyzr managed / Repository–GitAgent → exported workbench manifest |

Adjacent Studio capabilities are treated separately from native Architect parity: Agents → Connections has MCP, OpenAPI and A2A configuration, per-agent resource/action permissions, credential-variable names, a simulated contract test and disconnect. No actual endpoints are contacted.

## Evidence and interpretation

Official references:

- [Build guide](https://docs.lyzr.ai/enterprise/architect/build/build-guide): planning, agent construction/testing, Studio handoff, app build and refinement.
- [Database and authentication](https://docs.lyzr.ai/enterprise/architect/build/database-auth): collections, documents, schema and app account/session flows.
- [Deployment and publishing](https://docs.lyzr.ai/enterprise/architect/build/deployment): domains, app analytics, marketplace category/summary/description/tags.
- [Agentlets](https://docs.lyzr.ai/enterprise/architect/introduction/platform/agentlets): filtering, preview and architecture inspection. Its clone/modify feature is marked coming soon; our customize flow is a proposal beyond that baseline.
- [How it works](https://docs.lyzr.ai/enterprise/architect/introduction/platform/how-it-works): attachments, theme selection, prompt library and existing Studio agents.

Competitor research covers all nine named references, with official documentation and bounded trials. See [DESIGN.md](DESIGN.md). It is not an every-button audit, a controlled performance benchmark, or participant validation. The product decisions are to retain intent through sign-in and planning, show the app beside its agent behavior, keep developer review in the same workspace, and make changes recoverable.

## Verification

Run `node --test model.test.mjs capabilities.test.mjs`. The 45 tests include exported servers, source archives, invalid code/configuration, branch/PR transitions, database validation, route conditions/cycles, permissions, listing validation, analytics opt-out, theme consistency, version restore and release rollback.

Browser verification on this pass covers prompt → demo sign-in → build; plan-first → plan/mockup handoff; agent add/configure → conditional route → workflow test; database invalid/valid record; app access; connection configuration/test; repository ownership; create/apply design system; publish → released answer/feedback → analytics. Home and workflow were checked at 390px and Database at 320px without document-level horizontal overflow. See [VERIFICATION.md](VERIFICATION.md) for final walkthrough results.

## Deliberate prototype boundaries

The major user-facing capability families have flows. Production OAuth, billing, organization isolation, shared databases, arbitrary code execution, semantic retrieval, real agent runtimes, remote integrations and generated-app deployment remain simulated. Framework and tool configuration is exported but does not execute in the browser preview. Database data is browser-local and deliberately included in restore/rollback; a production database would need a separate migration/recovery policy. This satisfies the assignment's allowed prototype execution level, not production-service equivalence.
