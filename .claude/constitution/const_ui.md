---
name: const-ui
description: "Frontend and component rules — props, state, async UI states, no client secrets, accessibility"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# UI / Frontend Constitution

## Component Boundaries

- Every component has a single responsibility — if it fetches AND renders AND handles errors, split it.
- Props are fully typed at the boundary — no untyped prop spreading (`{...props}` without a known type).
- No prop drilling past 2 levels — use React context, a store, or component composition instead.
- Co-locate state as close to where it is used as possible — do not hoist prematurely to a shared store.
- A component that exceeds ~150 lines is a signal to decompose.

## Mandatory Async States

- Every async operation renders three states explicitly: **loading**, **error**, and **empty** — no silent blank screens.
- Loading states use skeleton screens or spinners — not invisible gaps or missing content.
- Error states show a meaningful message and a recovery action (retry, go back) — never a raw error object or empty space.
- Empty states (no data returned) are explicitly designed — not treated as the same as loading.

## No Client-Side Secrets

- No API keys, tokens, or secrets in client-side code or `NEXT_PUBLIC_` environment variables.
- If a third-party service must be called, proxy it through the API server — never call it directly from the browser.

## Forms

- Form state is managed with a form library (React Hook Form) — not manual `useState` per field.
- Validation schema is the same Zod schema used server-side — shared via a common package, never duplicated.
- Submit button is disabled while the form is submitting — prevent double submission.
- Field-level errors are shown inline, not only as a top-level alert.

## Side Effects

- Data fetching lives in dedicated hooks or server components — not inline inside render functions.
- No `useEffect` with missing dependencies — the `exhaustive-deps` lint rule is enforced without exceptions.
- Cleanup functions are returned from `useEffect` whenever subscribing to external sources or setting timers.

## Accessibility

- Interactive elements are keyboard navigable and have visible focus styles.
- Images have meaningful `alt` text (empty string `alt=""` for decorative images).
- Form inputs have associated `<label>` elements — not placeholder text as a substitute.
- Color is never the only means of conveying information.
