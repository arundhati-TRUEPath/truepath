# TruePath — Architecture

| Field | Value |
|-------|-------|
| **Status** | MVP — Active |
| **Date** | May 2026 |
| **Stack** | Next.js 15 · Express 4 · Python 3.10 · TypeScript strict |
| **Source docs merged** | `FRONTEND_ARCHITECTURE.md`, `system-design.md` |

---

## 1. Guiding Constraints

These are non-negotiable. Every architectural decision below is constrained by them.

- **No login, no accounts.** Sessions are stateless. No PII is stored anywhere — client, server, or database.
- **No free-text input.** All user interaction is pill/button selection. Keyboard entry is not in the intake flow.
- **No direct LLM calls from the browser.** All AI requests go through the Express backend.
- **No persistence between visits.** Zustand is in-memory only — refresh = restart. No user data is persisted to the client or server.
- **Inclusive by default.** The product must work for ESL users, low-literacy users, and mobile users at 375px width without degradation. This constrains component API design and copy length.
- **Out of scope (do not architect for):** login, resume upload, voice/chat, job boards, eligibility screening, case manager dashboard.

---

## 2. Tech Stack

### Why This Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend framework | **Next.js 15 App Router** | Server components handle the app shell (fast initial load for low-bandwidth users). Client components own the interactive wizard. Single deployment unit. |
| Styling | **Tailwind CSS v3** | Enforces the design token system. No CSS-in-JS runtime cost. Responsive utilities cover the 375–1440px range without media query clutter. |
| Client state | **Zustand v5** | Flat store, no boilerplate, zero re-render overhead outside subscribers. `reset()` wipes the session in one call. Works cleanly as a `'use client'` singleton in Next.js — no context provider wrapping every page. |
| Server state | **TanStack Query v5** | Manages the loading/error/retry lifecycle for AI endpoints that take 2–8s. Built-in `staleTime`, `retry`, and `onError` callbacks remove boilerplate from every feature hook. |
| HTTP client | **Axios** | Interceptors centralize error normalization into `AppError`. Response type inference via generics. |
| Backend runtime | **Node.js / Express 4 + TypeScript** | Thin orchestration layer — no heavy framework needed. Validates input with Zod, fans out to OpenAI and Python services, returns typed JSON. |
| AI / ML services | **Python 3.10 (embeddings + indexing)** | Python owns tiktoken and the OpenAI embeddings SDK. `embed.py` is called by Express via HTTP for request-time embedding. `indexer.py` runs offline to upsert skill vectors into Supabase. Keeps the embedding pipeline in the ecosystem best suited for it without polluting the Node.js process. |
| Database | **Supabase (PostgreSQL + pgvector)** | Single platform for relational data (seed questions + choices, session rows) and vector search (skill embeddings via pgvector). Eliminates FAISS on disk and a separate session storage concern. For MVP corpus (< 1000 skills), pgvector cosine search is well within performance bounds. If corpus grows past ~100k entries, `rag.ts` is the only migration point. |
| Language across all layers | **TypeScript strict** | Shared type contracts between frontend and backend. `unknown` for all external data at system boundaries. No `any`. |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│  Next.js 15 App Router (RSC shell + Client Components)              │
│  Zustand (session) + TanStack Query (server state)                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │  HTTP/JSON  (Axios → AppError normalized)
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Express 4 + TypeScript                                              │
│  Routes: /intake · /skills · /pathways · /analytics                  │
│  Middleware: CORS · JSON · Zod validation · Error handler            │
│  Services: llm.ts · embeddings.ts · rag.ts · db.ts                  │
└──────┬──────────────────────┬──────────────────────┬─────────────────┘
       │  LLM_PROVIDER (chat) │  HTTP (embeddings)   │  Supabase JS SDK
       ▼                      ▼                      ▼
┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐
│  LLM Chat        │  │  Python Services  │  │  Supabase                │
│  ──────────────  │  │  embed.py         │  │  PostgreSQL (relational)  │
│  OpenAI → gpt-5.4│  │  indexer.py       │  │  ─ questions + choices   │
│  OSS → gpt-oss   │  │  (offline only)   │  │  pgvector                │
└──────────────────┘  └───────────────────┘  │  ─ skill embeddings      │
                                             └──────────────────────────┘

Offline (batch job, not on request path):
  rag/indexer.py → reads source data → embed_batch() → UPSERT into Supabase pgvector
```

### Layers

**Frontend (Next.js)** — drives the wizard UI, manages session state, renders AI responses. Never calls OpenAI directly.

**Backend (Express)** — central orchestrator. Validates all input, calls OpenAI for generation, calls Python services for embeddings and retrieval, assembles responses.

**Python Services** — owns the embedding pipeline. Two sub-modules:
- `embeddings/` — wraps OpenAI embeddings API; called by Express via HTTP at request time (`embed_text`) and by the indexer offline (`embed_batch`)
- `rag/` — `indexer.py` is an offline batch job that embeds source data and upserts into Supabase pgvector; no retriever on the request path

**Supabase** — single persistence platform. Two logical concerns:
- `questions` + `question_choices` tables — seed question corpus; read by `/intake/questions`
- `skill_embeddings` pgvector table — skill corpus with 1536-dim embeddings; queried by `rag.ts` on every `/pathways/recommend` request via cosine similarity search

---

## 4. Request Flow

```
[1]  Browser → Express          GET /intake/questions
[2]  Express → Supabase         SELECT questions + choices ORDER BY display_order
[3]  Express → Browser          Return Question[]

[4]  Browser → Express          POST /intake/followup  { answers: IntakeAnswer[] (7 total) }
[5]  Express → LLM              System prompt + 7 Q+R → generate 3 follow-up questions with answer choices
[6]  LLM → Express              FollowupResponse { questions: FollowupQuestion[] }  ← batch of 3, each with choices
[7]  Express → Browser          FollowupResponse

[8]  Browser → Express          POST /skills/infer  { answers: IntakeAnswer[] (10 total) }
[9]  Express → LLM              System prompt + all 10 Q+R → generate skill candidates
[10] LLM → Express              6 high-confidence + 3 low-confidence Skill[]
[11] Express → Browser          SkillsResponse { skills, rationale }

[12] Browser → Express          POST /pathways/recommend  { confirmedSkillIds, answers }
[13] Express → Python embed     embed_text(skill query)
[14] Python → Express           query vector (float[1536])
[15] Express → Supabase         pgvector cosine_similarity(queryVector, skill_embeddings, top_k=10)
[16] Supabase → Express         top-k skill/pathway matches with similarity scores
[17] Express → LLM              matches + constraints + system prompt → rank 3 pathways
[18] LLM → Express              Pathway[] + limitationsSummary
[19] Express → Browser          PathwayResponse

```

**Two-stage LLM design rationale:** Generation (steps 5, 9, 17) uses the chat model for open-ended reasoning. Embedding (steps 13–14) uses the embeddings model for structured similarity; similarity search (steps 15–16) runs as a pgvector SQL query in Supabase. These are different tasks with different execution surfaces — separating them keeps prompts clean and allows independent model upgrades.

**Adaptive questioning:** The LLM is invoked at step 5 (after 7 answers) to generate contextual follow-ups before final skill inference. This keeps the seed question set small and static (easy to update in data) while personalizing depth per user.

---

## 5. Frontend Architecture

### Route Structure

```
/                           Landing page (RSC)
/(wizard)/intake            Step 1: Dynamic intake flow (Client)
/(wizard)/skills            Step 2: Skills assessment grid (Client)
/(wizard)/pathways          Step 3: Career map (Client)
/error                      Global error fallback (Client)
```

`(wizard)` is a Next.js route group — it provides a shared layout wrapper without adding a URL segment. The wizard layout hosts the `TopBar`, `Stepper`, and `StepLayout` framing that wraps all four steps.

**RSC vs Client split:**
- `layout.tsx` and `page.tsx` for Landing are Server Components — they load fonts, set metadata, and render static content without client JS weight.
- All three wizard pages are `'use client'` — they need Zustand reads, TanStack Query mutations, and event handlers on every interaction.

### Route Guards

`useRequireStep(step)` runs at the top of each wizard page component:

| Page | Guard condition |
|------|----------------|
| `/skills` | `intakeAnswers.length > 0` |
| `/pathways` | `confirmedSkillIds.length > 0` |

If the condition fails (user lands directly via URL), the hook redirects to `/intake`. No wrapper component needed — the hook pattern keeps guard logic co-located with the page it protects.

### Component Folder Structure

```
src/
├── app/
│   ├── layout.tsx               # RSC: fonts, metadata, CSS vars
│   ├── page.tsx                 # RSC: Landing page
│   ├── error.tsx                # Client: global error boundary page
│   ├── not-found.tsx            # Client: 404 fallback
│   └── (wizard)/
│       ├── layout.tsx           # RSC: TopBar + Stepper wrapper
│       ├── intake/page.tsx      # Client: Step 1
│       ├── skills/page.tsx      # Client: Step 2
│       └── pathways/page.tsx    # Client: Step 3
│
├── components/
│   ├── shared/
│   │   ├── BrandMark.tsx        # PathLogo SVG + logo.png wrapper
│   │   ├── TopBar.tsx           # Header bar with brand + step indicator
│   │   ├── StepLayout.tsx       # Page wrapper: header slot, body, sticky footer
│   │   ├── PillButton.tsx       # Primary interactive unit (answer selection, skill toggle)
│   │   ├── Tag.tsx              # Read-only label (WIOA eligible, evening classes)
│   │   ├── LoadingState.tsx     # Skeleton layouts for AI wait states
│   │   └── ErrorBoundary.tsx    # Class component: catches render errors
│   ├── intake/
│   │   ├── IntakePage.tsx       # Page container: orchestrates question flow
│   │   ├── QuestionCard.tsx     # One question + pill option set
│   │   └── ProgressBar.tsx      # Visual step indicator (question N of M)
│   ├── skills/
│   │   ├── SkillsGrid.tsx       # Toggleable skill chip grid
│   │   └── SkillsRationale.tsx  # AI explanation banner
│   ├── pathways/
│   │   ├── PathwayCard.tsx      # Single pathway: title, wage, ladder, tags, why
│   │   ├── CareerLadder.tsx     # Horizontal step chain (CNA → LPN → RN)
│   │   └── LimitationsPanel.tsx # Always-present constraint summary above cards
│
├── hooks/
│   ├── useAnalytics.ts          # Event logger → POST /analytics/event
│   ├── useRequireStep.ts        # Route guard
│   ├── useIntakeFlow.ts         # Seed fetch + followup loop orchestration
│   ├── useSkillsAssessment.ts   # Skills infer call + toggle state
│   └── usePathways.ts           # Pathway recommend call
│
├── lib/
│   ├── api/
│   │   ├── client.ts            # Axios instance + AppError interceptor
│   │   └── endpoints.ts         # All typed API functions (no raw fetch/axios elsewhere)
│   ├── store/
│   │   └── session.ts           # Zustand store — entire wizard session
│   └── types/
│       ├── intake.ts
│       ├── skills.ts
│       └── pathways.ts
│
└── styles/
    └── globals.css              # Tailwind base + CSS custom properties (design tokens)
```

**Folder rationale:** Features are co-located by wizard step, not by atomic component type. This means you can read, modify, or delete a feature by looking in one place. `components/shared/` holds only what is genuinely reused across two or more features.

### State Architecture

**Zustand session store** — owns the wizard's in-progress data. Reset on session end.

```ts
interface SessionState {
  sessionId: string;

  // Step 1 — Intake
  intakeAnswers: IntakeAnswer[];
  currentQuestion: Question | null;

  // Step 2 — Skills
  inferredSkills: Skill[];
  confirmedSkillIds: string[];

  // Step 3 — Pathways
  pathways: Pathway[];
  limitations: Limitations | null;

  // Actions
  setIntakeAnswers: (answers: IntakeAnswer[]) => void;
  setCurrentQuestion: (q: Question | null) => void;
  setSkills: (skills: Skill[]) => void;
  setConfirmedSkillIds: (ids: string[]) => void;
  setPathways: (pathways: Pathway[], limitations: Limitations) => void;
  reset: () => void;
}
```

**TanStack Query** — manages all server state (loading, error, retry). Feature hooks use `useQuery` and `useMutation`; they write resolved data into the Zustand store. The store never fetches; TanStack Query never persists between steps.

| Query Key | Endpoint | Triggered By |
|-----------|----------|--------------|
| `['questions', 'seed']` | `GET /intake/questions` | Mount of IntakePage |
| `['questions', 'followup', answers]` | `POST /intake/followup` | 7th seed answer submission (fires once) |
| `['skills', answersHash]` | `POST /skills/infer` | Mount of SkillsPage (with answers) |
| `['pathways', skillsHash]` | `POST /pathways/recommend` | Mount of PathwaysPage (with skills) |

### API Layer

All backend calls are typed functions in `lib/api/endpoints.ts`. No raw `fetch` or `axios` calls appear anywhere else in the codebase.

```ts
fetchSeedQuestions(): Promise<Question[]>
fetchFollowupQuestions(answers: IntakeAnswer[]): Promise<FollowupResponse>
inferSkills(answers: IntakeAnswer[]): Promise<SkillsResponse>
recommendPathways(payload: PathwayRequest): Promise<PathwayResponse>
logEvent(event: AnalyticsEvent): Promise<void>
```

**Error normalization** — the Axios interceptor in `lib/api/client.ts` converts all API errors into `AppError`:

```ts
interface AppError {
  code: 'network' | 'timeout' | 'ai_error' | 'validation' | 'unknown';
  message: string;   // user-facing plain English
  retryable: boolean;
}
```

TanStack Query's `onError` callbacks surface these to the UI. Retryable errors show a retry button inline. Non-retryable errors call `router.push('/error')`.

### Loading & Empty States

Every AI step has three states the UI must handle:

| State | Behavior |
|-------|---------|
| **Loading** | Skeleton of the expected layout (`aria-busy="true"` on container). Never just a spinner — layout must not jump when data arrives. |
| **Error** | Inline error with retry (if `retryable: true`) or redirect to `/error` (if not). |
| **Empty** | Treated as an error — logged to analytics, redirected to `/error`. An empty skills or pathways response is a backend bug, not a user-facing edge case. |

AI wait times are expected at 2–8 seconds. Skeleton states must be substantive.

### Feature Specifications

#### Intake (Step 1)

1. On mount, `useIntakeFlow` fetches the 7 seed questions from `GET /intake/questions`.
2. Questions render one at a time inside `QuestionCard`. All answer options are `PillButton` — no text input at any point.
3. Each answer appends to `intakeAnswers`. After the 7th seed answer, `POST /intake/followup` fires once with all 7 answers.
4. The backend returns `FollowupResponse { questions: FollowupQuestion[] }` — a batch of 3 follow-up questions, each with its own answer choices. The frontend presents them sequentially; no additional API calls are made per follow-up answer.
5. After all 3 follow-ups are answered (10 total), navigate to `/skills`.
6. While awaiting the follow-up batch, pill buttons are replaced with a skeleton row. The `QuestionCard` frame stays visible so layout does not shift.

The AI generates all 3 follow-ups in one call after the 7 seed answers. The frontend never fires a per-answer followup request.

#### Skills Assessment (Step 2)

1. On mount, `useSkillsAssessment` calls `POST /skills/infer` with the full `intakeAnswers` array.
2. Response includes a `Skill[]` and a `rationale` string rendered in `SkillsRationale`.
3. `SkillsGrid` renders all inferred skills as `PillButton` toggles, pre-selected by default.
4. The user deselects skills that do not apply. On Continue, `confirmedSkillIds` is written to the store.

This is a confirmation step, not an input step. Skills originate from the AI; the user only removes false positives.

#### Career Map (Step 3)

1. On mount, `usePathways` calls `POST /pathways/recommend` with `confirmedSkillIds` and `intakeAnswers`.
2. Response includes a `limitations: Limitations` object and a ranked `Pathway[]` (best fit first).
3. `LimitationsPanel` renders above the pathway cards unconditionally. It is a product requirement, not optional UI. The AI-generated constraints text must appear verbatim — do not paraphrase or hide behind a toggle.
4. Each `PathwayCard` shows: role title, wage range, `CareerLadder` progression, and `Tag` labels.
5. No card is selectable. The user reads; the wizard ends here.

---

## 6. Backend Architecture

### Route Structure

```
GET  /health                    Liveness check
GET  /intake/questions          Return seed questions array
POST /intake/followup           Submit 7 answers → return 3 follow-up questions with choices
POST /skills/infer              Submit 10 answers → return inferred skills
POST /pathways/recommend        Submit skills + answers → return ranked pathways
POST /analytics/event           Log event (204 no content)
```

### Middleware Stack (order matters)

```
cors()              → restrict to NEXT_PUBLIC origin in prod
express.json()      → parse request body
requestLogger       → structured log: method, path, duration, status
routes              → feature routers
errorMiddleware     → catch ApiError + unhandled, return { error: { code, message } }
```

### Services Layer

`src/services/` contains four modules called by routes. They never import from routes — no circular dependency.

| Module | Responsibility |
|--------|---------------|
| `llm.ts` | Abstracts the chat LLM provider. Accepts typed prompt payloads, returns typed responses, handles `ai_error` normalization. Provider is selected at startup via `LLM_PROVIDER`; all callers are provider-agnostic. |
| `embeddings.ts` | Calls Python `embed.py` via HTTP. Accepts a text string, returns `number[1536]`. |
| `rag.ts` | Queries Supabase pgvector via the JS SDK. Accepts a query vector and top-k, issues a cosine similarity search, returns ranked skill/pathway matches with scores. |
| `db.ts` | Supabase JS SDK client. Handles seed question reads (`questions`, `question_choices`). |

`embed.py` is called over HTTP so it can be scaled and restarted independently. The Express process does not load Python.

### Backend Types

```
src/types/
├── intake.ts        # Mirror of frontend types (source of truth is shared contract)
├── skills.ts
└── pathways.ts
```

Zod schemas in each route validate incoming request bodies against these types before any service call. Invalid input returns 400 before reaching LLM calls.

---

## 7. Python Services Architecture

### Module Structure

```
services/
├── embeddings/
│   ├── __init__.py
│   └── embed.py        # embed_text(text) → list[float]
│                       # embed_batch(texts) → list[list[float]]
│
├── rag/
│   ├── __init__.py
│   └── indexer.py      # build_index(source_dir) → None  [offline batch job]
│
├── requirements.txt
└── .env.example
```

`retriever.py` is not present — retrieval is handled by `rag.ts` in Express via a direct Supabase pgvector query.

### RAG Indexer (offline batch job)

`rag/indexer.py` is not on the request path. It runs once (and is re-run when the skills corpus is updated) to embed source data and upsert into Supabase pgvector.

```
source data (CSV, PDF, Excel) → embed_batch() → Supabase UPSERT
  skill_embeddings(skill_id, skill_text, embedding vector(1536), metadata JSONB)
```

Uses `supabase-py` for the upsert. For MVP corpus (< 1000 entries), no index tuning is needed — pgvector's default scan is adequate. If corpus grows past ~100k entries, add an HNSW index on the `embedding` column.

### Vector Retrieval (request path — Express, not Python)

Retrieval runs inside Express via `rag.ts` using the Supabase JS SDK. No Python service call on the retrieval path. The query:

```sql
SELECT skill_id, skill_text, metadata,
  1 - (embedding <=> $1::vector) AS similarity
FROM skill_embeddings
ORDER BY embedding <=> $1::vector
LIMIT $2;
```

Express calls `embeddings.ts` → Python `embed.py` first (step [13]–[14]) to get the query vector, then issues the pgvector query directly (step [15]–[16]).

### Embeddings

`embeddings/embed.py` wraps the OpenAI embeddings API. Both the indexer (offline) and the Express service (online, via HTTP) use this module. Single call site for the embedding model means one place to swap models.

---

## 8. Analytics

Analytics events fire through `useAnalytics` → `POST /analytics/event`. No third-party SDK.

| Event | Triggered By |
|-------|-------------|
| `intake_step_view` | Each question rendered |
| `intake_step_complete` | Each answer submitted |
| `intake_abandoned` | Page unload mid-intake |
| `skills_confirmed` | "Continue" click on skills screen |
| `pathways_viewed` | Career map renders |

Every event payload includes `sessionId` (random UUID, not tied to any identity) and `timestamp`. No PII in any event.

---

## 9. Accessibility

Target: **WCAG 2.1 AA**

| Requirement | Implementation |
|-------------|---------------|
| All interactive elements keyboard-navigable | `PillButton` and toggles use `<button>` elements — no div-click hacks |
| Screen reader state for toggles | `aria-pressed` on PillButton; `aria-selected` on skill chips |
| AI loading regions | `aria-live="polite"` on loading containers; `aria-busy="true"` on skeletons |
| Color contrast | Tailwind config enforces design token palette; sage (#CE6A49) on paper (#F5F0EB) at body text size passes 4.5:1 |
| No keyboard traps | Focus management handled natively via button elements |
| Plain language | Copy targets 6th-grade reading level |
| Mobile minimum | Layouts tested at 375px; responsive breakpoints at 480px and 900px |
| No time limits | No auto-advancing steps or session timeouts |

---

## 10. Environment Configuration

### Frontend (`.env.local`)

```
NEXT_PUBLIC_API_BASE_URL        Express backend base URL
NEXT_PUBLIC_ANALYTICS_ENABLED   true | false (disable locally)
NEXT_PUBLIC_ENV                 development | staging | production
```

All environment variables are `NEXT_PUBLIC_` prefixed and build-time only. No secrets in the browser bundle.

### Backend (`.env`)

```
PORT                    4000
OPENAI_API_KEY
LLM_PROVIDER            prod | dev
LLM_MODEL               gpt-5.4 | gpt-oss
OPENAI_EMBEDDING_MODEL  text-embedding-3-small
PYTHON_SERVICES_URL     http://localhost:8000
SUPABASE_URL            https://<project>.supabase.co
SUPABASE_SERVICE_KEY    <service_role_key>
CORS_ORIGIN             http://localhost:3000
```

### Python Services (`.env`)

```
OPENAI_API_KEY
OPENAI_EMBEDDING_MODEL  text-embedding-3-small
SUPABASE_URL            https://<project>.supabase.co
SUPABASE_SERVICE_KEY    <service_role_key>
SKILLS_DATA_PATH        ./data/**
```

---

## 11. Observability

### Backend

| Layer | Implementation |
|-------|---------------|
| **Request logging** | `requestLogger` middleware emits structured JSON per request: method, path, duration, status code. |
| **Error logging** | `errorMiddleware` logs unhandled exceptions with stack traces before returning normalized `{ error }` responses. |
| **LLM call logging** | `llm.ts` logs prompt token counts and response latency per call — necessary for cost monitoring given variable AI response times. |
| **Metrics** | Key latency and counter fields are emitted as structured log entries per endpoint. Can be forwarded to a metrics collector without code changes when volume warrants it. |
| **APM** | Azure Application Insights SDK in Express captures request traces, downstream dependencies (OpenAI, Python services), and exceptions in a single correlated trace. |

### Python Services

`embed.py` emits structured logs per request: embed duration and token count. `indexer.py` logs per upsert batch: batch size, embed duration, upsert duration. These flow into Application Insights via the Python SDK on the same `sessionId` trace (embed) or a batch job trace ID (indexer).

### Frontend

Frontend observability is covered by the analytics event layer (Section 8). Browser render errors are caught by `ErrorBoundary`, logged to `POST /analytics/event` with `code: 'render_error'`, and the user is routed to `/error`.

### Trace Continuity

The `sessionId` UUID generated client-side flows through every analytics event and every Express request as the `X-Session-Id` header. This allows a single user session to be correlated across frontend events, Express logs, Python service logs, and Application Insights — without storing any PII.

---

## 12. Security Practices

### Input Validation

| Concern | Practice |
|---------|---------|
| **Request body validation** | Every Express route validates its body against a Zod schema before any service call. Invalid input returns `400` — no LLM call is made, no DB query runs. |
| **Pill-only user input** | All user-supplied data is constrained choice selections, not free text. This eliminates the primary prompt injection surface at the product layer. |
| **LLM output parsing** | Responses from the LLM are parsed against typed interfaces before being forwarded to the browser. Raw LLM output never reaches the client. |

### Secrets and Environment

| Concern | Practice |
|---------|---------|
| **`OPENAI_API_KEY`** | Backend `.env` only. Never referenced in Next.js code or any `NEXT_PUBLIC_` variable. |
| **`SUPABASE_SERVICE_KEY`** | Backend `.env` and Python `.env` only. The service role key bypasses Supabase RLS — it must never be exposed to the browser or logged. |
| **`SUPABASE_URL`** | Not a secret but still server-side only — the anon key pattern is not used since all Supabase access is from Express or the offline indexer, not the browser. |
| **Frontend env** | All `NEXT_PUBLIC_` vars are non-secret (API base URL, analytics toggle, env flag). No key of any kind appears in the browser bundle. |

### Network

| Concern | Practice |
|---------|---------|
| **CORS** | Express `cors()` restricts `Access-Control-Allow-Origin` to `CORS_ORIGIN` (the Next.js origin) in production. Wildcard CORS is never used. |
| **Python service isolation** | `embed.py` is not publicly routable. It listens on `PYTHON_SERVICES_URL` (default `localhost:8000`) — accessible only from the Express process. No ingress rule exposes it. |
| **Express → Python auth** | Express attaches a shared `X-Internal-Token` header on every call to the Python embed service. The Python service rejects requests missing this header. |

### HTTP Security Headers

**Express** — `helmet()` middleware is applied before all routes:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS) in production
- `Content-Security-Policy` scoped to deny inline scripts

**Next.js** — `next.config.js` `headers()` adds equivalent headers to all page and API responses. CSP is set to disallow `<script>` injection and restrict `connect-src` to the Express origin.

### Rate Limiting

No authentication means rate limiting is the primary abuse control for AI endpoints.

| Endpoint group | Limit | Library |
|----------------|-------|---------|
| `POST /intake/followup` | 10 req / IP / 5 min | `express-rate-limit` |
| `POST /skills/infer` | 10 req / IP / 5 min | `express-rate-limit` |
| `POST /pathways/recommend` | 10 req / IP / 5 min | `express-rate-limit` |
| `GET /intake/questions` | 60 req / IP / min | `express-rate-limit` |

Rate limit headers (`RateLimit-*`) are returned to the client. Exceeded limits return `429` with a retryable `AppError`.

### Supabase Access

| Concern | Practice |
|---------|---------|
| **Parameterized queries** | All Supabase JS SDK calls use the SDK's query builder — no raw SQL string concatenation. The pgvector similarity query uses `$1::vector` parameterized binding. |
| **Service key scope** | `db.ts` only reads `questions` and `question_choices`. `rag.ts` only reads `skill_embeddings`. No Express route writes to Supabase. Write access exists only in `indexer.py` (offline). |
| **No client-side Supabase** | The Supabase JS SDK is never imported in frontend code. The browser has no Supabase credentials and cannot query Supabase directly. |

### Error Handling

| Concern | Practice |
|---------|---------|
| **No stack trace leakage** | `errorMiddleware` returns `{ error: { code, message } }` only. Stack traces are logged server-side (Section 11) but never included in responses. |
| **No system prompt leakage** | LLM service errors return `ai_error` code with a generic user-facing message. System prompt content and LLM raw error details are logged internally only. |
| **OpenAI error normalization** | `llm.ts` catches all OpenAI SDK exceptions and maps them to typed `AppError` before propagation. Callers never receive raw OpenAI error objects. |

### Dependency Hygiene

- `package-lock.json` and `requirements.txt` are committed with pinned versions. Floating ranges (`^`, `~`) are resolved and locked at install time.
- `npm audit` and `pip-audit` run in CI. Builds fail on high-severity findings.
- The OpenAI SDK, Supabase SDK, and Zod are the highest-risk dependencies given their API surface. Pin to minor version, review changelogs before upgrading.

---

## 13. What This Architecture Excludes

Per the project charter, the following must not be built or architected for in MVP:

- Authentication, user accounts, sessions with identity
- Resume or file upload
- Voice or chat input
- Direct browser → OpenAI calls
- Case manager views or admin interfaces
- Live job board integrations (Indeed, ZipRecruiter)
- ETPL (Eligible Training Provider List) live queries
- Eligibility screening flows (WIOA, background checks)
- Automation risk scoring
- AI-generated action plan (plan building)
- PDF export or download of any kind
