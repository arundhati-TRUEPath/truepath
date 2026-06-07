---
name: const-llm
description: "LLM and AI provider rules — call centralization, Azure OpenAI, token logging, PII redaction, response validation"
metadata:
  type: reference
---

# LLM & AI Provider Constitution

## Call Centralization

- All LLM chat completion calls flow through `backend/src/services/llm.ts`. No inline `openai.chat.completions.create()` anywhere else.
- All embedding calls flow through `services/embeddings/embed.py`. No inline embedding SDK calls in other Python modules.
- `backend/src/services/pathways.ts` orchestrates calls through `llm.ts` — it does not instantiate an OpenAI client.
- Adding a new LLM capability means extending the central service, not creating a parallel client.

## Provider Switch

- The provider is controlled by `LLM_PROVIDER=openai|azure`. Default is `azure` post-migration (Phase 6+).
- The switch is evaluated at startup, not per-call. Both providers share the same function signatures.
- The `openai` path is kept until the 7-day post-migration soak period ends, then removed in Phase 8.
- The switch is documented in `docs/ENTERPRISE_READINESS_PROGRAM.md` decision log while active.

## Azure OpenAI Access

- Azure OpenAI is accessed via `DefaultAzureCredential` — no API keys in env or Key Vault.
- The UAMI `truepath-staging-id` holds `Cognitive Services OpenAI User` role on the Azure OpenAI resource.
- Deployment names (`gpt-4o`, `gpt-4.1-mini`, `text-embedding-3-small`) are env vars: `AZURE_OPENAI_CHAT_DEPLOYMENT`, `AZURE_OPENAI_FOLLOWUP_DEPLOYMENT`, `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`.
- The Azure OpenAI endpoint is an env var `AZURE_OPENAI_ENDPOINT`. Never hardcoded.

## What Every LLM Call Must Log

Every call to the LLM must produce a log line with ALL of the following — and nothing else from the request/response:

```json
{
  "event": "llm_call",
  "requestId": "<uuid>",
  "model": "gpt-4o",
  "deploymentName": "gpt-4o",
  "promptVersion": 3,
  "promptTokens": 412,
  "completionTokens": 187,
  "totalTokens": 599,
  "latencyMs": 1240,
  "status": "success" | "error",
  "errorCode": "content_filter" | null
}
```

- `completion.usage` is read and logged on every call. Never discard it.
- `latencyMs` is measured from just before `openai.chat.completions.create()` to just after.
- `promptVersion` is the version constant exported from the prompt file (see `const_prompts.md`).

## PII Redaction — Hard Rule

- Raw `messages[]` content is **never** logged. The user's intake answers, personal situation, location, and finances are PII.
- Raw LLM response text is **never** logged. It may contain reflected PII.
- Redaction is enforced at the centralized logger wrapper in `backend/src/lib/llmRedact.ts` (Node) and `services/llm_redact.py` (Python). Call sites do not handle redaction — the wrapper does.
- A unit test in `backend/src/lib/llmRedact.test.ts` takes a known intake payload and asserts it does not appear in any captured log line. This test is a required CI gate.

## Response Validation

- Every LLM response is Zod-validated (TypeScript) or Pydantic-validated (Python) against its expected schema before the result is used.
- On validation failure: log `event: 'llm_response_invalid'` with `requestId`, `issues[]`, and a truncated/sanitized `rawPreview` (first 200 chars, stripped of PII). Never log the full raw response.
- Never silently retry a validation failure. Surface it as a typed application error.
- `content_filter_results` (Azure OpenAI) is handled explicitly: if a completion is filtered, log it and return a typed error to the caller — do not throw unhandled.

## Client Instantiation

- The OpenAI / AzureOpenAI client is instantiated **once** at module load (singleton), not per request.
- Timeout and maxRetries are configured on the client: `timeout: 30_000`, `maxRetries: 2`.
- The client is never exported from the service module — only the public functions are exported.

## Do / Don't

| Do | Don't |
|---|---|
| All LLM calls through `llm.ts` / `embed.py` | Instantiate an OpenAI client in a route handler or repository |
| Log token counts, latency, model, requestId | Log `messages[]` content or raw model responses |
| Use `DefaultAzureCredential` for AOAI | Store AOAI key in Key Vault |
| Validate every response with Zod/Pydantic | Trust LLM output without schema validation |
| Read `completion.usage` on every call | Discard usage metadata |

## PR Checklist (LLM-related changes)

- [ ] New LLM call is inside `llm.ts` or `embed.py`, not inline
- [ ] `completion.usage` is captured and logged
- [ ] No `messages[]` content in any log call
- [ ] Response Zod/Pydantic schema updated if output shape changes
- [ ] Prompt version constant incremented if prompt text changes
- [ ] Redactor unit test still passes
