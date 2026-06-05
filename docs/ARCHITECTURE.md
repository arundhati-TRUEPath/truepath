# TruePath — Architecture

| Field | Value |
|-------|-------|
| **Status** | MVP — Active |
| **Date** | June 2026 |
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
| AI / ML services | **Python 3.10 (embeddings + RAG)** | Python owns tiktoken and the OpenAI embeddings SDK. `embed.py` is called by Express via HTTP for request-time embedding. `indexer.py` runs offline to upsert vectors into Azure PostgreSQL. `retriever.py` is called by Express via HTTP on every `/pathways/recommend` request to run the pgvector cosine similarity search. Keeps the embedding and retrieval pipeline in the ecosystem best suited for it without polluting the Node.js process. |
| Database | **Azure Database for PostgreSQL Flexible Server + pgvector** | Single platform for relational data (seed questions + choices, session rows) and vector search (RAG chunk embeddings via pgvector). Server: `truepath-db.postgres.database.azure.com`, PostgreSQL 16, Standard_B2ms, region: `northcentralus`. pgvector extension enabled with HNSW index on `rag_chunks.embedding`. All connections use TLS (`sslmode=require`). `pg.Pool` (Node.js) and `psycopg2` (Python) are the client drivers. |
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
│  Services: llm.ts · rag.ts  ·  Data: db/client.ts (pg.Pool)         │
└──────┬──────────────────────┬──────────────────────┬─────────────────┘
       │  OpenAI (chat)       │  HTTP /search        │  pg.Pool (TLS)
       ▼                      ▼                      ▼
┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────────┐
│  OpenAI API      │  │  Python Services  │  │  Azure PostgreSQL             │
│  ──────────────  │  │  embed.py         │  │  truepath-db · PG 16         │
│  gpt-4o          │  │  retriever.py     │  │  ─ questions · session_*     │
│  gpt-4.1-mini    │  │  indexer.py       │  │  pgvector (HNSW)             │
│  embedding-3-sm  │  │  (offline batch)  │  │  ─ rag_documents · rag_chunks│
└──────────────────┘  └───────────────────┘  └──────────────────────────────┘

Offline (batch job, not on request path):
  rag/indexer.py → reads source data → embed_batch() → UPSERT into Azure PostgreSQL pgvector
```

### Layers

**Frontend (Next.js)** — drives the wizard UI, manages session state, renders AI responses. Never calls OpenAI directly.

**Backend (Express)** — central orchestrator. Validates all input, calls OpenAI for generation, calls Python services for embeddings and retrieval, assembles responses.

**Python Services** — owns the embedding and RAG retrieval pipeline. Two sub-modules:
- `embeddings/` — wraps OpenAI embeddings API; called by Express via HTTP at request time (`embed_text`) and by the indexer offline (`embed_batch`)
- `rag/` — `indexer.py` is an offline batch job that embeds source data and upserts into Azure PostgreSQL pgvector; `retriever.py` is called by Express via HTTP on every `/pathways/recommend` request to run the `match_rag_chunks` cosine similarity function

**Azure Database for PostgreSQL** — single persistence platform. Four logical concerns:
- `questions` + `question_choices` tables — seed question corpus; read by `/intake/questions`
- `sessions` + `session_responses` tables — session lifecycle and intake answer storage
- `session_skills` + `session_pathways` tables — skills and pathway results per session
- `rag_documents` + `rag_chunks` tables — RAG corpus with 1536-dim embeddings (pgvector HNSW index); queried via `match_rag_chunks` stored function on every `/pathways/recommend` request

---

## 4. Request Flow

```
[1]  Browser → Express          GET /intake/questions
[2]  Express → Azure PostgreSQL  SELECT questions + choices ORDER BY display_order
[3]  Express → Browser          Return Question[]

[4]  Browser → Express          POST /intake/followup  { answers: IntakeAnswer[] (7 total) }
[5]  Express → Azure PostgreSQL  INSERT session_responses (7 rows); UPDATE sessions.status
[6]  Express → LLM              System prompt + 7 Q+R → generate 3 follow-up questions with choices
[7]  LLM → Express              FollowupResponse { questions: FollowupQuestion[] }  ← batch of 3
[8]  Express → Azure PostgreSQL  INSERT followup questions + choices
[9]  Express → Browser          FollowupResponse

[10] Browser → Express          POST /skills/infer  { sessionId }
[11] Express → LLM              System prompt + all 10 Q+R → generate skill candidates
[12] LLM → Express              6 high-confidence + 3 low-confidence Skill[]
[13] Express → Azure PostgreSQL  INSERT session_skills; UPDATE sessions.status
[14] Express → Browser          SkillsResponse { skills, rationale }

[15] Browser → Express          POST /pathways/recommend  { sessionId }
[16] Express → Python /search   { query, top_k: 50, threshold: 0 }
[17] Python → Azure PostgreSQL  SELECT match_rag_chunks(embedding, threshold, top_k) — cosine similarity
[18] Azure PostgreSQL → Python  top-k rag_chunks with similarity scores
[19] Python → Express           RagChunk[] with similarity scores
[20] Express → LLM              top PDF pathway docs + supporting table rows + system prompt
[21] LLM → Express              Pathway[] + limitationsSummary
[22] Express → Azure PostgreSQL  INSERT session_pathways (JSONB); UPDATE sessions.status
[23] Express → Browser          PathwayResponse

```

**Two-stage LLM design rationale:** Generation (steps 6, 11, 20) uses the chat model for open-ended reasoning. Embedding and retrieval (steps 16–19) run inside the Python service, which calls OpenAI embeddings then queries Azure PostgreSQL via `match_rag_chunks` (a stored SQL function using pgvector HNSW cosine similarity). These are different tasks with different execution surfaces — separating them keeps prompts clean and allows independent model upgrades.

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
| `llm.ts` | Abstracts the chat LLM provider. Accepts typed prompt payloads, returns typed responses, handles `ai_error` normalization. |
| `rag.ts` | Calls Python `/search` via HTTP. Accepts a query string, delegates embedding + pgvector similarity search to the Python service, returns `RagChunk[]` with similarity scores. |
| `pathways.ts` | Orchestrates the pathway recommendation flow: builds a search query from session QA + confirmed skills, calls `rag.ts`, selects top PDF documents, builds LLM context, calls OpenAI, validates response. |

`rag.ts` calls the Python service over HTTP so embedding and retrieval can be scaled and restarted independently. The Express process does not load Python or any ML library.

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
│   ├── indexer.py      # build_index(source_dir) → dict  [offline batch job]
│   └── retriever.py    # retrieve(query, top_k, threshold) → list[dict]
│
├── main.py             # FastAPI app — /health · /embed · /search · /ingest
├── run_indexer.py      # CLI entrypoint for the offline indexer
├── requirements.txt
└── .env.example
```

### RAG Indexer (offline batch job)

`rag/indexer.py` is not on the request path. It runs once (and is re-run when the RAG corpus is updated) to embed source data and upsert into Azure PostgreSQL pgvector.

```
source data (PDF, Excel) → embed_batch() → Azure PostgreSQL UPSERT
  rag_documents(file_name, file_type, source_path, chunk_count)
  rag_chunks(document_id, chunk_index, content, embedding vector(1536), metadata JSONB)
```

Uses `psycopg2` with `register_vector` for pgvector type support. After initial indexing, run `008_hnsw_index.sql` to build the HNSW index (`m=16, ef_construction=64`) for fast approximate nearest-neighbour search.

### Vector Retrieval (request path — Python service)

Retrieval runs inside `rag/retriever.py`, called by Express via HTTP POST `/search`. The stored function:

```sql
SELECT rc.id, rc.document_id, rc.chunk_index, rc.content, rc.metadata,
       rd.file_name,
       1 - (rc.embedding <=> query_embedding) AS similarity
FROM rag_chunks rc
JOIN rag_documents rd ON rd.id = rc.document_id
WHERE 1 - (rc.embedding <=> query_embedding) >= match_threshold
ORDER BY rc.embedding <=> query_embedding
LIMIT match_count;
```

Express calls `rag.ts` → Python `/search` (step [16]) which embeds the query and runs `match_rag_chunks` in Azure PostgreSQL (steps [17]–[18]).

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
OPENAI_MODEL            gpt-4o
OPENAI_FOLLOWUP_MODEL   gpt-4.1-mini
OPENAI_EMBEDDING_MODEL  text-embedding-3-small
PYTHON_SERVICES_URL     http://localhost:8000
DATABASE_URL            postgresql://<user>:<pass>@truepath-db.postgres.database.azure.com:5432/postgres?sslmode=require
CORS_ORIGIN             http://localhost:3000
```

### Python Services (`.env`)

```
PORT                    4000
OPENAI_API_KEY
OPENAI_MODEL            gpt-4o
OPENAI_FOLLOWUP_MODEL   gpt-4.1-mini
OPENAI_EMBEDDING_MODEL  text-embedding-3-small
DATABASE_URL            postgresql://<user>:<pass>@truepath-db.postgres.database.azure.com:5432/postgres?sslmode=require
PYTHON_SERVICES_URL     http://localhost:8000
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
| **`DATABASE_URL`** | Backend `.env` and Python `.env` only. Contains credentials for Azure PostgreSQL — must never be logged or exposed to the browser. Stored in Azure Key Vault (`DATABASE-URL`) for staging/production deployments; injected via Container Apps secret reference. |
| **Frontend env** | All `NEXT_PUBLIC_` vars are non-secret (API base URL, analytics toggle, env flag). No key of any kind appears in the browser bundle. |

### Network

| Concern | Practice |
|---------|---------|
| **CORS** | Express `cors()` restricts `Access-Control-Allow-Origin` to `CORS_ORIGIN` (the Next.js origin) in production. Wildcard CORS is never used. |
| **Python service isolation** | The Python service is not publicly routable. It listens on `PYTHON_SERVICES_URL` (default `localhost:8000`) — accessible only from the Express process. No ingress rule exposes it. |
| **Azure PostgreSQL TLS** | All connections use `sslmode=require` (Node `pg.Pool`: `ssl: { rejectUnauthorized: true }`; Python psycopg2: connection string param). Azure PostgreSQL uses a public CA certificate — no self-signed cert handling needed. |

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

### Database Access

| Concern | Practice |
|---------|---------|
| **Parameterized queries** | All queries use `pg.Pool` parameterized binding (`$1`, `$2`, …) in Node.js and psycopg2 `%s` placeholders in Python. No raw SQL string concatenation anywhere. |
| **Repository pattern** | Express routes never issue SQL directly — all DB access goes through `src/repositories/`. Each repository owns one table domain. |
| **No client-side DB** | The browser has no database credentials and cannot connect to Azure PostgreSQL. All queries originate from Express or the Python service (server-side only). |

### Error Handling

| Concern | Practice |
|---------|---------|
| **No stack trace leakage** | `errorMiddleware` returns `{ error: { code, message } }` only. Stack traces are logged server-side (Section 11) but never included in responses. |
| **No system prompt leakage** | LLM service errors return `ai_error` code with a generic user-facing message. System prompt content and LLM raw error details are logged internally only. |
| **OpenAI error normalization** | `llm.ts` catches all OpenAI SDK exceptions and maps them to typed `AppError` before propagation. Callers never receive raw OpenAI error objects. |

### Dependency Hygiene

- `package-lock.json` and `requirements.txt` are committed with pinned versions. Floating ranges (`^`, `~`) are resolved and locked at install time.
- `npm audit` and `pip-audit` run in CI. Builds fail on high-severity findings.
- The OpenAI SDK, `pg`, `psycopg2-binary`, `pgvector`, and Zod are the highest-risk dependencies given their API surface. Pin to minor version, review changelogs before upgrading.

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
