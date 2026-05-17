---
name: const-structure
description: "Clean code and maintainability rules — naming, function design, cohesion, no dead code, immutability"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# Code Structure Constitution

## Naming

- Names reveal intention: `getUserByEmail` not `get`; `isEligibleForPromotion` not `check`.
- No abbreviations unless universally understood (`id`, `url`, `db`, `http`). No single-letter variables except loop indices.
- Booleans are named as predicates: `isActive`, `hasPermission`, `canRetry`, `shouldRefresh`.
- Constants: `UPPER_SNAKE_CASE`. Types and classes: `PascalCase`. Everything else: `camelCase`.
- File names match the primary export: `UserService` → `user.service.ts`. No ambiguous names like `utils.ts` or `helpers.ts`.

## Function Design

- One function, one responsibility. If the name contains "and", it must be split.
- Maximum ~50 lines. Longer functions are decomposed — not an accepted exception.
- Guard clauses at the top: return early for invalid preconditions rather than nesting the happy path inside `if` blocks.
- No boolean parameters that switch behavior: prefer two named functions or a discriminated options object.
- No side effects in functions named as queries (`get`, `find`, `is`, `has`) — queries must not mutate state.

## Module Cohesion

- Group code by feature/domain, not by type: `/users/` not separate `/controllers/`, `/services/`, `/models/` directories.
- High cohesion within a module: things that change together live together.
- Low coupling between modules: depend on interfaces and barrel exports, not concrete internal implementations.
- No circular dependencies. If A imports B and B imports A, extract the shared concern into C.

## Immutability

- `const` over `let` everywhere. Use `let` only when a value must be reassigned and reassignment is unavoidable.
- Do not mutate function arguments — return new values.
- Prefer `map`, `filter`, `reduce` over imperative loops that accumulate via mutation.
- Object spread (`{...obj, key: value}`) over `Object.assign` for shallow updates.

## No Dead Code

- No commented-out code — version control holds history; comments that preserve deleted code are noise.
- No unused exports, variables, parameters, or imports — enforced by lint rules.
- No `TODO` comments without a linked issue. If it matters, track it. If it does not matter enough to track, remove it.

## File Size

- A file exceeding ~300 lines is a signal to decompose — not a hard rule, but a reliable smell.
- One primary export per file. Helper functions that exclusively support that export live in the same file.
- Avoid barrel files that re-export everything — they create implicit coupling and slow TypeScript resolution.
