---
name: const-types
description: "TypeScript type safety and contract rules — no any, Zod as source of truth, explicit boundaries"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Type Safety Constitution

## Hard Rules

- `any` is forbidden. If a library forces it, wrap and re-export with a typed alternative.
- `as unknown as T` requires a comment explaining why it is safe — otherwise it is a bug waiting to happen.
- `unknown` must be narrowed with a type guard before use — never cast directly.
- `tsconfig` must have `strict: true` and `noImplicitAny: true`. These are not negotiable.
- Index signatures (`[key: string]: X`) require explicit justification — prefer a discriminated union or a Map.

## Zod as Single Source of Truth

- All external input (API requests, env vars, third-party responses) validated with Zod at the system boundary.
- The Zod schema IS the type — derive TypeScript types with `z.infer<>`. Never maintain parallel type definitions.
- Zod schemas live in a `schemas/` or `validators/` directory alongside the route or service they guard.
- Parse, do not validate: use `schema.parse()` (throws on failure) not `schema.safeParse()` unless you need the error shape.

## Function Signatures

- Return types are always explicit on exported functions — never inferred for public APIs.
- No optional chaining (`?.`) used to paper over a type error — if a value may be undefined, handle both branches.
- Prefer discriminated unions over boolean flags: `{ status: 'ok'; data: T } | { status: 'error'; message: string }`.
- Function parameters beyond 2 are grouped into a named options object — never a long positional argument list.

## Module Boundaries

- Every module has an explicit public API via `index.ts` barrel export.
- Internal types are not re-exported — consumers must not depend on implementation details.
- Cross-feature imports go through the barrel, never directly to internal files.
- A type that is used in only one file lives in that file — do not pre-emptively move it to a shared types file.
