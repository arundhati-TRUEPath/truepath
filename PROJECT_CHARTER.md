# Project Charter — TRUE Path Navigator

---

| Field          | Value                                      |
|----------------|--------------------------------------------|
| **Project Name** | TRUE Path Navigator                      |
| **Version**    | 1.0                                        |
| **Date**       | May 2026                                   |
| **Status**     | MVP Phase — Active                         |
| **Owner**      | Career Path Services |

---

## 1. Project Title & Tagline

# TRUE Path Navigator
**From where you are → to a healthcare career.**

---

## 2. Executive Summary

Healthcare is one of the most structurally clear industries for career advancement, yet entry into it remains opaque for the people who need it most. In King County, jobseekers — career changers, displaced workers, immigrants, and young adults — lack a personalized, accessible starting point. At the same time, case managers spend significant manual effort cross-referencing multiple sources to match individuals to viable pathways.

TRUE Path Navigator is an AI-powered career guidance tool that converts a jobseeker's background and constraints into a clear, personalized healthcare career roadmap — delivered in minutes, without requiring an account, a resume, or prior knowledge of the system. The MVP delivers a dynamic intake flow, AI-inferred skills assessment, three recommended career pathways, and a downloadable PDF action plan — all grounded in verified Washington State workforce data.

Washington State faces a projected shortage of over 19,000 nurses in the coming years. The opportunity is real, the pathways are stackable, and the demand for better-matched candidates is coming from both sides. TRUE Path Navigator sits directly at that intersection.

---

## 3. Vision & Mission

**Vision**
A human-first AI tool that bridges people and opportunities by turning complex workforce systems into clear, accessible pathways to good jobs.

**Mission**
To give every jobseeker in King County — regardless of education, language, or prior experience — a fast, honest, and actionable entry point into a healthcare career, while reducing the manual matching burden on case managers.

---

## 4. Objectives & Success Metrics

### Primary Objective
Deliver a demo-ready MVP by July 2026 that proves the core AI-guided pathway experience end-to-end.

### KPIs & Targets

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Pathway comprehension rate | 80%+ of users clearly understand their recommended pathway | Post-session survey / usability testing |
| User confusion rate | < 10% report confusion about next steps | Survey + qualitative feedback |
| Intake completion rate | Tracked via drop-off analytics per step | Event analytics |
| AI recommendation confidence | Confidence score reported per recommendation | Backend scoring output |
| User engagement time | Baseline to be set in alpha; watch for extreme outliers | Session duration analytics |
| Demo readiness | Full end-to-end workflow live for GitLab Foundation demo | September 2026 milestone |

### Analytics Signals (Operational)
- Drop-off rate at each intake question
- AI confidence scores per recommendation
- User engagement time per session
- PDF download / share rate

---

## 5. Scope

### In Scope — MVP Features

- **Dynamic Intake Flow** — pill/button-driven guided questions (no free-text); AI generates contextual follow-up questions in real time based on prior answers
- **Skills Assessment** — AI infers transferable skills from intake responses; presented as a selectable grid with brief AI rationale; sourced from O*NET task data
- **Career Map** — three recommended healthcare career pathways per user; each card includes role title, wage range, career ladder, and relevant tags (e.g., evening classes, WIOA eligible)
- **Limitations Panel** — honest, AI-generated summary of constraints above the pathway cards (schedule conflicts, credential gaps, program availability)
- **PDF Output** — AI-generated (not template-filled) action plan with background summary, top pathway with career ladder, three next steps, support resources, data source citation, and CPS contact
- **AI Recommendation Layer** — LLM-powered ranking by fit, barriers, training length, wage potential, and advancement; explainable reasoning with confidence scoring
- **RAG Grounding** — all pathway recommendations grounded in SeaKing WDC workforce data via retrieval-augmented generation

### Out of Scope — MVP

The following will **not** be built for the MVP:

- Account creation or user login (sessions are stateless)
- Resume upload or skill extraction from files
- Voice or chat input
- Live training program mapping (ETPL integration)
- Live job postings (Indeed / ZipRecruiter)
- Apprenticeship mapping
- Eligibility screening (WIOA, background checks)
- Case manager dashboard
- Automation risk scoring

---

## 6. Stakeholders & User Personas

### Stakeholders

| Stakeholder | Role | Interest |
|-------------|------|----------|
| Career Path Services (CPS) | Product Owner / Funder | Deliver a working MVP; reduce case manager burden |
| SeaKing Workforce Development Council (WDC) | Data Partner | Ensure workforce data is accurately surfaced |
| GitLab Foundation | Demo Audience / Funder | See live end-to-end workflow by September 2026 |
| Case Managers | Internal Pilot Users | Validate pathway accuracy; provide feedback in alpha |
| Jobseekers (King County) | End Users | Receive clear, actionable career guidance |

### User Personas

**Persona 1 — Maria (Career Changer)**
- Age 28, retail worker seeking stable income
- Needs a clear entry pathway into healthcare without navigating certification complexity
- Pain points: overwhelmed by options, does not understand certification ladders
- Motivations: higher wages, job stability

**Persona 2 — Sofia (Young Adult / Community College Student)**
- Age 22, part-time worker enrolled at community college
- Needs affordable healthcare career options that do not require a four-year degree
- Pain points: limited career guidance, unsure where to start
- Motivations: meaningful work, financial independence, long-term advancement

**Persona 3 — Priya (Internationally Trained Healthcare Worker)**
- Age 34, internationally trained nurse with 8 years of experience, recently arrived in the U.S.
- Needs clear guidance on credential evaluation, U.S. licensing requirements, and re-entry pathways
- Pain points: confusing licensing system, lack of U.S. healthcare network, financial pressure
- Motivations: career continuity, professional recognition, financial stability

**Additional Target Use Cases (MVP must serve)**
- Dislocated workers seeking stable employment after layoffs
- Immigrants and ESL learners needing simplified pathway guidance
- Parents returning to work who require evening or online programs
- Gig workers seeking stable schedules and benefits
- Rural jobseekers needing local or hybrid training options
- Advancement-focused workers pursuing stackable credentials (e.g., CNA → LPN → RN)

---

## 7. Deliverables

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | Dynamic Intake Module | AI-driven question flow with real-time contextual follow-ups |
| 2 | Skills Assessment Grid | O*NET-mapped transferable skills with AI rationale and user confirmation |
| 3 | Career Map UI | Three pathway cards with role, wage, ladder, tags, and limitations panel |
| 4 | AI Recommendation Engine | LLM-powered ranking with explainable reasoning and confidence scoring |
| 5 | RAG Data Pipeline | Ingestion and retrieval layer over SeaKing WDC workforce data |
| 6 | PDF Action Plan Generator | AI-generated (not templated) downloadable/printable career plan |
| 7 | Analytics Instrumentation | Drop-off tracking, engagement time, and confidence score logging |
| 8 | Alpha Pilot Package | Internal QA results, pilot case manager session notes, accessibility review, ethical AI test results |
| 9 | Demo Build | Full end-to-end live workflow for GitLab Foundation demo (September 2026) |

---

## 8. Technical Architecture

### Frontend
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Hosting:** Vercel or Netlify
- **Design principle:** Pill/button-first UI; no free-text input required for intake

### Backend
- **Framework:** Python FastAPI
- **Data Validation:** Pydantic
- **Hosting:** Render, Railway, or Azure
- **API boundary:** All AI calls routed through backend only; no direct client-side LLM access

### AI Layer
- **LLM Provider:** OpenAI GPT-4o (via backend API)
- **Prompt Management:** Reusable, version-controlled prompt templates
- **Recommendation Logic:** Intake responses + workforce data + training data → ranked pathway output
- **Explainability:** Each recommendation includes a plain-language rationale (e.g., *"Medical Assistant was recommended because the user prefers patient-facing work, has customer service experience, and is seeking a short-term training pathway."*)
- **Confidence Scoring:** Per-recommendation confidence score; error handling for low-confidence outputs
- **RAG Pipeline:** Retrieval-augmented generation grounded in SeaKing WDC data; no hallucinated program or wage data permitted

### Data Layer
- **Current (MVP):** State workforce data ingested and indexed for RAG retrieval
- **Future:** PostgreSQL + pgvector for persistent vector storage
- **Skill Mapping Source:** O*NET task data mapped to healthcare role requirements

### PDF Generation
- **Library:** ReportLab or WeasyPrint
- **Output:** AI-generated narrative plan (not a static template); includes data citations, case manager disclaimer, and CPS contact information

### Example Stackable Pathways (Data Seeded)
- CNA → LPN → RN
- Dental Assistant → EFDA → Registered Dental Hygienist
- Medical Assistant → Healthcare Administrator
- Phlebotomist → Medical Laboratory Technician

---

## 9. Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI generates inaccurate pathway or wage data | Medium | High | RAG grounding in verified WDC data; confidence scoring; case manager disclaimer on all outputs |
| SeaKing WDC data is incomplete or stale | Medium | High | Data validation sprint in April; define refresh cadence before alpha |
| Intake flow is too complex for low-literacy or ESL users | Medium | High | Pill/button UI removes typing burden; plain language review in accessibility pass (July) |
| LLM output variability reduces consistency across sessions | Medium | Medium | Version-controlled prompts; golden test scenarios run against every model update |
| PDF output quality is insufficient for case manager use | Low | Medium | Case manager pilot in July provides direct feedback before expansion |
| Demo timeline slips due to data pipeline delays | Medium | High | Foundation sprint in April; data architecture de-risked before AI build begins |
| Ethical AI concerns surface during testing | Low | High | Ethical AI review scheduled for July alpha; bias testing against all three personas |

### Assumptions

- OpenAI GPT-4o API access is available and within budget for the MVP phase
- SeaKing WDC will provide timely access to structured workforce data for ingestion
- Sessions are stateless; no user data is stored between visits (no PII retention risk for MVP)
- Case managers from the pilot cohort are available for feedback sessions in July and August 2026
- The GitLab Foundation demo date of September 2026 is fixed; the MVP must be demo-ready by that date
- Jobseekers have access to a modern browser on desktop or mobile; no native app is required
- All wage and program data displayed is sourced from verified Washington State datasets only — no third-party scraping or unverified sources
