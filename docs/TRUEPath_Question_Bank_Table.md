# TRUEPath Navigator — v1 Intake Question Bank Table

All questions, keys, answer values, and display labels in table format.

---

## Part 1 — Where You're Starting

| Q# | Key | Question | Helper Text | Value | Label | Type | Condition |
|---|---|---|---|---|---|---|---|
| Q1 | `situation` | Which sounds most like you right now? | This helps us understand your starting point. | `student` | Student or new to work | single_select | — |
| | | | | `change` | Working, but want a change | | |
| | | | | `caregiving` | Caregiving or returning to work | | |
| | | | | `unemployed` | Unemployed and need income soon | | |
| — | `location` | ZIP / county | Captured outside question bank via `POST /sessions/{id}/location`. | — | — | API / router | — |
| Q2 | `timeline` | How soon do you need to be earning? | Some healthcare jobs take three weeks of training, some take two years — this narrows it fast. | `lt3m` | Less than 3 months | single_select | — |
| | | | | `3to6m` | 3 to 6 months | | |
| | | | | `6to12m` | 6 to 12 months | | |
| | | | | `norush` | No rush | | |
| Q3 | `credentials` | Do you already have any healthcare credentials? | If you have already trained once, we will not send you back to square one. | — | Options data-sourced from `reference.credential`, grouped by tier | multi_select | — |

---

## Part 2 — What Kind of Work Fits You

| Q# | Key | Question | Helper Text | Value | Label | Type | Condition |
|---|---|---|---|---|---|---|---|
| Q4 | `helping_style` | Which helping style sounds most like you? | Healthcare has all four — this is the biggest fork in the road. | `hands_on` | Hands-on care for people | single_select | — |
| | | | | `organizing` | Organizing information and records | | |
| | | | | `technical` | Precise technical work with equipment or samples | | |
| | | | | `supporting` | Talking with and supporting people | | |
| Q5 | `patient_contact` | How much direct patient contact do you want? | There is no wrong answer — plenty of great roles have little or none. | `a_lot` | A lot | single_select | — |
| | | | | `some` | Some | | |
| | | | | `behind_scenes` | Prefer behind-the-scenes | | |
| Q6 | `blood_needles` | How do you feel about blood, needles, and bodily fluids? | Honest answer — plenty of great healthcare jobs never go near any of it. | `fine` | Fine with it | single_select | — |
| | | | | `could_learn` | Could learn to be | | |
| | | | | `rather_not` | Would rather not | | |
| Q7 | `pace` | Which pace suits you better? | Some roles are fast and unpredictable, others steady and routine. | `fast` | Fast and unpredictable | single_select | — |
| | | | | `steady` | Steady and routine | | |
| Q8 | `setting` | Where would you rather work? | Setting shapes the day-to-day as much as the job title. | `hospital` | Hospital | single_select | — |
| | | | | `clinic` | Clinic or office | | |
| | | | | `home` | People's homes | | |
| | | | | `remote` | Remote / from home | | |
| | | | | `field` | Out in the field | | |

---

## Part 3 — What You Bring

| Q# | Key | Question | Helper Text | Value | Label | Type | Condition |
|---|---|---|---|---|---|---|---|
| Q9 | `experiences` | Have you done any of these — paid or unpaid? | Unpaid experience counts. Caring for a parent for three years is real experience. | `caregiving` | Cared for a family member, children, or someone ill or elderly | multi_select | — |
| | | | | `customer_service` | Customer service, front desk, or retail | | |
| | | | | `warehouse` | Warehouse, inventory, or assembly work | | |
| | | | | `healthcare_exposure` | Volunteering or personal experience in healthcare settings | | |
| | | | | `none` | None of these | | |
| Q10 | `education` | What is your highest level of education? | A GED works the same as a high-school diploma for most pathways. | `none` | No diploma yet | single_select | — |
| | | | | `hs` | High school / GED | | |
| | | | | `cert` | Certificate / certification (CNA, CDL, etc.) | | |
| | | | | `some` | Some college, no degree | | |
| | | | | `aa` | Associate degree | | |
| | | | | `ba` | Bachelor's degree | | |
| | | | | `grad` | Graduate degree | | |
| | | | | `intl` | Degree earned outside the U.S. | | |
| Q11 | `foreign_degree_level` | What level was that degree? | This helps us match roles to your degree; a case manager can guide U.S. recognition. | `bachelor` | Bachelor's level | single_select | `education == intl` |
| | | | | `master` | Master's level | | |
| | | | | `doctoral` | Doctoral or professional (e.g. MD, PhD) | | |

---

## Part 4 — Practical Details

| Q# | Key | Question | Helper Text | Value | Label | Type | Condition |
|---|---|---|---|---|---|---|---|
| Q12 | `shifts` | Which shifts can you realistically work? | Roles differ a lot on when the work happens. | `days` | Days only | multi_select | — |
| | | | | `evenings` | Evenings OK | | |
| | | | | `nights` | Nights OK | | |
| | | | | `weekends` | Weekends OK | | |
| | | | | `rotating` | Rotating OK | | |
| Q13 | `childcare` | Do childcare or caregiving responsibilities shape your hours? | This helps us flag support and pick schedules that fit. | `yes` | Yes | yesno | — |
| | | | | `no` | No | | |
| Q14 | `physical` | Could you be on your feet eight hours and lift 50 lbs? | Some roles are physical; many are not. | `yes` | Yes | single_select | — |
| | | | | `some_limits` | Some limits | | |
| | | | | `no` | No | | |
| Q15 | `vehicle` | Do you have a driver's license and reliable vehicle? | This affects which programs and jobs are reachable. | `yes` | Yes | single_select | — |
| | | | | `license_no_vehicle` | License, no reliable vehicle | | |
| | | | | `neither` | Neither | | |
| Q16 | `english` | How comfortable are you using English in fast or medical settings? | This never lowers your matches; it helps us find roles where the fit is right. | `basic` | Basic | single_select | `patient_contact ∈ {a_lot, some}` |
| | | | | `conversational` | Conversational | | |
| | | | | `professional` | Professional | | |
| Q17 | `supports` | Would any of these help you finish training? | These never affect your matches; they help your case manager line up support. ⚠️ Sensitive: excluded from scoring. | `transportation` | Transportation | multi_select (sensitive) | — |
| | | | | `childcare` | Childcare | | |
| | | | | `financial` | Help with funding | | |
| | | | | `none` | None | | |

---

## Part 5 — Last Couple of Questions

| Q# | Key | Question | Helper Text | Value | Label | Type | Condition |
|---|---|---|---|---|---|---|---|
| Q18 | `growth_stability` | Right now, which matters more? | Both are valid — it just changes how we order the options. | `stable` | A stable job as fast as possible | single_select | — |
| | | | | `growth` | A path that grows, even if it takes longer | | |
| Q19 | `future_path` | Want to also see careers you could work toward later, with more training? | Optional — it just adds a longer-term section; it changes nothing else. | `yes` | Yes, show me | yesno | — |
| | | | | `no` | No, just what I can start now | | |
