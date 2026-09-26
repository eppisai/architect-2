# Architect 2.0 — prototype

**Live:** https://architect-2-aman.vercel.app (Vercel) · mirror: https://eppisai.github.io/architect-2/ (GitHub Pages) · **Source:** this repository

A vibe-coding platform for people who don't write code and for developers who do. You describe what people need; Architect reads it into a starting pattern, shows the app as three steps, and lets you shape any step in place. One change flows through the plan, the preview, the agent, the generated code and the release. Developers get the same project as files, runs and environments without leaving the workspace.

## Try it in three minutes

1. **Home.** Keep the example brief or pick one under *Explore examples*, then *Shape this idea*. Sign in with any provider (simulated) or *Try the demo workspace*; your brief survives sign-in.
2. **Shape.** Architect reads the brief into the closest of three patterns (answers from documents, requests sorted and routed, answers from your numbers), names the app and guesses the audience. Change any of it, then *Create the plan*.
3. **Plan.** Select **step 2** and change how it behaves. Review the before/after, apply, and watch the plan cards update. *Undo* is one click.
4. **Build → App.** Try the sample inputs, including the one the app cannot answer. Open the supporting evidence. Every input is recorded in **Runs** with a trace.
5. **Chat.** Type “shorter answers and show sources” (or “rename it to Help Hub”). The chat proposes a reviewable change instead of applying it silently.
6. **Agents.** Edit behavior, toggle tools (turn off source reading and the app answers with a setup state), run a test, switch the framework (Lyzr managed, LangGraph, CrewAI, OpenAI Agents SDK, custom) and add a second agent. **Code** shows the generated files change with you; download them as a ZIP that runs: `npm run dev` serves the app and its API, `npm test` runs its tests.
7. **Changes.** Connect a demo repository, see the field-level diff and the files affected, commit, then sync. Committed and synced are separate states.
8. **Deploy.** Publish, watch the release progress, open the working recipient view, roll back to an earlier release, add a custom domain.
9. **Import.** From Home, *Import a project* → GitHub or ZIP → inspection → *What I found* → pick a first change. The imported project keeps its framework, sign-in and baseline; the change arrives as a proposal.

## What is real and what is simulated

| Real, in this browser | Simulated, clearly labelled |
|---|---|
| Brief interpretation into three patterns, names and audience | Sign-in providers and email links (demo account, nothing sent) |
| Projects, revisions, undo, release snapshots, rollback | AI generation and freeform edits (three deterministic patterns) |
| Deterministic answers, routing and table math over editable local source text | Repository or archive inspection (one prepared fixture) |
| Chat intents mapped to reviewable setting changes | Agent runtimes for the named frameworks (scaffold files only) |
| Recorded runs with step traces | GitHub commit and sync (local states, no remote) |
| Generated source as a runnable project (server, API engine, tests, stylesheet) in a real ZIP | Production URLs, deploy logs and DNS verification |
| Working recipient route for each release | Studio agent catalog, connectors, invites |

Projects live in `localStorage`. A fresh browser starts empty; the account menu can reset the demo.

## Feature map

| Assignment item | Where |
|---|---|
| Authentication | Sign-in page (Google, GitHub, email link, demo), account menu, sign out, reset; app-side sign-in per project |
| Homepage | Brief, examples, import, consult, recent projects with live/draft state and last action |
| Chat window | Contextual to the selected step, proposes reviewable changes, records other requests |
| App preview | Interactive per pattern, sample inputs, evidence, appearance, audience |
| Agent section | Behavior, knowledge, tools, test panel, framework/model with setup status, add/attach/duplicate/custom agents, handoffs |
| UI getting built | Reading, shaping, building and publishing progress with pause/skip |
| GitHub integration | Connect, branch, working/committed/synced states, field diff, files affected, commit, sync; imported repos arrive connected |
| Deploying the app | Preview vs production, publish flow, releases that snapshot settings, source, agents and tools, rollback, deploy log, custom domain, working recipient link |
| Also | Import inspection, Code view with runnable ZIP export, Runs with traces, environment variables, members, archive, project export |

## Run locally

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`. No build step, no dependencies.

```sh
node --test model.test.mjs
```

Twenty-two model tests cover interpretation, all three patterns, chat intents, runs, tool permissions, generated files, changed-file tracking, release snapshots and rollback, the ZIP writer, and that each pattern's exported project answers through its API and passes its own tests.

## Design notes

- **Select, understand, change.** The plan is the app drawn as steps. Selecting a step opens the controls that shape it, and the same controls appear in the preview and the agent view. There is one source of truth for behavior.
- **Nothing applies silently.** Chat, chips and forms all produce a proposal with a before/after and an example of the effect. Undo is always available; releases never change after the fact.
- **Two audiences, one workspace.** Non-technical people never need the Developer section. Developers get files, runs, environments and framework setup on the same project, and see exactly which files a change touches.
- **Honest boundaries.** Simulated services say so where they happen, once, without banners on every screen.

## Not in this prototype

Live model calls, real provider sign-in, repository cloning, framework execution, remote Git, hosting of generated apps, in-place file editing, a database for projects. Each has a designed place in the flow and a labelled stand-in.
