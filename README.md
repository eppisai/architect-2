# Architect 2.0 — prototype

**Live:** https://architect-2-aman.vercel.app (Vercel) · mirror: https://eppisai.github.io/architect-2/ (GitHub Pages) · **Source:** this repository

A vibe-coding platform for people who don't write code and for developers who do. Describe an app; Architect plans it, builds it while you watch, and puts it online. Change it by chatting, or by selecting any part of the preview. Developers get the same project as code, agents in their own framework, GitHub and a runnable export, without a separate "developer mode".

## Try it in three minutes

1. **Home.** Type any idea ("a CRM for my gym", "an expense tracker for my team") or pick a template. *Build it* opens a sign-in dialog over Home with your idea still visible; Google signs you in with one click (simulated).
2. **Watch it build.** The first chat reply is the plan: pages, agents, data, sign-in and look, named from your own words. Steps stream in the chat, files appear in *Code*, and the preview fills in section by section.
3. **Change it by chatting.** Try "add a dark mode and a feedback button under each answer", "add a leaderboard page", "make the agent friendlier and answer in Spanish" or "rename it to Help Hub". Each request lists what it changed and the files it touched, and becomes a version you can restore. "Undo that" works too.
4. **Select to edit.** Turn on *Select* in the preview and click the answer card: it shows the agent behind it and lets you change behavior in place. The selection travels with your next chat message.
5. **Agents, Code, Data.** Tabs above the canvas. Edit instructions, tools, framework (Lyzr managed, LangGraph, CrewAI, OpenAI Agents SDK or your own code) and test with a trace. Read the generated project with syntax highlighting, see which lines the last change added, and download it as a ZIP that runs (`npm run dev`, `npm test`).
6. **GitHub and Publish** live in the top bar. Connect GitHub and every version is committed automatically. *Publish* runs pre-flight checks, shows progress, then gives you a working link, versions and rollback.
7. **Import.** From Home, *Import from GitHub* reads an example repository (React, Clerk sign-in, a LangGraph agent), shows what it found, and opens it with your first change applied.

## What is real and what is a stand-in

| Real, in this browser | Stand-in |
|---|---|
| Any prompt becomes a project named from its own words, with sample content in its subject (workplace, support, sales, fitness, restaurants, clinics, schools, shops, finance) | Language models: interpretation and answers are deterministic |
| Chat requests become real changes (look, pages, copy, sign-in, agents, tools, instructions) with the exact files they touch | Sign-in providers and email links |
| Every version restorable; undo from chat | GitHub, repository import (one prepared example) and hosting |
| Answers, routing and number questions over your own editable text | Other agent frameworks: their files are written, not run |
| Select-to-edit in the preview, linked to the agent behind each element | Custom domain verification |
| Runs with traces; release snapshots with rollback; a working link for each release and for the draft | |
| Generated source as a runnable project and a real ZIP | |

Projects live in `localStorage`. The account menu can reset the demo. *What's real in this prototype* on Home says the same thing in the product.

## Feature map

| Assignment item | Where |
|---|---|
| Authentication | Sign-in dialog over Home that keeps your idea; Google, GitHub, email link; account menu, sign out; sign-in for the generated app (by chat or in Publish) |
| Homepage | Prompt with attachments, "use my agents" and Plan-first; templates; consultant; import; projects as thumbnails with live or draft state |
| Chat window | Plan or Build mode, streamed steps, files changed, versions, suggestions, clarifying options, @-mentions, attachments, stop |
| App preview | Browser frame, device sizes, pages, console with runs, select-to-edit, open in a new tab |
| Agent section | Instructions, behavior, tools, framework and model with setup status, test with trace, runs, extra agents and handoffs |
| UI getting built | First build streams steps, files and a skeleton that fills in; every later change streams too |
| GitHub integration | Top-bar popover: connect, auto-commit every version, push, branch, pull request, clone command, per-file markers in Code |
| Deploying the app | Publish popover: address, domain, who can open it, pre-flight checks, progress, live link, QR, releases, rollback, deploy log |
| Also | Import, templates, consultant, version history, share and invites, usage and credits, project settings, environment variables, export |

## Run locally

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`. No build step, no dependencies.

```sh
node --test model.test.mjs
```

Thirty model tests cover naming from any prompt; every domain pack's sample questions for all three engines; chat requests becoming changes with the right files; versions and restore; releases, rollback and the ZIP; and exported projects that answer through their API and pass their own tests.

## Design notes

- **The app is always in the middle.** Chat on the left, the preview on the right. Preview, Code, Agents and Data are tabs on the same canvas; GitHub, Share and Publish sit in the top bar.
- **Value before setup.** Name, pages, agents and sign-in are the first reply, not a form. Plan-first is a choice in the composer.
- **Every change is visible and reversible.** Each request shows its steps and the files it touched, and becomes a version you can restore.
- **Two depths, one project.** Every plain-language setting shows the file it writes; developers never switch products.
- **Calm by default.** Warm paper, ink and one accent; big type only where it matters. The app you build has its own look inside the preview.
