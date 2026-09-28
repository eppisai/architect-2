# Architect 2.0 — architecture and technical choices

![Architect 2.0 architecture diagram](architecture-diagram.png)

Architect has two ways in: describe an app, or import a GitHub repo. After that, both users work in one place. Chat, Preview, Agents, Code, and Data must show the **same project state**. A change made in chat should be visible in the files and preview. A code change should appear in the next test and release.

**What exists today:** the live submission is a UX prototype. It saves projects in the browser. Supported edits, answers, tests, version restore, and source export work. Sign-in, remote GitHub, external agent frameworks, and hosting generated apps are demo flows. The system below is the production design I would build; it is not running behind the demo.

## The main flow

1. A user gives Architect a prompt or a repo. Architect first shows a plan or an import report. The user can correct it before any files change.
2. The API starts a build job and returns a job ID. The browser then receives events such as `plan_ready`, `files_changed`, `tests_failed`, and `preview_ready`. The user can see progress and cancel the job.
3. The job runs in an isolated workspace. An agent edits files, starts the app, and runs tests there. The agent's model and tool calls pass through policy checks.
4. The user opens the preview through a proxy. They can inspect an answer, the agent behind it, the changed files, and the test trace.
5. For a repo-owned project, Architect puts the change on a branch and opens a pull request. After review, a fixed build artifact is deployed as a release.

## Key decisions

### 1. Keep one clear source of truth

For a new project, Architect stores the project specification and source versions. For an imported project, **GitHub is the source of truth for code**. Architect stores the pinned commit it imported, the plan, run traces, and release records. It writes code changes to a branch; it does not silently replace the main branch.

I would use a **Fastify API with TypeScript** for project commands and **PostgreSQL** for users, access roles, projects, versions, jobs, and releases. **S3 object storage** holds source snapshots and build logs. A version record links a user request to the files changed and checks run. Secret *names* may be in project settings; secret *values* stay in a secret manager. The web app would use **Next.js and TypeScript**. Builder accounts use OIDC, a standard sign-in method, with project roles checked by the API. An app's own end-user sign-in is a separate setting.

### 2. Treat a build as a durable job

A build can take minutes. It may be interrupted, cancelled, or retried. I would use **Temporal** to run the plan, edit, test, preview, and deploy steps. Each step writes its result before the next begins. The browser receives live progress over Server-Sent Events. This lets a user return to a project and see what actually happened.

Each job gets a unique request ID. If a request is retried, Architect must not create a second pull request or deployment. A failed test stops promotion. A proposed repair is shown as a diff and needs review before it is applied.

### 3. Run code outside the control plane

Generated code and imported code can run commands. I would never run them inside the API server. Each project branch gets a short-lived Linux workspace on **Kubernetes**, with **gVisor** as an extra isolation layer. It runs as a non-root user, with no host Docker socket. It has limits for CPU, memory, disk, and time. Network access is denied by default and opened only for approved calls.

The workspace starts from a pinned source version and a known base image. It runs the build, tests, and preview. When idle, it stops. Its source and logs are saved outside the workspace, so a failed worker can be replaced without losing the project.

### 4. Keep the agent harness independent of frameworks

The harness is the part that carries out a build request. Its contract is small: **plan, edit, run, test, report, cancel**. It records the model calls, tool actions, file changes, test results, and errors for one run. The UI can turn this record into progress and a readable trace.

A framework adapter connects that contract to LangGraph, CrewAI, OpenAI Agents SDK, Lyzr-managed agents, or a custom entry point. This lets a developer keep their chosen framework in the repo. Framework code runs in the isolated workspace or a managed agent runtime, never in the API process. Tool permissions are scoped per agent, for example read a data source, write files, or call an external API.

### 5. Put models and external tools behind gateways

The **model gateway** gives the harness one interface for messages, streaming, tool calls, and usage. Provider adapters translate that interface for each model provider. It applies the project's model policy, budget, retries, and rate limits. It records cost and latency. Different models can behave differently, so changing a model should trigger tests; “model-agnostic” does not mean identical answers.

A separate **tool gateway** checks that an agent is allowed to call a Model Context Protocol (MCP) server or API. It adds a scoped credential at call time and records the result. Keys never enter prompts, logs, or generated source. Risky actions, such as publishing or changing a live integration, require a human approval step.

### 6. Make preview and release separate

I would use **Envoy** as the preview and API proxy. The browser connects to Envoy, not directly to a workspace. The proxy checks the user and project, then routes traffic to the right preview. Preview URLs are signed and short lived. Preview and production use separate origins and credentials, so code being tested cannot read the builder's session.

For deployment, the workspace builds a container image from a Dockerfile or buildpack. The release controller checks the tests, required variables, and access settings, then records the exact image hash and project version. Static files go to a CDN; the app's API and agents run as managed containers. Health checks decide whether the release can receive traffic. Rollback switches to an earlier image and settings. Database migrations need their own backup and recovery plan; switching an image cannot undo data changes.

### 7. Use GitHub as a review boundary

A **GitHub App** gives access only to repos the user selects. Import pins a commit so the first build is repeatable. Architect creates a branch, pushes the change, reports its checks, and opens a pull request. Signed webhooks tell Architect when the repo changes. If a teammate pushes new work before merge, Architect shows the conflict and asks for a new review. It does not overwrite their changes.

## Scaling and first production cut

The API and proxy keep project state in the database, so more copies can serve traffic as it grows. Temporal queues absorb build bursts. Sandbox workers scale with the queue, with per-organisation limits on concurrent jobs and cost. Published apps scale separately from the builder. A trace ID connects the prompt, agent run, model calls, source version, pull request, and release, so a failed step can be found quickly.

I would first make accounts, project storage, one supported build stack, safe execution, and previews real. Then I would add GitHub review and production deployment. More framework adapters and integrations come after this path is reliable. That order gives users a complete path early, while keeping each technical boundary testable.
