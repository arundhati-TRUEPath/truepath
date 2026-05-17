---
name: const-prompts
description: "LLM prompt authoring rules — file structure, cache eligibility, field contracts, output constraints"
metadata:
  node_type: memory
  type: reference
  originSessionId: 618b7715-8304-4aef-8079-1070d999d570
---

# LLM Prompt Authoring Constitution

## File Structure

- Every system prompt lives in its own file under `src/prompts/` — never inline in a service or route.
- Export as a named `const` string: `export const FOLLOWUP_SYSTEM_PROMPT = \`...\``.
- One prompt per file. Name the file after the specific task: `followup-system-prompt.ts`, not `prompts.ts`.

## Static System Prompt, Dynamic User Message

- The system prompt must be fully static — no template literals with runtime values, no injected variables.
- All session-specific or user-specific data goes in the user message (second turn).
- This is required for prompt caching: OpenAI and Anthropic cache only an unchanged static prefix. A single variable injection invalidates the cache for every request.

## Output Format Contract

- End the system prompt with the exact JSON schema the model must return — a complete example with all required fields populated.
- After the schema example, add a closing constraint line that repeats the count or shape: `The "questions" array must contain exactly 3 objects.`
- Never put prose after the closing constraint. The last thing the model reads shapes the last thing it outputs.
- Always include the instruction `Return only a JSON object — no markdown fences, no commentary, no trailing text` even when using `response_format: { type: 'json_object' }`. The API setting prevents parse failures; the instruction prevents fenced output in edge cases.

## Count Constraints Are Belt-and-Suspenders

- State exact counts in the rules block: `Generate exactly 3 follow-up questions — no more, no fewer.`
- Repeat the count in the closing schema constraint (see above).
- LLMs drift on count without redundancy — a single mention is insufficient.

## Every Output Field Gets Its Own Rule

- For each field in the output schema, write an explicit rule covering: format, length limit, allowed values, and any conditionality.
- Fields left undefined in the rules block get hallucinated behavior that passes superficial validation but fails downstream.
- Conditional rules must state both branches: `layout "column" if any label exceeds 3 words; "wrap" if all labels are 3 words or fewer` — not just "use column for long labels."

## Enums Must Be Listed Inline

- Never say "one of the allowed categories" or "from the list above" — write the exhaustive enum values inline in the rule.
- Zod validates server-side, but the prompt determines what the model attempts. An unlisted value that passes Zod is a data quality failure.

## Rationale Fields Improve Output Quality

- For any generation task that requires domain judgment, include an internal `rationale` field in the output schema.
- The model must justify its choice — this reduces low-signal or off-target outputs.
- Label it explicitly as internal: `rationale is an internal note for staff (not shown to users)`. Without this label, the model may treat it as user-visible and censor useful detail.

## Internal vs. User-Facing Fields

- Explicitly mark every field in the schema as either user-facing or internal-only.
- Internal fields (rationale, scoring signals, debug info) must be labeled `(not shown to users)` in the rule.
- This prevents the model from softening or omitting content it incorrectly assumes the user will read.

## Zod Validates at the Boundary, Prompt Guides Generation

- Always pair a Zod schema with each LLM output. The Zod schema is the server-side contract; the prompt is the generation guide.
- Keep Zod and the prompt in sync — when a field is added to the schema, add a corresponding rule to the prompt.
- On Zod validation failure, log `event: 'llm_response_invalid'` with `issues` and `raw` before throwing. Never silently retry.
