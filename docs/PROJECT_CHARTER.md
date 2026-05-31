# Project Charter — TRUE Path Navigator

---

| Field          | Value                                      |
|----------------|--------------------------------------------|
| **Project Name** | TRUE Path Navigator                      |
| **Version**    | 1.0                                        |
| **Date**       | May 2026                                   |
| **Status**     | MVP (Minimum Viable Product) Phase — Active                         |
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
Deliver a production-ready MVP by July 2026 that proves the core AI-guided pathway experience end-to-end.

### KPIs & Targets

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Pathway comprehension rate | 80%+ of users clearly understand their recommended pathway | Post-session survey / usability testing |
| User confusion rate | < 10% report confusion about next steps | Survey + qualitative feedback |
| Intake completion rate | Tracked via drop-off analytics per step | Event analytics |
| AI recommendation confidence | Confidence score reported per recommendation | Backend scoring output |
| User engagement time | Baseline to be set in alpha; watch for extreme outliers | Session duration analytics |

### Analytics Signals (Operational)
- Drop-off rate at each intake question
- AI confidence scores per recommendation
- User engagement time per session
- PDF download / share rate

---

## 5. Scope

### In Scope — MVP Features

- **Start Intake** —  Pull 6 static questions from the database and present them to the user to begin the intake flow.
- **Dynamic Intake Flow** — pill/button-driven guided questions (no free-text); AI generates contextual follow-up questions in real time based on prior answers
- **Skills Assessment** — AI infers transferable skills from intake responses; presented as a selectable grid with brief AI rationale; sourced from O*NET task data (this will be sourced from an input excel file)
- **Career Map** — three recommended healthcare career pathways per user; each card includes role title, wage range, career ladder, and relevant tags (e.g., evening classes, WIOA eligible)
- **Limitations Panel** — honest, AI-generated summary of constraints above the pathway cards (schedule conflicts, credential gaps, program availability)
- **PDF Output** — AI-generated (based on a template defined) action plan with background summary, top pathway with career ladder, three next steps, support resources, data source citation, and CPS contact
- **AI Recommendation Layer** — LLM-powered ranking by fit, barriers, training length, wage potential, and advancement; explainable reasoning with confidence scoring
- **RAG Grounding** — all pathway recommendations grounded in O*NET task data  via retrieval-augmented generation

### Out of Scope — MVP

The following will **not** be built for the MVP: Do not include these in further steps of intent development or architecture

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

## 6. User Personas

### User Personas

**Persona 1 — Career Changer**
- Needs a clear entry pathway into healthcare without navigating certification complexity
- Pain points: overwhelmed by options, does not understand certification ladders
- Motivations: higher wages, job stability
- Example Persona : Age 28, Maria, retail worker seeking stable income

**Persona 2 — Young Adult / Community College Student**
- Needs affordable healthcare career options that do not require a four-year degree
- Pain points: limited career guidance, unsure where to start
- Motivations: meaningful work, financial independence, long-term advancement
- Example Persona : Age 22, part-time worker enrolled at community college

**Persona 3 — Internationally Trained Healthcare Worker**
- Needs clear guidance on credential evaluation, U.S. licensing requirements, and re-entry pathways
- Pain points: confusing licensing system, lack of U.S. healthcare network, financial pressure
- Motivations: career continuity, professional recognition, financial stability
- Example Persona : Age 34, internationally trained nurse with 8 years of experience, recently arrived in the U.S.

** Persona 4 - Dislocated Worker **
- Needs: Clear transition pathways into stable healthcare careers with short-term training options and transferable skills guidance.
- Pain Points: Uncertain how previous work experience applies to healthcare; financial pressure after job loss; overwhelmed by certifications and education requirements; - concerned about returning to school later in life.
- Motivations: Stable employment; reliable income and benefits; faster workforce re-entry; long-term career security and advancement opportunities.
- Age: 42,Former warehouse and logistics supervisor with 15 years of experience who was recently laid off due to automation and restructuring.


** Persona 5 - Immigrant / ESL Learner** 
- Needs Simplified healthcare career guidance with clear explanations of training programs, certifications, and next steps.
- Pain Points: Language barriers; unfamiliar workforce systems; difficulty understanding technical terminology; limited professional network in the U.S.
- Motivations: Financial independence; meaningful work; career growth opportunities; long-term stability for family.
 Age 31, Recently immigrated to the U.S. with prior caregiving and customer service experience. English is her second language.

**Persona 6: Parent Returning to Work**
- Needs: Flexible healthcare training programs with evening, weekend, online, or hybrid learning options.
- Pain Points: Balancing childcare responsibilities with education and work; limited time availability; anxiety about re-entering the workforce; need for predictable scheduling.
- Motivations: Financial stability; independence and confidence; stable employment with flexibility; long-term career growth.
- Example Persona :Age 37,Former administrative assistant returning to the workforce after several years focused on caregiving responsibilities.

**Persona 7: Gig Worker Seeking Stability**
- Needs: Structured career pathways into healthcare roles that provide stable schedules, benefits, and advancement opportunities.
- Pain Points: Unpredictable income; burnout from unstable schedules; lack of healthcare coverage and benefits; uncertainty about suitable healthcare careers.
- Motivations: Stable paycheck and benefits; work-life balance; long-term financial security; structured career growth.
- Example Persona: Age 29,Works multiple gig economy jobs including rideshare and food delivery with inconsistent income and no benefits.

**Persona 8: Rural Jobseeker**
- Example Persona: Age 26,Lives in a rural community with limited local training and employment opportunities but is interested in healthcare careers.
- Needs: Access to local, online, or hybrid healthcare training programs connected to nearby employers.
- Pain Points: Limited transportation; fewer educational institutions nearby; lack of awareness about available pathways; limited local healthcare career guidance.
- Motivations: Remain within local community; stable career opportunities; meaningful community impact; accessible training options.

**Persona 9: Advancement-Focused Healthcare Worker**

- Needs: Clear stackable credential pathways with timelines, certification requirements, salary progression, and advancement guidance.
- Pain Points: Difficulty navigating advancement pathways; balancing work with continued education; financial concerns related to training costs; lack of personalized career planning support.
- Motivations: Higher earning potential; professional recognition; long-term career advancement; greater family stability.
- Example Persona: Age 33,Currently working as a CNA with 5 years of experience and seeking advancement into higher-paying nursing and healthcare roles.


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

