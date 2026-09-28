# Architect 2.0 — how I would build it

![Architect 2.0 architecture diagram](architecture-diagram.png)

A user can start with an idea or an existing GitHub project. Both should lead to the same workspace. There, the user can see the app, its agents, the code, the data, and what changed.

**The live site is a prototype.** It saves projects in the browser. Some edits, tests, answers, version restore, and code export work. Sign-in, GitHub actions, other agent frameworks, and hosting the apps users create are shown as demo flows. The diagram and choices below describe the real system I would build next.

## How one request moves through the system

1. A user asks for an app or imports a repo. Architect shows a plan before it changes files.
2. The user approves the plan. Architect starts a job in a safe, temporary workspace.
3. An agent edits files and runs checks. The user sees progress, changed files, and errors.
4. The app preview opens through a secure proxy. The user can try the app and inspect its agents.
5. For a GitHub project, Architect puts changes on a branch and shows a pull request.
6. After review, Architect builds a release. The user can open it or go back to an older release.

## What I would use for each part

**Website — Next.js and TypeScript.** Chat, Preview, Agents, Code, and Data share one project. A user does not need to switch products to see a simple view or a technical view.

**Accounts and projects — an identity provider, Fastify, and PostgreSQL.** The identity provider handles sign-in. Fastify is the server API. PostgreSQL stores people, project access, plans, versions, jobs, and releases. S3 stores large files such as source snapshots and build logs. A secret manager stores API keys. Secret values never go into the repo.

**Long jobs — Temporal.** A build may take minutes. Temporal keeps track of each step, even if a worker stops. The user sees what is happening and can cancel. A retry must not create the same pull request or release twice.

**Safe workspace — Kubernetes and gVisor.** Each build gets its own temporary container. gVisor gives the container extra isolation. It can run code and tests, but cannot read another project's files. It has limits for time, memory, CPU, and internet access. This matters for imported code as much as generated code.

**Agent runner — one small contract with framework adapters.** The runner can plan, edit, run, test, report what happened, and stop. A small adapter lets it work with LangGraph, CrewAI, OpenAI Agents SDK, Lyzr, or a custom framework. The user's framework stays in their code. Each run records the files changed and tools used.

**Models and tools — one gateway.** The runner sends all model calls through one service. That service can talk to different model providers, apply a budget, and record cost and errors. A similar gate checks which tools an agent may use. It adds keys only when a call is allowed. Changing a model can change its answers, so Architect should run checks again.

**Preview proxy — Envoy.** The proxy is the front door for previews. It checks who the user is, then sends the request to the right workspace. The browser does not get the container's private address. Preview links expire. Preview and published apps use separate addresses and keys.

**GitHub — a GitHub App.** The user chooses which repos Architect can access. Import starts from a known commit. Architect works on a branch, runs checks, and opens a pull request. If someone else changes the repo, Architect shows the conflict instead of overwriting their work. The GitHub repo remains the main copy of code for imported projects.

**Deployment — container images, a CDN, and Kubernetes.** Architect builds one fixed image from a reviewed version and tests it before release. A CDN serves static pages; containers run the agent and API. Each release records the code, settings, and test result. Rollback restores an older app release. Database changes need a separate backup and migration plan.

## How it stays reliable as it grows

The main API can have more copies when traffic grows. A queue holds build jobs, and more safe workspaces start when needed. Limits per customer stop one large job from taking all the capacity. Published apps scale separately from the builder.

I would build this in stages: real accounts and saved projects; safe builds and previews for one supported stack; GitHub branches and pull requests; then real deployments. I would add more frameworks and tools after this path works well.
