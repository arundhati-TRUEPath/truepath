# Production Build Workflow with Claude Code

A staged process from charter to production deployment, with Claude Code as the primary tool. Each stage ends in **committed artifacts** and a **gate** with evidence. Stages do not overlap.

---

## Operating Principles

1. **Artifacts over memory.** Every decision is a file in the repo. Reference with `@path/to/file.md` instead of re-pasting.
2. **Plan mode before every non-trivial change.** `Shift+Tab` → review the plan → exit → execute. Single biggest hallucination defense.
3. **One stage at a time.** `/compact` at every gate. `/clear` when switching to an unrelated concern.
4. **Sub-agents for isolated work.** Code review, test generation, security review each run in a separate sub-agent so they don't pollute each other's context.
5. **MCP for real systems.** Don't let Claude guess about your DB, cloud, or monitoring — connect MCP servers so it queries reality.
6. **Reversibility decides the model.** Irreversible (charter, architecture, schema, auth, contracts) → Opus. Implementation → Sonnet. Mechanical → Haiku.
7. **Hooks enforce guardrails.** Pre-commit and post-edit hooks make standards automatic, not manual.

---

## Stage 0 — Claude Code Setup
**Goal:** Configure Claude Code itself before writing any project artifact.
**One-time, repays every stage after.**

**Outputs:**
- `~/.claude/CLAUDE.md` — your personal preferences (coding style, communication style)
- `./CLAUDE.md` — project root rules: model strategy, prompt rules, context hygiene (use the version from earlier)
- `.claude/settings.json` — permissions allowlist for trusted commands (`npm test`, `git status`, `terraform plan`, etc.)
- `.claude/commands/` — custom slash commands you'll build over time
- `.mcp.json` — MCP server connections (start empty, add as needed)
- `.claude/hooks/` — at minimum: post-edit formatter, pre-commit test runner

**Gate:** `claude` opens in the repo, picks up `CLAUDE.md`, permissions allowlist works, one custom command runs end-to-end.

---

## Stage 1 — Charter
**Goal:** Define what you're building in one page.
**Model:** `/model opus` + Plan mode

**Outputs:** `docs/01-charter.md` — problem, target users, success metrics, non-goals, constraints, top 3 risks.

**Claude Code practice:** Start the session with `/model opus`, enter Plan mode, give Claude a rough brain-dump, let it produce the charter in plan form. Iterate in plan before writing the file.

**Gate:** You can explain the project in 60 seconds from this doc. Non-goals are written down.

---

## Stage 1.5 — Intents & Feature Decomposition
**Goal:** Capture what users want to do, as atomic testable units, before deciding *how* to build it.
**Model:** `/model opus` + Plan mode

**Why this stage:** Intents are the source of truth that architecture serves, API contracts satisfy, UI flows fulfill, and tests verify. They prevent scope drift and give Claude unambiguous task units later.

**Outputs:**
- `docs/01b-intents.md` — flat list of every user intent in the form: *"As a [role], I want to [action] so that [outcome]"*. Each intent has an ID (`INT-001`, `INT-002`, ...), priority (P0/P1/P2), and acceptance criteria.
- `docs/01b-features.md` — features grouped by domain, each feature linking to the intent IDs it fulfills. One intent can belong to one feature; one feature serves multiple intents.
- `docs/01b-traceability.md` — empty table now, columns: `Intent ID | Feature | API Endpoint | UI Screen | Test ID`. Filled in as later stages produce artifacts.

**Claude Code practice:** Reference `@docs/01-charter.md`. In Plan mode, ask Claude to enumerate intents exhaustively (including error and edge intents — "recover account", "cancel mid-flow", "view audit log"). Review and prune. P0 intents define the vertical slice in Stage 6.

**Gate:** Every charter goal maps to at least one P0 intent. Every intent has acceptance criteria. No feature exists without a parent intent.

---

## Stage 2 — Architecture
**Goal:** Decide the shape of the system before any code.
**Model:** `/model opus` + Plan mode

**Outputs:**
- `docs/02-architecture.md` — stack, service boundaries, data flow, sync vs async, stateless boundaries
- `docs/02-adr/` — one ADR per major choice (language, framework, DB, queue, cloud, deploy target). Each ADR lists rejected alternatives and why.
- `docs/02-diagram.md` — C4 Context + Container diagrams

**Claude Code practice:** Reference `@docs/01-charter.md` and `@docs/01b-intents.md`. Architecture must satisfy P0 intents minimally — don't over-engineer for P2s. Generate ADRs one at a time. `/compact` between ADRs.

**Gate:** Every major dependency has an ADR. Architecture demonstrably serves all P0 intents. No placeholder choices.

---

## Stage 3 — Design Import & Reconciliation
**Goal:** Bring your Claude-designed UI into the repo and let it shape the API contract.
**Model:** `/model sonnet` for extraction, `/model opus` for reconciliation
**This stage exists because the UI dictates what data the API must serve. Designing the API before reviewing the UI guarantees rework.**

**Outputs:**
- `design/` — exported UI assets, components, design tokens from your Claude design
- `docs/03a-component-inventory.md` — list of every screen, every component, every interactive element
- `docs/03a-data-needs.md` — for each screen, what data it reads and writes, what states it has (loading, empty, error, populated)
- `docs/03a-user-flows.md` — happy paths and error paths across screens, **each flow tagged with intent IDs it serves**
- `docs/03a-design-tokens.md` — colors, spacing, typography extracted from the design
- `docs/03a-gaps.md` — any UI element whose data source is unclear or missing from the architecture

**Claude Code practice:** Import the design into a `design/` directory. Have Claude read it (`@design/`) and produce the inventory, data needs, and flows as separate documents in one Plan-mode session. Then switch to Opus and reconcile gaps against `@docs/02-architecture.md`. Update the architecture doc if the UI exposed a missing service or data flow.

**Gate:** Every screen has documented data needs. Every gap in `03a-gaps.md` is resolved (either UI changes, or architecture updates, or explicit deferral with reason).

---

## Stage 4 — Data Model & API Contracts
**Goal:** Lock schema and API surface, informed by the UI's data needs.
**Model:** `/model opus` + Plan mode

**Outputs:**
- `docs/04-data-model.md` — entities, relationships, ownership, retention, PII classification
- `db/migrations/0001_init.sql` — schema as code (no schema drift, no ORM auto-migration in prod)
- `api/openapi.yaml` — full OpenAPI spec covering every data need from Stage 3, **each endpoint annotated with intent IDs it fulfills**
- `docs/04-auth.md` — auth model, roles, permission matrix

**Claude Code practice:** Feed Claude `@docs/03a-data-needs.md` and `@docs/02-architecture.md` together. The API spec is generated to satisfy the UI's data needs explicitly. Validate the spec compiles (run `openapi-generator` or similar) before committing.

**Gate:** Schema and API spec committed. Every endpoint in OpenAPI maps to at least one UI data need from Stage 3.

---

## Stage 5 — Repo Scaffolding
**Goal:** Empty but correct project with all guardrails in place.
**Model:** `/model sonnet`

**Outputs:**
- Folder structure for backend and frontend
- Linter, formatter, type checker, test runner configured and passing on empty code
- Pre-commit hooks (run lint + typecheck + relevant tests)
- `Dockerfile` (multi-stage, non-root, healthcheck) for each deployable
- `docker-compose.yml` for local dev (app + db + queue + dependencies)
- `.github/workflows/ci.yml` — lint, typecheck, test, build on every PR
- `README.md` — local setup, test, deploy in three sections
- **Module-level `CLAUDE.md`** in each major directory (`backend/`, `frontend/`, `infra/`) capturing module-specific rules

**Claude Code practice:** Add MCP server for your database now so Claude can introspect the schema directly. Add a `.claude/commands/scaffold-feature.md` custom command that generates a new feature folder following your conventions.

**Gate:** `git clone && make dev` brings up a working local environment. CI passes on empty repo. All hooks fire correctly.

---

## Stage 6 — Vertical Slice
**Goal:** One end-to-end feature working through every layer.
**Model:** `/model opusplan`

**Outputs:**
- Pick the *thinnest valuable P0 intent* from `@docs/01b-intents.md` that touches: auth → API → DB → frontend → response
- Backend: endpoint + business logic + DB access + tests
- Frontend: screen wired to real API + loading/error/empty states
- Unit tests for business logic
- One integration test **named after the intent ID** covering the full slice
- Structured JSON logging
- Health and readiness endpoints
- Error handling with proper HTTP codes, no internal leaks
- Update `docs/01b-traceability.md` — fill the row for this intent

**Claude Code practice:** Use Plan mode to break the slice into 4–6 commits before writing any code. Build a `code-reviewer` sub-agent — after each commit, invoke it to review the diff before pushing. Spawn a separate `test-writer` sub-agent for integration tests so it doesn't see implementation bias.

**Gate:** Slice runs locally via `docker-compose up`. All tests pass. Logs are structured JSON. Errors return proper codes. Code reviewer sub-agent approves.

---

## Stage 7 — Infrastructure as Code
**Goal:** Entire cloud environment defined in code, before deploying anything.
**Model:** `/model opus` for design, `/model sonnet` for IaC code

**Outputs:**
- `infra/` — Terraform or Pulumi for all cloud resources (VPC, compute, DB, secrets, IAM, DNS, CDN, load balancer)
- Three environments: `dev`, `staging`, `prod` — same modules, different vars
- Secrets via cloud secret manager
- Network: private subnets for compute and DB, public only for ingress
- Autoscaling and resource limits defined per service
- Backup and retention policies for stateful resources
- **MCP server for your cloud provider** connected so Claude can verify real state, not assumed state

**Claude Code practice:** Generate one resource type at a time, plan-mode each. Run `terraform plan` after every change and feed the output back to Claude with `@` reference for review.

**Gate:** `terraform plan` is clean for all three environments. Secrets manager wired. No manual cloud resource exists.

---

## Stage 8 — Deployment Pipeline & Observability
**Goal:** Push to main deploys safely. You can see production.
**Model:** `/model sonnet`

**Outputs:**
- CD pipeline: build → test → security scan → deploy dev → smoke test → manual gate → staging → manual gate → prod
- Blue-green or rolling deploy with automatic rollback on healthcheck failure
- Metrics, logs, traces shipped to observability platform
- Dashboards: request rate, error rate, latency (p50/p95/p99), saturation
- Alerts: error rate spike, latency breach, healthcheck failure, resource saturation
- `docs/08-runbook.md` covering top 5 expected incidents
- **MCP server for your observability platform** so Claude can read real metrics during debugging

**Claude Code practice:** Add `.claude/commands/incident.md` — a custom command that pulls recent logs, errors, and metrics into context for incident response.

**Gate:** A deliberately bad deploy auto-rolls back and pages you. Dashboards show synthetic load.

---

## Stage 9 — Production Readiness Review
**Goal:** Final pass before declaring production-ready.
**Model:** `/model opus` + `ultrathink`

**Outputs:** `docs/09-prod-readiness.md` — checklist with **linked evidence**:
- [ ] `docs/01b-traceability.md` complete — every P0 intent maps to an endpoint, screen, and test
- [ ] Load test at 2x expected peak — link to results
- [ ] Failure injection (kill pod, drop DB connection, exhaust disk) — link to logs showing graceful degradation
- [ ] Security: dependency scan, secrets scan, OWASP Top 10 review, auth pen check
- [ ] Backup restore tested end-to-end — link to restore timestamp
- [ ] Cost estimate per environment, cost-anomaly alerts configured
- [ ] On-call rotation and escalation defined
- [ ] Data privacy: PII handling, retention, deletion documented
- [ ] API docs published, runbook current, diagrams match reality

**Claude Code practice:** Run a `security-reviewer` sub-agent over the full repo with Opus + ultrathink. Run a `prod-readiness` sub-agent that validates each checklist item against the actual repo and infra.

**Gate:** Every box checked with linked evidence. Ship.

---

## Widening (Post-Slice)
Stages 0–5 and 7 are one-time. Stage 6 (vertical slice) repeats per feature with shrinking deltas. Re-run Stage 2 only when adding a new bounded context. Re-run Stage 9 quarterly or before any major release.

---

## Anti-Patterns
- ❌ Building before Stage 4 contracts are committed
- ❌ Importing the UI design after the API is locked
- ❌ Deploying before Stage 7 IaC exists
- ❌ Skipping ADRs because "the choice is obvious"
- ❌ Carrying one chat across multiple stages — `/compact` at every gate
- ❌ Horizontal layers instead of vertical slice
- ❌ Observability as Stage 9 work — it ships with Stage 6
- ❌ Manual cloud clicks alongside Terraform
- ❌ Running all sub-agents in one context — defeats the isolation
