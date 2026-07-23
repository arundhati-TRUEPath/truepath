# TRUEPath Navigator — v1 Intake Question Bank

All questions, keys, choice values, and display labels from the condensed primary sequence. Questions are listed in ask order, grouped by the spec's five Parts.

---

## Part 1 — Where You're Starting

### Q1 · `situation`
**"Which sounds most like you right now?"**
*This helps us understand your starting point.*

| Value | Label |
|---|---|
| `student` | Student or new to work |
| `change` | Working, but want a change |
| `caregiving` | Caregiving or returning to work |
| `unemployed` | Unemployed and need income soon |

### (Location — `location`)
ZIP / county captured outside the question bank via `POST /sessions/{id}/location`. No Question entry; sourced by the router as `session.county`.

### Q2 · `timeline`
**"How soon do you need to be earning?"**
*Some healthcare jobs take three weeks of training, some take two years — this narrows it fast.*

| Value | Label |
|---|---|
| `lt3m` | Less than 3 months |
| `3to6m` | 3 to 6 months |
| `6to12m` | 6 to 12 months |
| `norush` | No rush |

### Q3 · `credentials`  *(multi-select)*
**"Do you already have any healthcare credentials?"**
*If you have already trained once, we will not send you back to square one.*

- Component: `credentials`
- Options are **data-sourced** from `reference.credential`, grouped by tier (no hardcoded choices).

---

## Part 2 — What Kind of Work Fits You

### Q4 · `helping_style`
**"Which helping style sounds most like you?"**
*Healthcare has all four — this is the biggest fork in the road.*

| Value | Label |
|---|---|
| `hands_on` | Hands-on care for people |
| `organizing` | Organizing information and records |
| `technical` | Precise technical work with equipment or samples |
| `supporting` | Talking with and supporting people |

### Q5 · `patient_contact`
**"How much direct patient contact do you want?"**
*There is no wrong answer — plenty of great roles have little or none.*

| Value | Label |
|---|---|
| `a_lot` | A lot |
| `some` | Some |
| `behind_scenes` | Prefer behind-the-scenes |

### Q6 · `blood_needles`
**"How do you feel about blood, needles, and bodily fluids?"**
*Honest answer — plenty of great healthcare jobs never go near any of it.*

| Value | Label |
|---|---|
| `fine` | Fine with it |
| `could_learn` | Could learn to be |
| `rather_not` | Would rather not |

### Q7 · `pace`
**"Which pace suits you better?"**
*Some roles are fast and unpredictable, others steady and routine.*

| Value | Label |
|---|---|
| `fast` | Fast and unpredictable |
| `steady` | Steady and routine |

### Q8 · `setting`
**"Where would you rather work?"**
*Setting shapes the day-to-day as much as the job title.*

| Value | Label |
|---|---|
| `hospital` | Hospital |
| `clinic` | Clinic or office |
| `home` | People's homes |
| `remote` | Remote / from home |
| `field` | Out in the field |

---

## Part 3 — What You Bring

### Q9 · `experiences`  *(multi-select)*
**"Have you done any of these — paid or unpaid?"**
*Unpaid experience counts. Caring for a parent for three years is real experience.*

| Value | Label |
|---|---|
| `caregiving` | Cared for a family member, children, or someone ill or elderly |
| `customer_service` | Customer service, front desk, or retail |
| `warehouse` | Warehouse, inventory, or assembly work |
| `healthcare_exposure` | Volunteering or personal experience in healthcare settings |
| `none` | None of these |

### Q10 · `education`
**"What is your highest level of education?"**
*A GED works the same as a high-school diploma for most pathways.*

| Value | Label |
|---|---|
| `none` | No diploma yet |
| `hs` | High school / GED |
| `cert` | Certificate / certification (CNA, CDL, etc.) |
| `some` | Some college, no degree |
| `aa` | Associate degree |
| `ba` | Bachelor's degree |
| `grad` | Graduate degree |
| `intl` | Degree earned outside the U.S. |

### Q11 · `foreign_degree_level`  *(conditional)*
**"What level was that degree?"**
*This helps us match roles to your degree; a case manager can guide U.S. recognition.*

> **Show when:** `education` == `intl`

| Value | Label |
|---|---|
| `bachelor` | Bachelor's level |
| `master` | Master's level |
| `doctoral` | Doctoral or professional (e.g. MD, PhD) |

---

## Part 4 — Practical Details

### Q12 · `shifts`  *(multi-select)*
**"Which shifts can you realistically work?"**
*Roles differ a lot on when the work happens.*

| Value | Label |
|---|---|
| `days` | Days only |
| `evenings` | Evenings OK |
| `nights` | Nights OK |
| `weekends` | Weekends OK |
| `rotating` | Rotating OK |

### Q13 · `childcare`
**"Do childcare or caregiving responsibilities shape your hours?"**
*This helps us flag support and pick schedules that fit.*

| Value | Label |
|---|---|
| `yes` | Yes |
| `no` | No |

Component: `yesno`

### Q14 · `physical`
**"Could you be on your feet eight hours and lift 50 lbs?"**
*Some roles are physical; many are not.*

| Value | Label |
|---|---|
| `yes` | Yes |
| `some_limits` | Some limits |
| `no` | No |

### Q15 · `vehicle`
**"Do you have a driver's license and reliable vehicle?"**
*This affects which programs and jobs are reachable.*

| Value | Label |
|---|---|
| `yes` | Yes |
| `license_no_vehicle` | License, no reliable vehicle |
| `neither` | Neither |

### Q16 · `english`  *(conditional)*
**"How comfortable are you using English in fast or medical settings?"**
*This never lowers your matches; it helps us find roles where the fit is right.*

> **Show when:** `patient_contact` ∈ {`a_lot`, `some`}

| Value | Label |
|---|---|
| `basic` | Basic |
| `conversational` | Conversational |
| `professional` | Professional |

### Q17 · `supports`  *(multi-select · sensitive)*
**"Would any of these help you finish training?"**
*These never affect your matches; they help your case manager line up support.*

> ⚠️ **Sensitive flag:** excluded from occupation scoring.

| Value | Label |
|---|---|
| `transportation` | Transportation |
| `childcare` | Childcare |
| `financial` | Help with funding |
| `none` | None |

---

## Part 5 — Last Couple of Questions

### Q18 · `growth_stability`
**"Right now, which matters more?"**
*Both are valid — it just changes how we order the options.*

| Value | Label |
|---|---|
| `stable` | A stable job as fast as possible |
| `growth` | A path that grows, even if it takes longer |

### Q19 · `future_path`
**"Want to also see careers you could work toward later, with more training?"**
*Optional — it just adds a longer-term section; it changes nothing else.*

| Value | Label |
|---|---|
| `yes` | Yes, show me |
| `no` | No, just what I can start now |

Component: `yesno`

---

## Notes

- **Skipped from v1 MVP:** Q17 (free text), Q10 (background), Q12 (pay floor), and finer interest facets Q14/Q16/Q22/Q23 (score neutral per the engine's unknowns rule).
- **Conditional questions:** `foreign_degree_level` (Q11) and `english` (Q16) are gated by prior answers.
- **Question keys = AnswerContract field names** — answers map to the contract with no translation.
- **Cluster-elimination branching** (spec Part 1 conditional bank) is deferred to the "AI router" phase.
