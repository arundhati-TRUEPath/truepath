# TRUE Path Navigator — Frontend Architecture

---

| Field | Value |
|-------|-------|
| **Document Type** | Frontend Architecture Specification |
| **Version** | 1.0 |
| **Date** | May 2026 |
| **Status** | MVP |
| **Scope** | React + Vite + Tailwind — UI layer only |

---

## 1. Guiding Constraints

Before any architectural decision, these constraints from the charter are non-negotiable:

- **No login, no accounts.** Sessions are stateless. No PII is stored anywhere on the client.
- **No free-text input.** All user interaction is pill/button selection.
- **No direct LLM calls from the browser.** All AI requests go through the FastAPI backend.
- **Inclusive by default.** The UI must serve ESL users, low-literacy users, and mobile users without degradation.
- **Out-of-scope items are not architectured here:** no case manager dashboard, no resume upload, no job postings, no eligibility screening, no voice/chat input.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18 | Component model fits wizard/step flow; large ecosystem |
| Build Tool | Vite | Fast HMR, minimal config, native ESM |
| Styling | Tailwind CSS v3 | Utility-first; enforces design consistency; no CSS-in-JS overhead |
| Routing | React Router v6 | Declarative routes; nested layouts; clean wizard navigation |
| Server State | TanStack Query v5 | Caching, loading states, retry logic for all backend calls |
| Client State | Zustand | Lightweight session store; no boilerplate; easy to wipe on session end |
| HTTP Client | Axios | Interceptors for error normalization; typed responses |
| PDF Trigger | Browser `fetch` → blob download | Backend generates PDF; frontend streams download |
| Analytics | Custom hook wrapping `fetch` | Thin event logger; no third-party SDK dependency in MVP |
| Accessibility | Radix UI primitives | Headless, ARIA-compliant base for interactive components |
| Type Safety | TypeScript (strict) | All props, API responses, and state shapes are typed |

---

## 3. Application Flow

The entire user experience is a **linear, four-step wizard.** There is no branching navigation, no back-to-dashboard, no saved state between visits.

```
Landing
   │
   ▼
[Step 1] Intake
   │  ← 6 static seed questions pulled from backend
   │  ← AI generates contextual follow-up questions after each answer
   ▼
[Step 2] Skills Assessment
   │  ← AI infers transferable skills from intake answers
   │  ← User confirms or deselects from a grid
   ▼
[Step 3] Career Map
   │  ← 3 ranked pathway cards + Limitations Panel
   ▼
[Step 4] Plan (PDF)
        ← AI-generated action plan; download / print / email
```

Each step is a discrete route. The user can move forward only; backward navigation is disabled to prevent session state inconsistency.

---

## 4. Route Structure

```
/                     → Landing / entry point
/intake               → Step 1: Dynamic intake flow
/skills               → Step 2: Skills assessment grid
/pathways             → Step 3: Career map + limitations panel
/plan                 → Step 4: PDF plan preview + download
/error                → Global error fallback
```

### Route Guards

- Steps 2–4 check that the prior step's data exists in the Zustand session store. If it does not (e.g., the user lands on `/skills` directly), they are redirected to `/intake`.
- This guard is a single `<RequireStep>` wrapper component applied to protected routes.

---

## 5. State Architecture

### Session Store (Zustand)

One store holds the entire wizard session. It is initialized empty on page load and is never persisted to `localStorage` or `sessionStorage`.

```ts
interface SessionStore {
  // Intake
  intakeAnswers: IntakeAnswer[];           // ordered list of Q&A pairs
  currentQuestion: Question | null;        // active question being displayed

  // Skills
  inferredSkills: Skill[];                 // AI-returned skills
  confirmedSkills: Skill[];                // user-confirmed subset

  // Pathways
  pathways: Pathway[];                     // 3 ranked pathway objects
  limitationsSummary: string;              // AI-generated plain-text constraints

  // Plan
  planReady: boolean;                      // true once PDF is available from backend

  // Actions
  submitAnswer: (answer: IntakeAnswer) => void;
  confirmSkills: (skills: Skill[]) => void;
  reset: () => void;                       // wipes entire session
}
```

### Server State (TanStack Query)

All data fetched from the backend is managed by TanStack Query. The session store holds only what the user has confirmed/selected — not raw API responses.

| Query Key | Endpoint | Triggered By |
|-----------|----------|--------------|
| `['questions', 'seed']` | `GET /intake/questions` | Landing on `/intake` |
| `['question', 'followup']` | `POST /intake/followup` | Each intake answer submission |
| `['skills']` | `POST /skills/infer` | Arriving at `/skills` with intake answers |
| `['pathways']` | `POST /pathways/recommend` | Arriving at `/pathways` with confirmed skills |
| `['plan', 'pdf']` | `POST /plan/generate` | User clicks "Generate My Plan" on `/plan` |

---

## 6. Component Architecture

### Folder Structure

```
src/
├── app/
│   ├── App.tsx                  # Root router + layout
│   ├── routes.tsx               # Route definitions + guards
│   └── providers.tsx            # QueryClient, store, theme providers
│
├── features/
│   ├── intake/
│   │   ├── IntakePage.tsx       # Step 1 page container
│   │   ├── QuestionCard.tsx     # Displays one question + pill options
│   │   ├── ProgressBar.tsx      # Visual step indicator
│   │   └── useIntakeFlow.ts     # Orchestrates question fetching + answer submission
│   │
│   ├── skills/
│   │   ├── SkillsPage.tsx       # Step 2 page container
│   │   ├── SkillsGrid.tsx       # Selectable skill chip grid
│   │   ├── SkillsRationale.tsx  # AI explanation banner
│   │   └── useSkillsAssessment.ts
│   │
│   ├── pathways/
│   │   ├── PathwaysPage.tsx     # Step 3 page container
│   │   ├── LimitationsPanel.tsx # Constraint summary above cards
│   │   ├── PathwayCard.tsx      # Single pathway card
│   │   ├── CareerLadder.tsx     # Role progression display (CNA→LPN→RN)
│   │   └── usePathways.ts
│   │
│   └── plan/
│       ├── PlanPage.tsx         # Step 4 page container
│       ├── PlanPreview.tsx      # Rendered plan summary (before download)
│       ├── DownloadButton.tsx   # Triggers PDF blob download
│       └── usePlanGeneration.ts
│
├── shared/
│   ├── components/
│   │   ├── PillButton.tsx       # Primary pill/tag interaction unit
│   │   ├── StepLayout.tsx       # Consistent step wrapper (header, progress, body)
│   │   ├── LoadingState.tsx     # Skeleton + spinner for AI wait states
│   │   ├── ErrorBoundary.tsx    # Catches render errors; routes to /error
│   │   └── Tag.tsx              # Read-only label (WIOA eligible, evening classes)
│   │
│   ├── hooks/
│   │   ├── useAnalytics.ts      # Event logging (drop-off, engagement time)
│   │   └── useRequireStep.ts    # Route guard hook
│   │
│   ├── api/
│   │   ├── client.ts            # Axios instance + interceptors
│   │   └── endpoints.ts         # Typed API function definitions
│   │
│   └── types/
│       ├── intake.ts
│       ├── skills.ts
│       ├── pathways.ts
│       └── plan.ts
│
└── styles/
    └── globals.css              # Tailwind base + any global overrides
```

---

## 7. Feature Specifications

### 7.1 Intake (Step 1)

**Behavior:**
1. On mount, `useIntakeFlow` fetches the 6 seed questions from `GET /intake/questions`.
2. Questions are displayed one at a time inside `QuestionCard`.
3. Each question renders its answer options as `PillButton` components. No text input.
4. On selection, the answer is appended to `intakeAnswers` in the store, and `POST /intake/followup` is called with the full answer history.
5. The backend returns either a follow-up question or `{ done: true }`.
6. If `done: true`, the user is navigated to `/skills`.

**Loading state:** While waiting for a follow-up question, the pill buttons are replaced with a skeleton row. The question card remains visible so the layout does not jump.

**Key constraint:** The AI drives the question sequence. The frontend never hard-codes question order beyond the 6 seed questions.

---

### 7.2 Skills Assessment (Step 2)

**Behavior:**
1. On mount, `useSkillsAssessment` calls `POST /skills/infer` with the full `intakeAnswers` array.
2. The response returns a list of `Skill` objects with a `rationale` string.
3. `SkillsRationale` displays the AI's explanation (e.g., *"Based on your caregiving background, we've highlighted these skills"*).
4. `SkillsGrid` renders each skill as a toggleable `PillButton` — all pre-selected by default.
5. The user deselects skills that do not apply.
6. On "Continue", `confirmedSkills` is written to the store and the user navigates to `/pathways`.

**Key constraint:** The grid is a confirmation step, not an input step. Skills come from the AI; the user only removes false positives.

---

### 7.3 Career Map (Step 3)

**Behavior:**
1. On mount, `usePathways` calls `POST /pathways/recommend` with `confirmedSkills` and `intakeAnswers`.
2. Response includes `limitationsSummary` (plain text) and an array of 3 `Pathway` objects.
3. `LimitationsPanel` renders above the pathway cards. It is always present — never hidden even if there are no significant constraints.
4. Each `PathwayCard` displays:
   - Role title
   - Current wage range
   - `CareerLadder` component (start role → cert → target role, rendered as a horizontal step chain)
   - `Tag` components for relevant labels (evening classes, WIOA eligible, short-term training, etc.)
5. Cards are ordered by rank (best fit first).
6. No card is selectable. The user reads and then clicks "Build My Plan."

**`LimitationsPanel` design note:** This panel is a product requirement, not an optional UI element. It must render before the pathway cards and must use the AI-generated text verbatim — not paraphrased or hidden behind a toggle.

---

### 7.4 Plan / PDF (Step 4)

**Behavior:**
1. On mount, `usePlanGeneration` calls `POST /plan/generate` with the full session payload (answers, confirmed skills, selected pathway).
2. While the plan is generating, the page shows a loading state with a brief message (e.g., *"Building your personalized career plan…"*).
3. On success, `PlanPreview` renders a read-only summary of the plan content (not the PDF itself).
4. `DownloadButton` triggers a `fetch` to `GET /plan/pdf/{session_id}`, receives a blob, and initiates a browser download.
5. Print and email share are also offered as secondary actions.

**Footer requirement (enforced in PDF, echoed in preview):**
- Data source citation
- Disclaimer: *"Eligibility must be confirmed with a case manager"*
- CPS contact information

---

## 8. API Integration Layer

All backend calls are defined as typed functions in `src/shared/api/endpoints.ts`. Feature hooks import these functions directly — no raw `fetch` or `axios` calls outside this file.

```ts
// Pattern — all functions are async and return typed responses
export const fetchSeedQuestions  = (): Promise<Question[]>
export const fetchFollowupQuestion = (answers: IntakeAnswer[]): Promise<FollowupResponse>
export const inferSkills          = (answers: IntakeAnswer[]): Promise<SkillsResponse>
export const recommendPathways    = (payload: PathwayRequest): Promise<PathwayResponse>
export const generatePlan         = (payload: PlanRequest): Promise<PlanResponse>
export const downloadPdf          = (sessionId: string): Promise<Blob>
```

### Error Handling

The Axios instance in `client.ts` normalizes all API errors into a `AppError` shape:

```ts
interface AppError {
  code: 'network' | 'timeout' | 'ai_error' | 'validation' | 'unknown';
  message: string;   // user-facing plain English
  retryable: boolean;
}
```

TanStack Query's `onError` callbacks surface these to the UI. Retryable errors show a retry button. Non-retryable errors route to `/error`.

---

## 9. Analytics

A custom `useAnalytics` hook fires lightweight events to `POST /analytics/event` on the backend. No third-party SDK is used in the MVP.

| Event | Triggered By |
|-------|-------------|
| `intake_step_view` | Each question rendered |
| `intake_step_complete` | Each answer submitted |
| `intake_abandoned` | User closes/navigates away mid-intake |
| `skills_confirmed` | User clicks Continue on skills screen |
| `pathways_viewed` | Career map renders successfully |
| `pdf_downloaded` | Download button clicked |
| `session_duration` | Fired on unmount of the plan page |

Events carry a `session_id` (random UUID generated on first page load, not tied to any user identity) and a `timestamp`. No PII is included in any event payload.

---

## 10. Accessibility

Target: **WCAG 2.1 AA**

| Requirement | Implementation |
|-------------|---------------|
| No keyboard traps | Radix UI primitives handle focus management |
| All interactive elements keyboard-navigable | `PillButton` and toggles use native button elements |
| Sufficient color contrast | Tailwind config enforces 4.5:1 minimum for text |
| Screen reader labels | All pill buttons have `aria-pressed` state; all loading states have `aria-live` regions |
| Plain language | Copy is reviewed against a 6th-grade reading level in alpha |
| Mobile responsive | All layouts use Tailwind's responsive prefixes; tested at 375px minimum |
| No time limits | No auto-advancing steps or session timeouts |

---

## 11. Loading & Empty States

Every async step has three states the UI must handle:

| State | Behavior |
|-------|---------|
| **Loading** | Skeleton of the expected layout; `aria-busy="true"` on the container |
| **Error** | Inline error message with retry action (if retryable) or redirect to `/error` |
| **Empty** | Should not occur in normal flow; treated as an error and logged |

AI wait times (skills inference, pathway ranking, plan generation) are expected to be 2–8 seconds. Loading states must be substantive enough to reassure users — not just a spinner.

---

## 12. Environment & Configuration

```
VITE_API_BASE_URL         # FastAPI backend base URL
VITE_ANALYTICS_ENABLED    # true/false — disable in local dev
VITE_ENV                  # development | staging | production
```

All environment variables are prefixed `VITE_` and are build-time only. No secrets ever appear in the frontend bundle.

---

## 13. What This Architecture Does Not Include

The following are explicitly excluded per the project charter and must not be introduced during frontend development:

- Authentication, sessions, or user accounts
- Local storage or IndexedDB persistence of user data
- Resume or file upload components
- Voice input or chat interface
- Any direct calls to OpenAI or other AI providers from the browser
- Case manager views or admin interfaces
- Live job board integrations
- Eligibility screening flows
