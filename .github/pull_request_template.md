# Pull Request

## What does this PR do?

<!-- One paragraph. What changed and why. -->

## Phase / Issue

Phase: <!-- 0 / 1 / 2 / ... or N/A -->
Issue: <!-- link or N/A -->

---

## Engineering Constitution Checklist

Read the relevant constitution file(s) before checking a box. A checked box means you read the rule and confirmed it is satisfied — not that you skimmed the header.

### Every PR

- [ ] `tsc --noEmit` passes with zero errors (`const_types.md`)
- [ ] No `any` types introduced (`const_types.md`)
- [ ] All new async paths have explicit error handling — no floating promises (`const_errors.md`)
- [ ] No `console.log` in server-side production code paths — use the project logger (`const_logging.md`)
- [ ] All new log lines include `ts`, `level`, `msg`, `requestId`, `service` (`const_logging.md`)
- [ ] No raw LLM `messages[]` content or response text in any log call (`const_llm.md`)
- [ ] No secrets on disk or in scripts — Key Vault references only (`const_deployment.md`)
- [ ] Smoke test passes locally (intake → skills → pathways → plan → PDF download)

### Routes and API changes

- [ ] Every new/changed `/api/v1/*` route has auth middleware applied (except `/health`) (`const_auth.md`)
- [ ] Every new/changed route has Zod input validation (`const_security.md`)
- [ ] Rate limiting applies to new routes (tighter for LLM-backed routes) (`const_auth.md`)
- [ ] Response shape does not expose raw DB model fields (`const_api.md`)

### LLM / AI changes

- [ ] New LLM call is inside `backend/src/services/llm.ts` or `services/embeddings/embed.py` — not inline (`const_llm.md`)
- [ ] `completion.usage` (token counts) is captured and logged (`const_llm.md`)
- [ ] Response validated with Zod (TS) or Pydantic (Python) before use (`const_llm.md`)
- [ ] Prompt version constant incremented if prompt text changed (`const_prompts.md`, `const_llm.md`)
- [ ] Redactor unit test still passes (`const_llm.md`)

### Database changes

- [ ] Parameterized queries only — no string interpolation into SQL (`const_security.md`)
- [ ] New migration is additive (no column/table drops without a migration plan) (`const_change.md`)
- [ ] Migration runs before code deploy — never after or simultaneously (`const_change.md`)

### Infrastructure / deployment changes

- [ ] New Azure resource has a Bicep module in `infra/` (`const_deployment.md`)
- [ ] No hardcoded subscription IDs, RG names, or regions (`const_deployment.md`)
- [ ] `az deployment group what-if` output reviewed; zero unexpected changes (`const_deployment.md`)
- [ ] `.env.example` updated with new variable names (values not included) (`const_deployment.md`)

### Risky boundary changes (auth model, DB auth, LLM provider)

- [ ] Change ships behind a feature flag with a documented soak window (`const_change.md`)
- [ ] Flag and soak window recorded in `docs/ENTERPRISE_READINESS_PROGRAM.md` decision log (`const_change.md`)
- [ ] Rollback path is clear and tested (`const_auth.md`)

---

## Testing

- [ ] Unit tests added/updated for changed business logic
- [ ] Integration tests cover changed API endpoints (against real DB, no mocks) (`const_testing.md`)
- [ ] Test names describe behavior, not implementation

---

## Notes for reviewer

<!-- Anything the reviewer needs to know that isn't obvious from the diff. -->
