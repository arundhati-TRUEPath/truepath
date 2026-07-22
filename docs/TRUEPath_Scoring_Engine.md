# `truepath-navigator` / scoring-engine

## Scoring Engine Implementation Guide

> **For developers building or maintaining the recommendation pipeline**

| Key | Value |
|---|---|
| **Audience** | Junior–mid developers on the TRUEPath team |
| **Prereqs** | Basic JS/Python, SQL queries, REST API concepts |
| **Stack context** | Node.js or Python backend, PostgreSQL, Azure OpenAI (LLM layer) |
| **Data sources** | O\*NET 30.3 API, WA ETPL database, BLS OOH, WA DOH licensing tables |
| **Version** | v1.0 — July 2026 |

---

## Contents

0. [Architecture Overview](#0-architecture-overview)
1. [Data Model & Key Tables](#1-data-model--key-tables)
2. [Intake Pipeline: Questions → Signals](#2-intake-pipeline-questions--signals)
3. [The Scoring Function](#3-the-scoring-function)
4. [Component Implementation: S, I, T, H, G, E, D](#4-component-implementation)
5. [Worked Example: Step-by-Step Debug Trace](#5-worked-example-debug-trace)
6. [Program-Level Ranking (P Score)](#6-program-level-ranking-p-score)
7. [Display Logic & Thresholds](#7-display-logic--thresholds)
8. [LLM Integration & Guardrails](#8-llm-integration--guardrails)
9. [Testing Strategy & Edge Cases](#9-testing-strategy--edge-cases)
10. [Common Pitfalls & FAQs](#10-common-pitfalls--faqs)

---

## 0. Architecture Overview

The scoring engine is a **deterministic pipeline**. Given the same inputs, it always produces the same outputs. The LLM is only used downstream for generating natural-language explanation text, never for ranking.

```
                   ┌─────────────────┐
    User Answers ──▶│  Signal Layer   │  Converts raw answers to typed signals
                   └───────┬─────────┘
                           │
                           ▼
                   ┌─────────────────┐
    Data Joins   ──▶│  Score Engine   │  score = S * I * F   (pure math)
    (O*NET, ETPL)  │  (deterministic)│
                   └───────┬─────────┘
                           │
                           ▼
                   ┌─────────────────┐
                   │ Display Layer   │  Top-5 filter, card builder
                   └───────┬─────────┘
                           │
                           ▼
                   ┌─────────────────┐
                   │   LLM Layer     │  Generates explanation text only
                   │ (Azure OpenAI)  │  Validated against scoring trace
                   └─────────────────┘
```

> **Key invariant:** The LLM has read-only access to the scoring trace. It cannot modify scores, reorder results, or suppress occupations. If validation fails, the system falls back to templated text.

---

## 1. Data Model & Key Tables

You'll work with these core entities. Understanding the relationships saves you a lot of debugging time.

### 1.1 Core Tables

```sql
-- PostgreSQL schema (simplified)

occupations
  ├─ soc_code        VARCHAR(10)  PK    -- e.g. '31-1131.00'
  ├─ title           VARCHAR(200)
  ├─ pathway_id      FK → pathways
  ├─ care_tier       ENUM(1,2,3)       -- 1=Direct, 2=Clinical Support, 3=Non-Clinical
  ├─ education_req   VARCHAR(100)
  ├─ salary_min      INTEGER
  ├─ salary_max      INTEGER
  ├─ training_months_min  FLOAT
  ├─ training_months_max  FLOAT
  ├─ shift_required  JSONB             -- ['days','evenings','nights','rotating']
  └─ physical_demand ENUM('high','moderate','low')

occ_skills
  ├─ soc_code        FK → occupations
  ├─ skill_name      VARCHAR(100)      -- O*NET skill name
  ├─ importance      FLOAT             -- O*NET importance (1-5 scale)
  └─ level           FLOAT             -- O*NET level (1-7 scale)

occ_facets
  ├─ soc_code        FK → occupations
  ├─ facet_name      VARCHAR(50)       -- 'patient_contact','pace','setting', etc.
  └─ facet_value     VARCHAR(50)       -- 'high','low','hospital','home', etc.

programs
  ├─ program_id      SERIAL PK
  ├─ soc_code        FK → occupations
  ├─ provider_name   VARCHAR(200)
  ├─ county          VARCHAR(50)
  ├─ is_online       BOOLEAN
  ├─ duration_months FLOAT
  ├─ tuition         INTEGER
  ├─ completion_rate FLOAT             -- null if no data
  ├─ employment_rate FLOAT             -- null if no data
  └─ shifts_offered  JSONB

demand_matrix
  ├─ soc_code        FK → occupations
  ├─ county          VARCHAR(50)
  └─ demand_level    ENUM('in_demand','balanced','low')
```

### 1.2 Intake Answers Shape

```typescript
interface IntakeAnswers {
  c1: 'student' | 'working_change' | 'caregiving' | 'unemployed';
  c2: string;          // ZIP code
  c3: '<3mo' | '3-6mo' | '6-12mo' | 'no_rush';
  q1: 'a_lot' | 'some' | 'behind_scenes' | null;
  q2: 'fine' | 'could_learn' | 'rather_not' | null;
  q3: 'fast' | 'steady' | null;
  q4: 'hands_on' | 'organizing' | 'technical' | 'talking' | null;
  q5_q6: string[];     // ['cared_family','customer_service','warehouse',...]
  q8: 'yes' | 'some_limits' | 'no' | null;
  q9: string[];        // ['days','evenings','nights','weekends','rotating']
  q10: 'no' | 'yes' | 'skip' | null;
  q18: 'yes' | 'license_no_car' | 'neither' | null;
  q19: boolean;        // has care responsibilities
  q24: 'hospital' | 'clinic' | 'home' | 'remote' | 'field' | null;
  q25: string[];       // ['transportation','childcare','funding']
  q26: { held: boolean; credential?: string; status?: string } | null;
  q28: boolean;        // show future-path section
}
```

---

## 2. Intake Pipeline: Questions → Signals

The signal layer converts raw user answers into structured objects the scoring engine consumes. Each question maps to one or more signal types.

| Question ID | Signal Type | Output | Used By |
|---|---|---|---|
| C2 (ZIP) | `geography` | `{ county, adjacent_counties, coords }` | G, D components |
| C3 (timeline) | `timeline` | `{ months_min, months_max }` | T component |
| Q1, Q2, Q3, Q4, Q8, Q24 | `preference[]` | `{ facet_name, user_value }` | I component |
| Q5+Q6, Q26, Q27 | `skill_evidence[]` | `{ skill_domain, evidence_level }` | S component |
| Q9, Q19 | `availability` | `{ shifts[], has_care_duties }` | H component |
| Q10, Q11, Q18, Q26 | `eligibility_signals` | `{ education, bg_check, license_status }` | E component |
| Q25 | `support_flags` | `{ needs: string[] }` | Non-scoring (CM flags) |

### 2.1 Timeline Resolution

```typescript
// timeline.ts
function resolveTimeline(c3: string): { min: number, max: number } {
  switch (c3) {
    case '<3mo':    return { min: 0, max: 3 };
    case '3-6mo':   return { min: 3, max: 6 };
    case '6-12mo':  return { min: 6, max: 12 };
    case 'no_rush': return { min: 12, max: 48 };  // 4yr cap
  }
}

// When computing T, use the midpoint: (min + max) / 2
// For credential holders (Q26.held = true),
// look up refresher program duration, not full course.
```

---

## 3. The Scoring Function

This is the core algorithm. It's intentionally simple — the complexity is in data joins, not clever math.

```typescript
// scoring-engine.ts
function scoreOccupation(
  signals: IntakeSignals,
  occ: Occupation,
  programs: Program[],
  demandMatrix: DemandEntry[]
): ScoringTrace {

  const S = computeSkillMatch(signals.skill_evidence, occ.soc_code);
  const I = computeInterestAlign(signals.preferences, occ.soc_code, signals);
  const T = computeTimeline(signals.timeline, occ, programs, signals.credential);
  const H = computeSchedule(signals.availability, occ, programs);
  const G = computeGeography(signals.geography, programs);
  const E = computeEligibility(signals.eligibility, occ.soc_code);
  const D = computeDemand(occ.soc_code, signals.geography.county, demandMatrix);

  const F = T * H * G * E * D;
  const raw = S * I * F;

  // Display transform (case-manager view only; never shown to job seekers)
  const display = 60 + 35 * Math.pow(raw, 1/3);

  return {
    soc_code: occ.soc_code,
    components: { S, I, T, H, G, E, D },
    F, raw, display,
    hard_removed: E === 0,
    below_threshold: display < 78,
    any_component_below_floor: Math.min(S, I, T, H, G, D) < 0.25,
  };
}
```

> 💡 **Why multiplicative?** With addition or weighted average, a 0.90 interest can mask a 0.20 timeline. Multiplication can't: `0.90 × 0.20 = 0.18`. This is a deliberate design choice. The product ensures that any single deal-breaker tanks the score, which is exactly the behavior we want.

### 3.1 The Display Transform

The cube-root transform compresses the 0–1 raw score into a 60–95 display range. This is cosmetic — it exists so case managers see numbers that feel like a percentage scale. Job seekers never see numbers at all.

```
// Raw score → Display score mapping:
// raw = 0.00  →  display = 60.0
// raw = 0.10  →  display = 76.2   (below 78 threshold)
// raw = 0.12  →  display = 77.3   (still below)
// raw = 0.13  →  display = 77.7   (borderline)
// raw = 0.14  →  display = 78.2   (passes!)
// raw = 0.50  →  display = 87.8
// raw = 1.00  →  display = 95.0
```

---

## 4. Component Implementation

### 4.1 S — Skill Matching

Weighted mean of evidence values across the occupation's O\*NET skills, weighted by importance.

```typescript
// S component
function computeSkillMatch(evidence: SkillEvidence[], soc: string): number {
  const occSkills = db.query('SELECT * FROM occ_skills WHERE soc_code=$1', soc);

  let numerator = 0;
  let denominator = 0;

  for (const skill of occSkills) {
    const ev = findEvidence(evidence, skill.skill_name);
    const value = ev ? ev.level : 0.25;  // unknown = 0.25 (neutral)
    numerator += skill.importance * value;
    denominator += skill.importance;
  }

  return denominator > 0 ? numerator / denominator : 0.25;
}
```

| Evidence Level | Constant | When to assign |
|---|---|---|
| DIRECT | `1.00` | User holds the exact credential or has verified paid experience |
| ADJACENT | `0.50` | Transferable experience (unpaid caregiving → care skills) |
| UNKNOWN | `0.25` | Question wasn't asked or was skipped |
| CONTRADICTED | `0.00` | User explicitly lacks a mandatory prerequisite (rare) |

### 4.2 I — Interest Alignment

Mean of facet match values. Each occupation has a facet profile stored in `occ_facets`.

```typescript
// I component
function computeInterestAlign(
  prefs: Preference[], soc: string, signals: IntakeSignals
): number {
  const facets = db.query('SELECT * FROM occ_facets WHERE soc_code=$1', soc);
  const occ = db.query('SELECT care_tier FROM occupations WHERE soc_code=$1', soc);

  let total = 0;
  let count = 0;

  for (const facet of facets) {
    const pref = prefs.find(p => p.facet_name === facet.facet_name);
    total += pref ? matchFacet(pref.user_value, facet.facet_value) : 0.50;
    count++;
  }

  let I = count > 0 ? total / count : 0.50;

  // SPECIAL CAP: blood/needles/fluids = 'rather_not' + confirmed
  // caps I at 0.35 for clinical occupations (care_tier 1 or 2)
  if (signals.q2_confirmed_rather_not && occ.care_tier <= 2) {
    I = Math.min(I, 0.35);
  }

  return I;
}

function matchFacet(userVal: string, occVal: string): number {
  if (userVal === occVal) return 1.00;         // aligned
  if (isPartial(userVal, occVal)) return 0.50;  // close enough
  return 0.15;                                  // conflict
}
```

> ⚠️ **Q2 cap is the hardest gate in the system.** Only applied when user says `'rather_not'` AND confirms via the follow-up question. If they reverse ("actually show me those too"), no cap. The confirmation flag is `q2_confirmed_rather_not`, not the raw Q2 answer.

### 4.3 T — Timeline Feasibility

```typescript
// T component
function computeTimeline(
  timeline: {min:number, max:number},
  occ: Occupation, programs: Program[],
  credential: CredentialInfo | null
): number {
  // Find shortest qualifying program
  const eligible = programs.filter(p => p.soc_code === occ.soc_code);
  if (eligible.length === 0) return 0.25;  // no program data

  let trainingMonths: number;
  if (credential?.held && credential.status !== 'active') {
    // Credential holder: use refresher/bridge duration
    trainingMonths = lookupRefresherDuration(occ.soc_code, credential);
  } else {
    trainingMonths = Math.min(...eligible.map(p => p.duration_months));
  }

  const userMidpoint = (timeline.min + timeline.max) / 2;
  const ratio = trainingMonths / userMidpoint;

  if (ratio <= 1.0) return 1.00;
  if (ratio <= 1.5) return 0.70;
  if (ratio <= 2.0) return 0.40;
  return 0.20;
}
```

### 4.4 H, G, E, D — Quick Reference

| Component | Returns | Key Logic | Edge Case |
|---|---|---|---|
| **H** (Schedule) | 0.3 – 1.0 | Intersect user shifts with program + job shifts. Full overlap = 1.0, partial = 0.6–0.8, none = 0.3 | If user has care duties (Q19), penalize rotating shifts |
| **G** (Geography) | 0.3 – 1.0 | In-county or online = 1.0, adjacent = 0.6, far = 0.3. Use county lookup from ZIP (C2) | No car + no transit route = add transport flag but DON'T zero out G |
| **E** (Eligibility) | 0.0 – 1.0 | Check licensing rules per SOC against user's education, bg check, credentials. Clear = 1.0, conditional = 0.6, barrier+waiver = 0.25, impossible = 0.0 | E=0.0 is the ONLY hard removal. Log it with reason. |
| **D** (Demand) | 0.25 – 1.0 | Lookup `demand_matrix[soc][county]`. In-demand = 1.0, balanced = 0.7, adjacent only = 0.5, nowhere = 0.25 | In-demand status also unlocks WIOA ITA funding in the P score |

---

## 5. Worked Example: Debug Trace

Walk through this with a debugger set on `scoreOccupation()`. This is the canonical test case.

> **Test persona: Maria**
> 34yo, ZIP 98032 (Kent, King County). 3yr unpaid caregiving, customer service. No credentials, no car. Timeline: 3–6mo. Wants: hands-on, lots of patient contact, fine with blood, steady pace, prefers homes.

### Target occupation: Nursing Assistant (31-1131.00)

```
// Step 1: S component
// === S (Skill Match) ===
// O*NET top skills for 31-1131.00:
//   Active Listening     importance=3.62
//   Service Orientation  importance=3.62
//   Social Perceptive.   importance=3.50
//   Monitoring           importance=3.38
//   Speaking             importance=3.25

// Maria's evidence:
//   3yr caregiving → ADJACENT(0.50) for: Active Listening,
//                     Service Orient., Social Percep., Monitoring
//   Customer service → DIRECT(1.0) for: Speaking

// Calculation:
// S = (3.62*0.50 + 3.62*0.50 + 3.50*0.50 + 3.38*0.50 + 3.25*1.0)
//     / (3.62 + 3.62 + 3.50 + 3.38 + 3.25)
//   = (1.81 + 1.81 + 1.75 + 1.69 + 3.25) / 17.37
//   = 10.31 / 17.37
//
// S = 0.59
```

```
// Step 2: I component
// === I (Interest Alignment) ===
// Facets for 31-1131.00 and Maria's prefs:
//   patient_contact: occ='high',   maria='a_lot'    → 1.00
//   blood_needles:   occ='yes',    maria='fine'     → 1.00
//   pace:            occ='steady', maria='steady'   → 1.00
//   helping_style:   occ='hands_on', maria='hands_on' → 1.00
//   setting:         occ='facility', maria='home'   → 0.50 (partial)
//   physical:        occ='high',   maria='yes'      → 1.00
//
// I = (1.0+1.0+1.0+1.0+0.5+1.0) / 6 = 5.5/6 = 0.833
//
// Q2 cap check: maria.q2 = 'fine', NOT 'rather_not'
//   → no cap applied
//
// I = 0.83
```

```
// Step 3: F sub-components
// === F = T * H * G * E * D ===

// T: shortest CNA program = 3 months.
//    Maria's midpoint = (3+6)/2 = 4.5.
//    ratio = 3/4.5 = 0.67 ≤ 1.0 → T = 1.00

// H: CNA offers day+evening shifts. Maria: day+evening. Full match.
//    H = 1.00

// G: Programs exist in King County. Maria ZIP in King County.
//    G = 1.00  (transport flag set for no-car, but G unaffected)

// E: CNA requires HS diploma (Maria has it). No bg-check flags.
//    E = 1.00

// D: demand_matrix['31-1131.00']['King'] = 'in_demand'
//    D = 1.00

// F = 1.0 * 1.0 * 1.0 * 1.0 * 1.0 = 1.00
```

```
// Step 4: Final assembly
// === Final score ===
// raw   = S * I * F = 0.59 * 0.83 * 1.00 = 0.4897
// display = 60 + 35 * (0.4897)^(1/3)
//         = 60 + 35 * 0.7884
//         = 60 + 27.6 = 87.6

// Checks:
//   display >= 78?  YES (87.6)
//   any component < 0.25?  NO (min is S=0.59)
//   hard_removed?  NO (E != 0)

// RESULT: Nursing Assistant appears in Maria's top-5 cards.
```

### Contrast: RN (29-1141.00) for same user

```
// RN fails on timeline
// S = 0.55 (less direct evidence for RN-level skills)
// I = 0.83 (same preferences apply)
// T: shortest RN program = 24 months (ADN).
//    ratio = 24 / 4.5 = 5.33 > 2.0 → T = 0.20
// H = 1.0, G = 1.0, E = 1.0, D = 1.0
// F = 0.20 * 1.0 * 1.0 * 1.0 * 1.0 = 0.20

// raw = 0.55 * 0.83 * 0.20 = 0.0913
// display = 60 + 35 * (0.0913)^(1/3) = 60 + 35*0.451 = 75.8

// display < 78 → DOES NOT make top cards.
// If q28 = true, appears in Future Path section.
```

> ✅ **This is the multiplication working as designed.** RN is a great long-term match but not actionable in Maria's 3–6 month window. `T=0.20` correctly gates it. If you see this in a bug report ("why isn't RN showing?"), check T first — it's almost always timeline.

---

## 6. Program-Level Ranking (P Score)

Within each occupation card, training programs are ranked by a separate multiplicative formula.

```typescript
// program-ranking.ts
function scoreProgram(
  program: Program, occ: Occupation,
  signals: IntakeSignals, isInDemand: boolean
): number {

  const costFit = computeCostFit(program, isInDemand, signals);
  const durationFit = computeDurationFit(program, occ);
  const distanceFit = computeDistanceFit(program, signals);
  const qualityFit = computeQualityFit(program);

  return costFit * durationFit * distanceFit * qualityFit;
}
```

| Factor | Tiers | Watch Out For |
|---|---|---|
| `costFit` | $0 oop→1.0, ≤$500→0.8, ≤$2k→0.5, more→0.3 | Subtract ITA cap if in-demand + WIOA eligible + ETPL listed. Don't double-count with D. |
| `durationFit` | Shortest=1.0, 1.5×=0.8, 2×=0.6, >2×=0.4 | Relative to shortest qualifying program, NOT absolute months. Absolute is already in T. |
| `distanceFit` | ≤20min→1.0, ≤45→0.7, ≤75→0.4, >→0.2, online→1.0 | Uses travel time by user's mode (car vs transit). No car + no transit = 0.2 + flag. |
| `qualityFit` | Both good→1.0, one weak→0.7, both weak→0.4, no data→0.6 | no data gets 0.6 + a 'data pending' flag. Don't hide programs just because ETPL has no outcomes. |

---

## 7. Display Logic & Thresholds

```typescript
// display-logic.ts
function selectCards(traces: ScoringTrace[], q28: boolean): CardSet {
  // Remove hard-removed occupations (E === 0)
  const viable = traces.filter(t => !t.hard_removed);

  // Sort by raw score descending
  viable.sort((a, b) => b.raw - a.raw);

  const topCards = viable
    .filter(t => t.display >= 78 && !t.any_component_below_floor)
    .slice(0, 5);

  const pathwayCards = viable
    .filter(t => !topCards.includes(t) && t.display >= 70)
    .slice(0, 3);

  const futurePath = q28 ? viable
    .filter(t => t.components.S >= 0.40 && t.components.I >= 0.60
              && t.components.T <= 0.40 && t.display < 78)
    .slice(0, 5) : [];

  const ruledOut = traces
    .filter(t => t.hard_removed)
    .map(t => ({ soc: t.soc_code, reason: t.removal_reason }));

  return { topCards, pathwayCards, futurePath, ruledOut };
}
```

| Category | Criteria | Shown To |
|---|---|---|
| **Top cards** | `display >= 78` AND no component < 0.25, up to 5 | Job seeker (via case manager) |
| **Pathway cards** | display 70–77, not top-5 | Case manager only |
| **Future Path** | Strong S+I but low T, only if Q28=yes | Job seeker (labeled "longer-term") |
| **Ruled out** | E=0 or user-confirmed preference cut | Audit log + case manager |

---

## 8. LLM Integration & Guardrails

The LLM (Azure OpenAI, gpt-4o or similar) is used in exactly one place: generating natural-language card explanation text, validated against the scoring trace in the display layer. The LLM has read-only access to scoring data and cannot modify, reorder, or suppress results.

### 8.1 Card Text Validation

```typescript
// card-validator.ts
function validateCardText(
  llmText: string, trace: ScoringTrace
): string {
  // Extract claims from LLM text
  const claims = extractClaims(llmText);

  for (const claim of claims) {
    if (!traceSupports(claim, trace)) {
      // Claim not backed by scoring data → replace with template
      return generateTemplateText(trace);
    }
  }
  return llmText;  // all claims validated
}

// Example claims the LLM might make that MUST be in the trace:
// 'Your caregiving experience is a strong match'
//    → check: trace.skill_evidence contains ADJACENT or DIRECT
// 'This program is in your county'
//    → check: trace.components.G === 1.0
// 'This career is in high demand in King County'
//    → check: trace.components.D === 1.0
```

> 🚨 **If validation fails, ALWAYS fall back to templated text.** Never show unvalidated LLM output to users. The template is boring but correct. Log the validation failure for review. This is a hard rule, not a suggestion.

---

## 9. Testing Strategy & Edge Cases

### 9.1 Unit Test Targets

Each component function should have its own test file. Here are the must-have test cases:

| Component | Test Case | Expected |
|---|---|---|
| S | All skills unknown (fresh user, no answers) | S = 0.25 (all default) |
| I | Q2 = `'rather_not'` + confirmed, clinical occ | I capped at 0.35 |
| I | Q2 = `'rather_not'` + reversed ("show me those") | No cap applied |
| I | All preferences skipped | I = 0.50 (all neutral) |
| T | Credential holder with lapsed CNA | Use refresher (2wk), not full (6mo) |
| T | No programs in DB for SOC | T = 0.25 (fail-open, don't crash) |
| E | SOC requires license + user has bg check flag | E = 0.25 (barrier + waiver), NOT 0.0 |
| E | SOC has categorical legal bar | E = 0.0, `hard_removed = true`, reason logged |
| G | User ZIP resolves to no county match | G = 0.30 (relocation), not error |
| D | SOC/county combo missing from `demand_matrix` | D = 0.25 (default), not crash |
| Display | Exactly 78.0 display score | Included in top cards (`>=` not `>`) |
| Display | 5 cards at 90+, one at 78.5 | Only top 5 shown, 6th excluded |
| Display | Score 85 but one component = 0.20 | Excluded (floor rule) |

### 9.2 Integration Test: Full Pipeline

```typescript
// scoring-engine.test.ts
describe('Maria canonical test case', () => {
  const maria = loadFixture('maria.json');

  it('scores CNA at 87.6 display', () => {
    const trace = scoreOccupation(maria.signals, cna, programs, demand);
    expect(trace.components.S).toBeCloseTo(0.59, 2);
    expect(trace.components.I).toBeCloseTo(0.83, 2);
    expect(trace.F).toBeCloseTo(1.00, 2);
    expect(trace.display).toBeCloseTo(87.6, 1);
    expect(trace.hard_removed).toBe(false);
  });

  it('rejects RN on timeline', () => {
    const trace = scoreOccupation(maria.signals, rn, programs, demand);
    expect(trace.components.T).toBe(0.20);
    expect(trace.display).toBeLessThan(78);
  });

  it('deterministic across runs', () => {
    const a = scoreOccupation(maria.signals, cna, programs, demand);
    const b = scoreOccupation(maria.signals, cna, programs, demand);
    expect(a).toEqual(b);  // exact same output
  });
});
```

---

## 10. Common Pitfalls & FAQs

### Pitfalls

| Mistake | Why It's Wrong | Correct Approach |
|---|---|---|
| Using weighted sum instead of product | A high I masks a fatal T. User gets shown a job they can't start for 4 years. | Always multiply. One bad factor must tank the score. |
| Setting unknown skill to 0.0 | Punishes users who skip questions. Sparse profiles get empty results. | Unknown = 0.25. Skipping widens results, doesn't narrow them. |
| Hard-removing on E = 0.25 | That's a barrier with waiver path, not a hard block. User might qualify with documentation. | Only E = 0.00 triggers hard removal. Everything else soft-gates. |
| Using absolute duration in P score | Double-counts timeline penalty already captured in T. | `P.durationFit` uses relative position vs shortest qualifying program. |
| Showing display scores to job seekers | Numbers create false precision. "88 vs 85" feels meaningful but isn't. | Job seekers see ranked cards + reason bullets, never numbers. |
| Capping I on Q2=`'could_learn'` | Only `'rather_not'` + confirmed triggers the cap. `'could_learn'` is explicitly neutral. | Check `q2_confirmed_rather_not` flag, not raw Q2 answer. |
| Skipping validation on LLM card text | LLM might claim "high demand" for a balanced-market SOC. | Always run `validateCardText()`. Fall back to template on failure. |
| Averaging F sub-components | G=1.0 + E=0.0 averages to 0.5 — hides a hard-remove. | `F = T*H*G*E*D`. E=0.0 zeros out F, triggering removal. |
| Not logging hard removals | Case manager can't explain why a job isn't showing. | Every E=0.0 removal gets `{ soc, reason, timestamp, input_values }`. |

### FAQ

#### "Why not use ML to learn the weights?"

Because we don't have outcome data yet. The system ships with flat weights (all exponents = 1.0) stored as config. Once pilot data shows which components are over/under-weighted, we can tune. Premature optimization with no ground truth is worse than a transparent, auditable formula. The config-driven approach means tuning is a database update, not a code deploy.

#### "What if a user fits zero occupations?"

This shouldn't happen with the floor defaults (0.25 for unknowns). If it does, the system triggers the circuit-breaker: show broad results and flag for case-manager review. The 12-question cap exists for this reason — if we've asked 12 questions and still can't narrow, human judgment takes over.

#### "Can I add a new occupation?"

Yes. Insert into `occupations`, populate `occ_skills` (from O\*NET API) and `occ_facets` (product team defines these). Add programs from ETPL. Add a `demand_matrix` row. No code changes needed — the engine scores any SOC that has data.

#### "How do I test a scoring change locally?"

Run the Maria fixture (`maria.json`) through the scoring function and assert against the canonical values (S=0.59, I=0.83, T=1.0, display=87.6). If your change moves Maria's CNA score, you've changed core behavior — document why in the PR.

---

*This is a living document. If you find a case the engine handles wrong, add it to the test suite and update this doc. The scoring engine is only as good as its test coverage.*
