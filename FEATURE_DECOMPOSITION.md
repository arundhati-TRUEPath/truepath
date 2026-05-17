# TRUE Path Navigator — Feature Decomposition

## 1. Underlying Intents

- Deliver fast, accessible healthcare career guidance for King County jobseekers.
- Reduce manual case manager effort by automating pathway matching and next-step guidance.
- Build a demo-ready MVP by September 2026 that proves an end-to-end AI-guided workflow.
- Ground recommendations in verified Washington State workforce data to build trust and reduce hallucinations.
- Keep the MVP low-friction and inclusive: no login, no resume upload, no free-text input, and no PII storage.

## 2. Decomposed Features

1. Generate intake questions
2. Capture intake responses
3. Infer transferable skills
4. Present skills rationale
5. Rank recommended pathways
6. Display pathway cards
7. Show limitations panel
8. Generate downloadable PDF plan
9. Ground recommendations in workforce data
10. Add recommendation confidence scoring
11. Log engagement analytics
12. Validate intake flow for accessibility
13. Build stateless session handling
14. Version prompt templates
15. Collect case manager pilot feedback

## 3. Intent-to-Feature Mapping

### Intent: Help jobseekers find a clear healthcare career start
- Generate intake questions
- Capture intake responses
- Infer transferable skills
- Display pathway cards
- Generate downloadable PDF plan

### Intent: Reduce case manager manual matching work
- Infer transferable skills
- Rank recommended pathways
- Show limitations panel
- Generate downloadable PDF plan
- Collect case manager pilot feedback

### Intent: Prove end-to-end MVP for demo
- Generate intake questions
- Capture intake responses
- Rank recommended pathways
- Display pathway cards
- Generate downloadable PDF plan
- Log engagement analytics

### Intent: Keep outputs grounded and trustworthy
- Ground recommendations in workforce data
- Add recommendation confidence scoring
- Version prompt templates

### Intent: Ensure accessible, low-friction user flow
- Generate intake questions
- Capture intake responses
- Validate intake flow for accessibility
- Build stateless session handling

## 4. Assumptions & Risks

### Assumptions
- OpenAI GPT-5.5 API access is available and budgeted.
- SeaKing WDC workforce data is available in a format suitable for RAG.
- Users have a modern browser and can interact with button-driven intake.
- Stateful accounts are not required for the MVP.
- Case managers will participate in pilot validation.

### Risks
- AI may still recommend inaccurate pathways or wages despite grounding.
- Workforce data could be incomplete, stale, or hard to integrate.
- Intake flow may be too complex for low-literacy or ESL users.
- The September demo timeline could slip if the data/RAG pipeline is delayed.
- Confidence scoring and explainability may be difficult to implement within MVP scope.
