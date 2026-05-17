---
name: const-api
description: "API design rules — REST conventions, response envelope, status codes, versioning, idempotency"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 83afbf36-2413-4314-83d2-e2bb0a913f5b
---

# API Design Constitution

## Resource Naming

- Plural nouns for resource endpoints: `/users`, `/sessions`, `/applications` — not `/getUser`, not `/user`.
- Nested resources reflect ownership: `/users/:id/applications` — not a flat `/applications?userId=`.
- Actions that do not map to CRUD use a verb sub-resource: `POST /applications/:id/submit`.
- No verbs in resource paths — the HTTP method is the verb.

## Response Envelope

Every response uses a consistent shape:
```
{ "data": T | null, "error": { "code": string, "message": string } | null, "meta": { ... } | null }
```
- `data` and `error` are mutually exclusive — one is always `null`.
- `meta` carries: pagination cursors, rate-limit info, request ID, API version.
- Never return `200 OK` with an error in the body.

## Status Codes

- `200` success with body. `201` created. `204` no content.
- `400` validation error (malformed input). `401` unauthenticated. `403` unauthorized. `404` not found. `409` conflict. `422` semantically invalid.
- `500` unexpected server error — never include a stack trace or internal detail in the response body.
- Use the correct code — never default everything to `400` or `500`.

## Authentication

- Auth middleware runs before the handler — handlers assume an authenticated, authorized user.
- Permission checks are explicit and fail-closed: deny if the authorization decision is ambiguous or missing.

## Versioning

- Version the API from day one: `/api/v1/...`.
- Breaking changes go into a new version — never silently break an existing version.
- Deprecation notices appear in response headers (`Deprecation`, `Sunset`) before removal.

## Idempotency

- Mutation endpoints that are safe to retry accept an idempotency key header.
- `GET` and `DELETE` are idempotent by design — never design behavior that violates this.
- `POST` is not idempotent by default — add idempotency key support for payment, submission, and booking flows.
