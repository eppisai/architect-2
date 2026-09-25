# Architect 2.0 — first integrated prototype

25 September 2026. This is the active implementation begun after the user's requested second-agent Q&A. The employer's assignment is the evaluation standard: design/end-to-end UX first, feature coverage second, functioning services a bonus. No numeric score is established.

## Run

From the workspace root:

```sh
python3 -m http.server 49184 --bind 127.0.0.1
```

Open `http://127.0.0.1:49184/architect-v2/`. It is a dependency-free browser application. Use `node --test architect-v2/model.test.mjs` for state tests.

## Try the actual flow

1. Shape the included idea and continue in the demo workspace.
2. Select the answer step. Change length and the no-answer behavior, review, then apply.
3. Build the version. Try carryover leave and the uncovered question. Inspect a source.
4. Open Agents; see the same settings. Open Changes; inspect the actual changed fields.
5. Connect a demo repository, commit and sync. These are separate saved states.
6. Publish a local release and open it as a sample employee.
7. Undo a settings change in the draft. The existing release keeps its prior configuration.
8. Return home and import the Northstar example. Inspect React/sign-in/LangGraph baseline, add sources, then review that focused change.

## What is real

Browser-local project persistence; structured settings edits; contextual request history; before/after review; versioned settings undo; local source text editing/import; deterministic question examples; configuration export; release snapshots and recipient routes. A change is shared across plan, preview and agent setup. Release snapshots freeze settings, source and name.

## What is simulated or incomplete

AI generation and freeform AI edits, account providers, repository scanning/import, agent framework execution, GitHub connection/commit/sync and cloud deployment. Custom chat is saved as a request and explicitly offers supported example edits. Unknown questions follow a defined no-answer behavior; there is no semantic retrieval. Source examples use three keyword topics and named policy lines. Prototype releases work only in their originating browser storage and are not public deployment URLs.

Framework setup is versioned configuration, not proof of arbitrary framework compatibility. Studio reuse, source integrations and import-provider dialogs are shallow explanation/setup demonstrations. These do not constitute full preservation of current Architect capabilities.

Still needed for the complete assignment: deeper meaningful secondary flows (including agent creation/reuse, templates/Agentlets, integrations, database, sharing, usage and deployment/domain states), broader visual/accessibility review, a real public deployment of this prototype, and a GitHub source repository. The older `prototype/` remains untouched as historical work.

## Verification performed

- Eight automated model tests: edit propagation/undo; frozen release settings/source/name; changed source output; unsupported questions; framework preservation; no-op revisions; custom entry-point versioning; initial snapshot review.
- Chrome walkthrough: demo account → visual plan → detailed/follow-up edit → build → both answer paths → supporting source → matching agent settings → exact-field diff → demo connect/commit/sync → recipient sign-in/release.
- Changed the draft after release, refreshed recipient view, and confirmed it retained the earlier fallback behavior.
- Imported sample baseline and applied a citation-only change in the shared workspace.
- Desktop screenshot critique; in-app browser at 390px: home and plan fit without horizontal overflow, conversation opens. Settings navigation retained after discovering it was hidden on narrow screens. This is not a complete mobile/accessibility audit.

## Independent critique and resulting fixes

The second agent challenged an isolated planning screen, then reviewed implementation. Fixed cross-project proposal leakage, behavior-only diffs hiding technical edits, unversioned custom entry points, hardcoded source previews, no-op first suggested edit, and missing initial commit path. Also scoped suggested changes to their named action, made selected editors visible, and kept page navigation from inheriting the prior page's scroll.

No participant usability test was conducted. Local model tests and assistant walkthroughs are evidence about these paths, not proof of a 10/10 submission.
