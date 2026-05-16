# TruePath — Stack & Conventions

## Tech Stack
- **Frontend:** Next.js (React), TypeScript, Tailwind CSS
- **Backend:** Node.js / Express, TypeScript
- **Scripting / Services:** Python
- **Styling:** Tailwind CSS — utility-first, no custom CSS unless necessary

## TypeScript
- Always use strict TypeScript (`"strict": true`).
- Prefer explicit types over `any`. Never use `any` unless there is no alternative.
- Use `unknown` instead of `any` for external data (API responses, parsed JSON).
- Avoid type assertions (`as SomeType`) unless provably safe.
- Prefer `interface` for object shapes, `type` for unions and utility types.

## Code Style
- No comments unless the WHY is genuinely non-obvious (a hidden constraint, workaround, or subtle invariant).
- No docstrings or multi-line comment blocks.
- Prefer functional patterns — avoid classes where plain functions suffice.
- Keep functions small and single-purpose.
- No premature abstractions: three similar lines is better than a questionable helper.
- No error handling for scenarios that cannot happen. Validate only at system boundaries (user input, external APIs).

## File & Folder Conventions
- Components: `PascalCase.tsx`
- Utilities / hooks: `camelCase.ts`
- API routes: `kebab-case` directories following Next.js App Router conventions
- Python scripts: `snake_case.py`

## Testing
- Write tests for new features when a test suite already exists.
- Do not mock internal modules; prefer integration-style tests over heavily mocked unit tests.

## Python
- Use Python 3.10+ features where appropriate.
- Type-annotate function signatures.
- Prefer `pathlib` over `os.path`.
