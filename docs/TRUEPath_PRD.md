# TRUEPath Navigator — AI Scoring Engine
## Product Requirements Document

| Field | Detail |
|---|---|
| **Product** | TRUEPath Navigator |
| **Module** | AI Scoring Engine & Recommendation Pipeline |
| **Owner** | Arundhati . PM, Career Path Services |
| **Version** | PRD v2.0 — July 2026 |
| **Status** | Draft |
| **Stakeholders** | CPS leadership, SeaKing WDC program staff, case managers |
| **Data Sources** | O\*NET 30.3, WA ETPL, BLS OOH, WA DOH Licensing, WA In-Demand Occupations List |

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Product Vision & Objectives](#2-product-vision--objectives)
3. [Users & Personas](#3-users--personas)
4. [Scope & Boundaries](#4-scope--boundaries)
5. [Intake Questionnaire Requirements](#5-intake-questionnaire-requirements)
6. [Scoring Engine Requirements](#6-scoring-engine-requirements)
7. [Occupation-Level Scoring: S × I × F](#7-occupation-level-scoring-s--i--f)
8. [Program-Level Ranking: P Score](#8-program-level-ranking-p-score)
9. [Display & Output Requirements](#9-display--output-requirements)
10. [LLM Integration Requirements](#10-llm-integration-requirements)
11. [AI Safety & Guardrails](#11-ai-safety--guardrails)
12. [Data Requirements](#12-data-requirements)
13. [Acceptance Criteria & Canonical Test Case](#13-acceptance-criteria--canonical-test-case)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Roadmap & Dependencies](#16-roadmap--dependencies)
17. [Appendix: Scoring Tier Tables](#18-appendix-scoring-tier-tables)

---

## 1. Problem Statement

Washington State job seekers entering the public workforce system face a fragmented career exploration process. Case managers manually match clients to healthcare training programs using personal knowledge, static brochures, and time-consuming one-on-one interviews. This approach has three systemic problems:

1. **Inconsistency** — Recommendations vary by case manager experience and caseload pressure. Two clients with identical profiles may receive different guidance depending on who they see.
2. **Limited visibility** — No single case manager knows every ETPL-approved program, every licensing requirement, and every county-level demand signal. Information is siloed.
3. **Bottleneck** — The current process requires 45–90 minutes of case-manager time per client for initial career exploration alone, limiting throughput during high-demand periods.

TRUEPath Navigator's scoring engine addresses these problems by providing a deterministic, transparent, data-driven ranking of healthcare occupations and training programs tailored to each job seeker's skills, interests, and constraints — while keeping the case manager as the final decision-maker.

---

## 2. Product Vision & Objectives

### Vision

Every job seeker in King County's public workforce system receives career recommendations grounded in real labor market data, matched to their actual skills and circumstances, within 10 minutes of starting the intake process — regardless of which case manager they see.

### Objectives

| Objective | Metric | Target |
|---|---|---|
| **Reduce intake time** | Minutes from first question to recommendation output | ≤ 10 min (from 45–90 min baseline) |
| **Increase recommendation consistency** | % agreement between engine output and expert panel review | ≥ 85% |
| **Expand occupation coverage** | Distinct SOC codes scored per session | 147+ healthcare occupations |
| **Maintain human oversight** | % of recommendations reviewed by case manager before delivery | 100% |
| **Improve training enrollment** | % of clients who enroll in a recommended program within 60 days | Track as baseline in pilot |

### Success Criteria for v1.0

The engine is considered production-ready when:
- The canonical test case (Maria, see §13) produces the expected scores within ±0.02 tolerance.
- 100% of hard removals (E = 0.0) include a logged reason.
- LLM-generated card text passes validation against the scoring trace ≥ 95% of the time.
- Zero instances where the LLM modifies, reorders, or suppresses ranking output.

---

## 3. Users & Personas

### Primary Users

| Persona | Role | Interaction with Scoring Engine |
|---|---|---|
| **Job Seeker** | End user (e.g., Maria — 34yo, former caregiver, needs income in 3–6 months) | Answers intake questions; sees ranked career cards with plain-language explanations. Never sees scores or component values. |

---

## 4. Scope & Boundaries

### In Scope (v1.0)

- Intake questionnaire (up to 18 questions, branching logic, 12-question circuit-breaker)
- Occupation-level scoring engine (`score = S × I × F`)
- Program-level ranking within each occupation card (`P = cost_fit × duration_fit × distance_fit × quality_fit`)
- Display logic (top cards, pathway cards, future-path section, ruled-out log)
- LLM-generated card explanation text with validation against scoring trace
- Case-manager review interface with full scoring trace visibility
- Audit logging for all hard removals, cluster wipes, and confirmation overrides
- Configuration-driven thresholds, weights, and tier boundaries (database, not code)

### Out of Scope (v1.0)

- Job listing integration (Jooble, USAJobs — planned for v2)
- Resume parsing or document upload
- Employer-side matching
- Multi-language intake (English only in v1)
- Mobile-native intake UI (responsive web only)
- Automated case-manager bypass (human review is mandatory)

### AI Boundary

The scoring engine is **deterministic**. Given the same inputs, it always produces the same outputs. The LLM is used only for generating natural-language explanation text, never for ranking, filtering, or decision-making. This boundary is a hard requirement, not a design preference.

---

## 5. Intake Questionnaire Requirements

### REQ-INT-01: Question Bank

The system shall maintain a bank of 18 questions organized into three phases:

| Phase | Questions | Behavior |
|---|---|---|
| **Situation** (always first) | C1 (profile type), C2 (ZIP code), C3 (timeline) | Always presented; establishes baseline signals |
| **Fit & Preferences** (conditional) | Q1 (patient contact), Q2 (blood/needles), Q3 (pace), Q4 (helping style), Q5+Q6 (experience), Q8 (physical), Q24 (setting) | Branching based on C1 and prior answers |
| **Practical Constraints** | Q9 (shifts), Q10 (background check), Q18 (transportation), Q19 (care duties), Q25 (supports needed), Q26 (credential), Q28 (future-path toggle) | Conditional; skipped if irrelevant |

### REQ-INT-02: Question Cap

The system shall present no more than **12 questions** per session. If the cap is reached before all conditional questions are exhausted, the system shall:
- Stop asking questions
- Score with available data using neutral defaults for unanswered components
- Flag the session for case-manager review

### REQ-INT-03: No Wrong Answers

Every answer shall map to a scoring signal. Skipped questions shall receive neutral defaults (0.50 for interest facets, 0.25 for skill evidence). The system shall never penalize a user for not answering.

### REQ-INT-04: Confirmation Before Cluster Wipe

If a single answer would eliminate an entire pathway cluster (e.g., all clinical occupations), the system shall present a confirmation prompt before applying the cut. The user may reverse without penalty.

### REQ-INT-05: Credential Re-Anchor

If the user discloses a held credential (Q26), the system shall switch timeline calculations to use refresher/bridge program durations instead of full-course durations for that occupation family.

### REQ-INT-06: Answer Utilization

The system shall enforce `answers_used / answers_given = 100%`. Every answer feeds at least one scoring component or generates a case-manager flag. No answer is collected without a defined purpose.

---

## 6. Scoring Engine Requirements

### REQ-SCR-01: Deterministic Output

The scoring engine shall be a pure function. Given identical inputs (intake signals, occupation data, program data, demand matrix), it shall always produce identical outputs. No randomness, no session state, no LLM involvement in scoring.

### REQ-SCR-02: Multiplicative Formula

The occupation-level score shall be computed as:

```
score = S × I × F
where F = T × H × G × E × D
```

The multiplicative structure is a **requirement**, not a suggestion. It ensures that any single component near zero drags the entire score toward zero. A weighted-sum or averaging approach is explicitly rejected.

### REQ-SCR-03: Display Transform

For internal case-manager display only, the raw score (0–1) shall be transformed to a 60–95 scale:

```
display_score = 60 + 35 × score^(1/3)
```

Job seekers shall never see numeric scores in any form.

### REQ-SCR-04: Configuration-Driven Parameters

All thresholds, tier boundaries, and exponent weights shall be stored as database configuration, not hard-coded. Changes to scoring behavior shall require a config update, not a code deployment. Initial configuration:
- All exponents: 1.0
- Top-card display threshold: 78
- Component floor: 0.25
- Top-card count limit: 5

### REQ-SCR-05: Scoring Trace

Every scored occupation shall produce a complete trace object containing:
- All seven component values (S, I, T, H, G, E, D)
- Composite F value and raw score
- Display score
- Hard-removal flag and reason (if applicable)
- Below-threshold flag
- Component-floor violation flag
- Input sources for each component (which answers and data joins were used)

---

## 7. Occupation-Level Scoring: S × I × F

### 7.1 S — Skill Matching

**Purpose:** Measures evidence that the user can perform the work required by the target occupation.

**Method:** Weighted mean of skill-evidence values across the occupation's O\*NET skills, weighted by O\*NET importance scores.

**Requirements:**

| ID | Requirement |
|---|---|
| REQ-S-01 | S shall be computed as `Σ(importance × evidence) / Σ(importance)` across the occupation's O\*NET skill profile |
| REQ-S-02 | Evidence levels: DIRECT = 1.00, ADJACENT = 0.50, UNKNOWN = 0.25, CONTRADICTED = 0.00 |
| REQ-S-03 | Skills not covered by any intake answer shall default to UNKNOWN (0.25), never zero |
| REQ-S-04 | If the occupation has no O\*NET skill data, S shall default to 0.25 |

**Evidence Mapping:**

| User Signal | Evidence Level | Example |
|---|---|---|
| Holds the credential for this occupation | DIRECT (1.00) | CNA certificate → Nursing Assistant skills |
| Verified paid experience in the skill domain | DIRECT (1.00) | Customer service job → Speaking, Active Listening |
| Transferable unpaid experience | ADJACENT (0.50) | 3yr family caregiving → Service Orientation, Monitoring |
| No information provided | UNKNOWN (0.25) | Question skipped or not applicable |
| Explicitly lacks mandatory prerequisite | CONTRADICTED (0.00) | No HS diploma for role requiring one (rare) |

---

### 7.2 I — Interest Alignment

**Purpose:** Measures whether the occupation matches the user's stated preferences and comfort levels.

**Method:** Mean of facet-match values across the occupation's facet profile.

**Requirements:**

| ID | Requirement |
|---|---|
| REQ-I-01 | I shall be computed as the arithmetic mean of facet match values |
| REQ-I-02 | Facet match levels: Aligned = 1.00, Neutral = 0.50, Conflict = 0.15 |
| REQ-I-03 | Unanswered facets shall default to Neutral (0.50) |
| REQ-I-04 | **Blood/needles cap:** If Q2 = `'rather_not'` AND user confirms, I shall be capped at 0.35 for all occupations with `care_tier` 1 or 2 (clinical roles) |
| REQ-I-05 | The Q2 cap shall apply based on the confirmation flag (`q2_confirmed_rather_not`), not the raw Q2 answer. If the user reverses ("show me those too"), no cap is applied |

**Facet Definitions:**

| Facet | Source Question | Occupation Attribute |
|---|---|---|
| Patient contact level | Q1 | `occ_facets.patient_contact` |
| Blood/needles/fluids tolerance | Q2 | `occ_facets.blood_needles` |
| Pace preference | Q3 | `occ_facets.pace` |
| Helping style | Q4 | `occ_facets.helping_style` |
| Work setting | Q24 | `occ_facets.setting` |
| Physical demand tolerance | Q8 | `occ_facets.physical_demand` |

---

### 7.3 T — Timeline Feasibility

**Purpose:** Measures whether the shortest qualifying training program fits within the user's stated earning window.

**Requirements:**

| ID | Requirement |
|---|---|
| REQ-T-01 | T shall be based on the ratio: `shortest_program_months / user_midpoint_months` |
| REQ-T-02 | Tier values: ratio ≤ 1.0 → T = 1.00, ≤ 1.5 → T = 0.70, ≤ 2.0 → T = 0.40, > 2.0 → T = 0.20 |
| REQ-T-03 | User midpoint is `(timeline_min + timeline_max) / 2` based on C3 answer |
| REQ-T-04 | For credential holders (Q26), use refresher/bridge program duration, not full-course duration |
| REQ-T-05 | If no qualifying programs exist in the database for the SOC, T shall default to 0.25 (fail-open) |

**Timeline Resolution:**

| C3 Answer | Range | Midpoint |
|---|---|---|
| Less than 3 months | 0–3 mo | 1.5 mo |
| 3–6 months | 3–6 mo | 4.5 mo |
| 6–12 months | 6–12 mo | 9.0 mo |
| No rush | 12–48 mo | 30.0 mo |

---

### 7.4 H — Schedule Compatibility

**Purpose:** Measures overlap between the user's available shifts and the training program's and job's typical shift patterns.

| ID | Requirement |
|---|---|
| REQ-H-01 | H shall compare user shift availability (Q9) against program and occupation shift requirements |
| REQ-H-02 | Full overlap = 1.00, partial overlap = 0.60–0.80, no overlap = 0.30 |
| REQ-H-03 | If user has care duties (Q19 = true), rotating shifts shall receive an additional penalty |

---

### 7.5 G — Geography

**Purpose:** Measures physical accessibility of training programs from the user's location.

| ID | Requirement |
|---|---|
| REQ-G-01 | In-county or fully online program = 1.00, adjacent county = 0.60, relocation-level distance = 0.30 |
| REQ-G-02 | County shall be resolved from ZIP code (C2) |
| REQ-G-03 | Lack of vehicle (Q18 = `'neither'`) shall generate a transport-support flag but shall NOT reduce G if the program is transit-accessible |

---

### 7.6 E — Eligibility

**Purpose:** Determines whether the user is legally and practically eligible for the occupation.

| ID | Requirement |
|---|---|
| REQ-E-01 | Clear eligibility = 1.00, conditional (needs documentation) = 0.60, barrier with known waiver = 0.25, categorical legal ineligibility = 0.00 |
| REQ-E-02 | **E = 0.00 is the ONLY value that triggers hard removal** from all result categories |
| REQ-E-03 | Every hard removal (E = 0.00) shall be logged with: SOC code, reason, timestamp, input values, and licensing rule applied |
| REQ-E-04 | E values of 0.25 and 0.60 are soft gates — the occupation appears as a Pathway card or with an explanation, never suppressed |

---

### 7.7 D — Demand & Fundability

**Purpose:** Measures local labor market demand and funding eligibility for the occupation.

| ID | Requirement |
|---|---|
| REQ-D-01 | On WA In-Demand list for user's county = 1.00, balanced market = 0.70, in-demand in adjacent county only = 0.50, not in-demand anywhere nearby = 0.25 |
| REQ-D-02 | In-demand status shall also set a flag indicating WIOA ITA funding eligibility for ETPL-listed programs |
| REQ-D-03 | If the SOC/county combination is missing from the demand matrix, D shall default to 0.25 (not error) |

---

## 8. Program-Level Ranking: P Score

### Purpose

Once occupations are ranked, each result card lists specific training programs. Programs within a card are ranked by a separate multiplicative formula to help case managers identify the best-fit program for the client.

### Formula

```
P = cost_fit × duration_fit × distance_fit × quality_fit
```

### Requirements

| ID | Requirement |
|---|---|
| REQ-P-01 | `cost_fit`: Out-of-pocket after funding: $0 → 1.0, ≤$500 → 0.8, ≤$2k → 0.5, more → 0.3 |
| REQ-P-02 | `cost_fit` shall subtract ITA cap if occupation is in-demand + user is WIOA eligible + program is ETPL-listed |
| REQ-P-03 | `duration_fit`: Relative to shortest qualifying program for the SOC: shortest = 1.0, 1.5× = 0.8, 2× = 0.6, >2× = 0.4 |
| REQ-P-04 | `duration_fit` shall NOT use absolute months (already captured in occupation-level T). It uses relative position among qualifying programs to avoid double-counting |
| REQ-P-05 | `distance_fit`: ≤20min travel = 1.0, ≤45min = 0.7, ≤75min = 0.4, farther = 0.2, online = 1.0 |
| REQ-P-06 | `distance_fit` shall use travel time based on user's transportation mode (car vs transit from Q18) |
| REQ-P-07 | `quality_fit`: Completion ≥70% + employment ≥ median = 1.0; one metric weak = 0.7; both weak = 0.4; no data = 0.6 with "data pending" flag |
| REQ-P-08 | Programs with no outcome data shall NOT be suppressed — they appear with `quality_fit = 0.6` and a visible flag |

---

## 9. Display & Output Requirements

### REQ-DSP-01: Card Categories

The system shall categorize scored occupations into four output groups:

| Category | Selection Criteria | Visible To |
|---|---|---|
| **Top Cards** | `display_score ≥ 78` AND no single component < 0.25; up to 5 | Job seeker (after case-manager approval) |
| **Pathway Cards** | `display_score` 70–77, not in top 5 | Case manager only |
| **Future Path** | S ≥ 0.40 AND I ≥ 0.60 AND T ≤ 0.40 AND `display_score < 78`; only if Q28 = true; up to 5 | Job seeker (labeled "longer-term goals") |
| **Ruled Out** | Hard removal (E = 0.00) or user-confirmed preference cut | Audit log + case-manager review |

### REQ-DSP-02: Card Content

Each top card shall display:
- Occupation title
- Salary range (from BLS OOH data)
- Training duration (shortest qualifying program)
- One-line value proposition
- 2–3 personalized reason bullets (LLM-generated, validated)
- Top 1–3 training programs ranked by P score

### REQ-DSP-03: No Numeric Scores for Job Seekers

Job seekers shall never see raw scores, display scores, or component values. They see ranked cards and plain-language explanations only. Numeric scores are visible exclusively to case managers and administrators.

### REQ-DSP-04: Non-Scoring Outputs

Certain intake answers generate outputs that do not affect scoring:

| Input | Output |
|---|---|
| Q12 (pay floor) | Acknowledged on card: "this role typically pays above/below your stated minimum." Used as tie-breaker between equal scores |
| Q13 (growth vs stability) | Controls card ordering emphasis and value-proposition framing |
| Q25 (supports needed) | Generates case-manager flags: transportation, childcare, or funding support needed |

---

## 10. LLM Integration Requirements

### REQ-LLM-01: Single Use Case

The LLM (Azure OpenAI) shall be used for exactly one purpose: generating natural-language card explanation text (the value proposition and reason bullets on each result card). It shall not be used for scoring, ranking, filtering, or any decision-making.

### REQ-LLM-02: Read-Only Access

The LLM shall receive the scoring trace as read-only context. It shall not have any mechanism to modify scores, reorder results, suppress occupations, or insert new occupations.

### REQ-LLM-03: Validation Against Trace

All LLM-generated card text shall be validated against the scoring trace before display. Every factual claim in the text must be supported by a corresponding value in the trace. Examples:
- "Your caregiving experience is a strong match" → trace must contain ADJACENT or DIRECT skill evidence
- "This program is in your county" → `trace.components.G === 1.0`
- "This career is in high demand" → `trace.components.D === 1.0`

### REQ-LLM-04: Template Fallback

If validation fails for any claim, the system shall discard the entire LLM output for that card and substitute pre-written templated text derived from the scoring trace. The template is less personalized but guaranteed accurate.

### REQ-LLM-05: Validation Success Rate

LLM-generated text shall pass validation ≥ 95% of the time. Failures shall be logged with the LLM output, the trace, and the specific claim that failed, for prompt engineering review.

---

## 11. AI Safety & Guardrails

| ID | Guardrail | Implementation |
|---|---|---|
| REQ-GRD-01 | **LLM never ranks** | All ranking is performed by the deterministic scoring engine. The LLM cannot reorder, suppress, or promote any occupation. |
| REQ-GRD-02 | **Scoring trace required** | Every recommendation carries a complete scoring trace. Case managers can inspect any result. |
| REQ-GRD-03 | **No protected-class inputs** | The system shall never use age, race, gender, disability status, or national origin as scoring inputs. ZIP code is used for geography and demand only. |
| REQ-GRD-04 | **Human-in-the-loop** | Case managers review 100% of recommendations before job seekers see them. The system is an advisor to the case manager, not a replacement. |
| REQ-GRD-05 | **Audit logging** | Every hard removal (E = 0.0), cluster wipe, and confirmation override is logged with timestamp, input values, and rule applied. |
| REQ-GRD-06 | **Fail-safe defaults** | Missing data for any component uses neutral defaults (S = 0.25, I = 0.50, T = 0.25, H = 0.50, G = 0.30, E = 1.0, D = 0.25, quality_fit = 0.6). Never zero. |
| REQ-GRD-07 | **Determinism** | The scoring engine is a pure function. No randomness, no session state, no LLM involvement in scoring. Same inputs always produce same outputs. |
| REQ-GRD-08 | **Unknowns are neutral** | Skipped or unanswered questions shall never produce a zero score. Sparse profiles receive wider results, not empty results. |

---

## 12. Data Requirements

### REQ-DAT-01: Source Systems

| Source | Data | Refresh Cadence | Integration Method |
|---|---|---|---|
| O\*NET 30.3 | Skill profiles, importance/level scores for 147+ SOC codes | Annual (tied to O\*NET release) | Bulk import to `occ_skills` |
| WA ETPL | Program listings, durations, tuitions, outcomes, locations | Quarterly | API or bulk import to `programs` |
| BLS OOH | Salary ranges, job outlook | Annual | Bulk import to `occupations` |
| WA DOH Licensing | Credential requirements, background-check rules | As published | Manual review + import to licensing rules |
| WA In-Demand Occupations | County-level demand designations | Annual | Bulk import to `demand_matrix` |

### REQ-DAT-02: Data Completeness

- Every occupation in the system shall have: at least one O\*NET skill record, a complete facet profile, and at least one ETPL-listed program.
- Occupations without qualifying programs shall still be scored (T defaults to 0.25) but flagged for case-manager attention.

### REQ-DAT-03: Data Integrity

- No `NULL` values in component calculations. Every field used in scoring shall have a defined default.
- SOC codes shall be validated against O\*NET on import.

---

## 13. Acceptance Criteria & Canonical Test Case

### Canonical Test Case: Maria

| Parameter | Value |
|---|---|
| **Name** | Maria |
| **Age** | 34 |
| **Location** | Kent, WA (ZIP 98032, King County) |
| **Timeline** | 3–6 months (C3 = `'3-6mo'`) |
| **Credential** | None |
| **Transportation** | No car, no license (Q18 = `'neither'`) |
| **Experience** | 3yr unpaid caregiving (Q5), customer service (Q6) |
| **Preferences** | Hands-on care (Q4), lots of patient contact (Q1), fine with blood (Q2), steady pace (Q3), prefers homes (Q24), can stand/lift (Q8) |
| **Shifts** | Days + evenings (Q9) |

### Expected Output: Nursing Assistant (SOC 31-1131.00)

| Component | Expected Value | Rationale |
|---|---|---|
| S (Skill) | **0.59** | 4 skills at ADJACENT (0.50) + 1 at DIRECT (1.00), importance-weighted |
| I (Interest) | **0.83** | 5/6 facets aligned (1.00), 1 partial (0.50, setting mismatch) |
| T (Timeline) | **1.00** | 3mo program / 4.5mo midpoint = 0.67 ratio, ≤ 1.0 |
| H (Schedule) | **1.00** | Day + evening: full match |
| G (Geography) | **1.00** | Programs in King County, transit-accessible |
| E (Eligibility) | **1.00** | HS diploma held, no barriers |
| D (Demand) | **1.00** | In-demand in King County |
| **F** | **1.00** | T × H × G × E × D |
| **Raw score** | **0.49** | S × I × F |
| **Display score** | **87.6** | 60 + 35 × 0.49^(1/3) |
| **Result** | ✅ **Top card** | display ≥ 78, no component below 0.25 |

### Expected Output: Registered Nurse (SOC 29-1141.00)

| Component | Expected Value | Rationale |
|---|---|---|
| S (Skill) | 0.55 | Less direct evidence for RN-level skills |
| I (Interest) | 0.83 | Same preference match |
| T (Timeline) | **0.20** | 24mo program / 4.5mo midpoint = 5.33 ratio, > 2.0 |
| **Raw score** | **0.091** | 0.55 × 0.83 × 0.20 |
| **Display score** | **75.8** | Below 78 threshold |
| **Result** | ❌ **Not top card** | Appears in Future Path section if Q28 = true |

### Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Maria's CNA score shall produce `display = 87.6 ± 0.5` |
| AC-02 | Maria's RN score shall produce `display < 78` |
| AC-03 | Running Maria's inputs twice shall produce byte-identical output (determinism) |
| AC-04 | CNA shall appear in top cards; RN shall not |
| AC-05 | RN shall appear in Future Path section when Q28 = true |
| AC-06 | Maria's no-car status shall generate a transport-support flag without reducing G |
| AC-07 | All 7 component values shall be present in the scoring trace |
| AC-08 | LLM card text for CNA shall reference caregiving experience (trace-supported claim) |

---

## 14. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | **Performance** | Score all 147+ occupations for one user in < 2 seconds |
| NFR-02 | **Performance** | End-to-end intake-to-results in < 10 seconds (excluding user response time) |
| NFR-03 | **Availability** | 99.5% uptime during business hours (M–F, 8am–6pm PT) |
| NFR-04 | **Security** | No PII stored in scoring traces. ZIP code is the most granular location data retained. |
| NFR-05 | **Security** | LLM API calls shall not include user names, SSNs, or other PII in prompts |
| NFR-06 | **Accessibility** | Intake questionnaire shall meet WCAG 2.1 AA |
| NFR-07 | **Auditability** | All scoring traces retained for 3 years per WDC data retention policy |
| NFR-08 | **Configurability** | All scoring thresholds, tier boundaries, and exponents changeable via database config without code deployment |
| NFR-09 | **Observability** | Scoring-engine latency, LLM validation failure rate, and hard-removal counts reported to monitoring dashboard |

---

## 15. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| O\*NET skill profiles are incomplete for niche occupations | Medium | Low scores for valid occupations | Two-tier estimation methodology for occupations lacking published ratings; flag for manual review |
| ETPL program data is stale | Medium | Incorrect T, cost_fit, or distance_fit values | Quarterly refresh + automated staleness alerts for programs not updated in 6+ months |
| LLM hallucination in card text | Medium | Inaccurate claim shown to job seeker | Trace validation gate (REQ-LLM-03) + template fallback (REQ-LLM-04) |
| Users game answers to manipulate results | Low | Suboptimal recommendations | Multiplicative formula resists gaming — inflating one factor doesn't compensate for others. Case-manager review catches obvious mismatches. |
| Demand matrix doesn't cover all counties | Medium | D defaults to 0.25 for valid in-demand occupations | Pre-populate all 39 WA counties; log missing lookups for backfill |
| Bias through ZIP code proxy | Low | Geographic scoring could correlate with demographics | ZIP is used only for program distance and county-level demand. No demographic data is inferred. Documented in guardrails. |

---

## 16. Roadmap & Dependencies

### v1.0 — Pilot (Current)

- Scoring engine with 147+ healthcare occupations
- 20 pathway tracks across 6 pathway categories
- King County ETPL programs
- Case-manager review interface


### v1.1 — Expansion

- Extend to adjacent counties (Pierce, Snohomish, Kitsap)
- Add ETPL outcome data integration for `quality_fit`
- Prompt-engineering refinement based on validation failure logs

### v2.0 — Full Platform

- Job listing integration (Jooble, USAJobs)
- Multi-language intake (Spanish, Vietnamese, Somali)
- SeaKing SKC Chatbot integration
- Exponent tuning based on pilot outcome data

### Dependencies

| Dependency | Owner | Status |
|---|---|---|
| O\*NET 30.3 skill data import | Engineering | Complete |
| ETPL program database access | WDC IT | In progress |
| WA In-Demand Occupations List (2026) | WDC Policy | Pending annual release |
| Azure OpenAI provisioning (Private Link) | CPS IT | Complete |
| Case-manager UI build | Engineering | In progress |

---

## 18. Appendix: Scoring Tier Tables

### S — Skill Evidence Levels

| Level | Value | Description |
|---|---|---|
| DIRECT | 1.00 | Holds credential or verified paid experience |
| ADJACENT | 0.50 | Transferable unpaid or adjacent-domain experience |
| UNKNOWN | 0.25 | No signal (neutral default) |
| CONTRADICTED | 0.00 | Explicitly lacks mandatory prerequisite |

### I — Facet Match Levels

| Match | Value | Description |
|---|---|---|
| Aligned | 1.00 | User preference matches occupation facet |
| Neutral | 0.50 | Unanswered or "not sure" |
| Conflict | 0.15 | User preference actively conflicts with facet |

### T — Timeline Tiers

| Ratio (program ÷ user midpoint) | T Value |
|---|---|
| ≤ 1.0× | 1.00 |
| ≤ 1.5× | 0.70 |
| ≤ 2.0× | 0.40 |
| > 2.0× | 0.20 |

### G — Geography Tiers

| Condition | G Value |
|---|---|
| In-county or fully online | 1.00 |
| Adjacent county | 0.60 |
| Relocation-level distance | 0.30 |

### E — Eligibility Tiers

| Condition | E Value |
|---|---|
| Clear — no barriers | 1.00 |
| Conditional (needs documentation) | 0.60 |
| Barrier with known waiver path | 0.25 |
| Categorical legal ineligibility | 0.00 (hard remove) |

### D — Demand Tiers

| Condition | D Value |
|---|---|
| On WA In-Demand list for user's county | 1.00 |
| Balanced market | 0.70 |
| In-demand in adjacent county only | 0.50 |
| Not in-demand anywhere nearby | 0.25 |

### P — Program-Level Factors

| Factor | 1.0 | 0.8 | 0.7 | 0.6 | 0.5 | 0.4 | 0.3 | 0.2 |
|---|---|---|---|---|---|---|---|---|
| cost_fit | $0 oop | ≤$500 | — | — | ≤$2k | — | >$2k | — |
| duration_fit | Shortest | 1.5× | — | 2× | — | >2× | — | — |
| distance_fit | ≤20min / online | — | ≤45min | — | — | ≤75min | — | >75min |
| quality_fit | Both strong | — | One weak | No data | — | Both weak | — | — |

---

*This document defines what to build and why. For implementation details (pseudocode, data model, test fixtures), see `IMPLEMENTATION.md`.*
