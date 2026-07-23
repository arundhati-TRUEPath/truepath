# Dynamic Bisectional Questioning Engine — TRUEPath Navigator

**How it works in 10 lines:**

1. We start with 147 healthcare occupations on the table.
2. Every question the user answers eliminates occupations that don't fit — this is what "bisectional" means. Each answer cuts away careers that conflict with what the user just told us.
3. Instead of asking the same fixed list of questions to everyone, the system looks at which occupations are still alive after each answer and picks the next question that will eliminate the most irrelevant ones.
4. The system draws from a bank of 50 questions but most users only answer 6–8 because occupations get eliminated fast when questions are chosen smartly.
5. Four anchor questions always come first (situation, ZIP code, timeline, credential status) because they eliminate the most occupations upfront — timeline alone can knock out 60% of the list.
6. After the anchors, every next question is chosen dynamically: if the user said "hands-on care," the system asks about blood/needles next because that answer eliminates the most remaining roles in that cluster — not about computer skills, which would eliminate nothing useful at that point.
7. The scoring model (S × I × F) stays exactly the same — we are only changing which questions get asked and in what order, not how careers are scored.
8. The full 50-question bank is fed to the LLM as context. After each user answer, the LLM sees what was asked, what was answered, which occupations remain, and picks the best follow-up question from the bank — or generates a new question if nothing in the bank fits the current situation.
9. Safety rails: if one answer would wipe out an entire career cluster, the system asks "Are you sure?" before eliminating. There is a floor of 8 occupations — the system will not narrow below that without showing results. A 12-question cap acts as a hard stop.
10. The user never sees any of this machinery — they just experience a short, personalized conversation where every question feels relevant because it is.

---

## LLM Approach — How the LLM Drives Question Selection

### How it works

The LLM is the brain of the intake. It receives three things in its context on every turn:

1. **The full 50-question bank** — all questions, their answer choices, and which occupations each answer eliminates.
2. **The conversation so far** — every question asked and every answer the user gave.
3. **The remaining occupation list** — which of the 147 careers are still viable after the answers given so far.

With this context, the LLM does one of two things:

- **Pick from the bank:** Select the question from the 50-question bank that will eliminate the most remaining occupations based on what the user has already told us.
- **Generate a new question:** If none of the remaining bank questions would meaningfully separate the remaining occupations — for example, the user is stuck between two very similar roles and no bank question distinguishes them — the LLM generates a new, targeted question on the fly to break the tie.

### When the LLM picks from the bank vs. generates a new question

| Situation | What the LLM does | Example |
|---|---|---|
| A bank question clearly separates the remaining occupations | Picks from bank | 30 clinical roles remain. Q2 (blood/needles) splits them into 18 and 12. LLM picks Q2. |
| Multiple bank questions are useful | Picks the best one from bank | 15 roles remain across two clusters. Q22 (precision tasks) and Q14 (crisis comfort) both help. LLM picks whichever eliminates more. |
| No bank question separates the remaining occupations well | Generates a new question | User is stuck between Medical Lab Technician and Histotechnologist. No bank question distinguishes them. LLM generates: "Do you prefer working with patient samples under a microscope all day, or a mix of microscope work and running lab instruments?" |
| Remaining occupations span a gap the bank did not anticipate | Generates a new question | User's answers point toward both dental hygiene and radiology tech — two unrelated clusters that survived together. No bank question targets this specific fork. LLM generates: "Would you rather work inside a patient's mouth or operate imaging equipment from behind a screen?" |
| User gave an unusual answer combination | Generates a new question | User wants hands-on care, no blood, fast pace, and remote work. The bank was not designed for this corner case. LLM generates a question to clarify which constraint matters most. |

### What the LLM does on each turn

| Step | What happens |
|---|---|
| User answers a question | Answer is recorded. Occupations that conflict with that answer are eliminated from the remaining list. |
| LLM receives updated context | The LLM sees: the 50-question bank, the conversation history, and the updated list of remaining occupations. |
| LLM evaluates the bank | It checks which remaining bank questions would best separate the remaining occupations. |
| If a bank question fits | LLM selects it and rephrases it to sound natural in the conversation flow. |
| If no bank question fits | LLM generates a new question targeted at the specific occupations still in play. The new question must have clear answer choices and each choice must map to specific occupations. |
| LLM phrases it naturally | Whether picked or generated, the question sounds conversational. "Since you're drawn to hands-on care — how do you feel about working around blood and needles?" |
| Scoring engine updates | The answer feeds into S × I × F scoring. Occupations are re-scored. Eliminated occupations are logged with reasons. |

### Rules for LLM-generated questions

When the LLM generates a question not in the bank, it must follow these rules:

- **Must target the remaining occupations.** The question exists to separate careers that are still viable — not to ask something generic.
- **Must have 2–4 clear answer choices.** Each choice must clearly map to a subset of the remaining occupations so the scoring engine knows what to eliminate.
- **Must map to a scoring component.** The LLM must label the generated question as feeding S, I, T, H, G, E, or D so the scoring engine can process the answer.
- **Must include microcopy.** A one-line "why we're asking" explanation, same as bank questions.
- **Cannot ask about sensitive topics.** No questions about background checks, justice system involvement, immigration status, or mental health unless those already exist in the bank with opt-in framing.
- **Gets logged for review.** Every generated question is saved with its reasoning so the product team can review it and decide whether to add it to the bank permanently.

### The feedback loop — growing the bank

LLM-generated questions are not throwaway. They are a signal that the bank has a gap:

1. The LLM generates a new question because nothing in the bank separates Medical Coder from Health Information Technician.
2. That question and the context are logged.
3. The product team reviews generated questions weekly.
4. If the same gap shows up repeatedly, the generated question (or an improved version) gets added to the bank as Q49, Q50, Q51, etc.
5. Over time, the bank grows to cover more edge cases and the LLM needs to generate fewer new questions.

The goal is that the bank starts at 50 and grows organically based on real intake patterns. The LLM handles gaps in the meantime so users never hit a dead end.

### What the LLM prompt looks like

The system prompt sent to the LLM on each turn includes:

- **Role:** "You are a career intake assistant for TRUEPath Navigator. Your job is to find the best healthcare career fit in as few questions as possible."
- **The 50-question bank** with each question's ID, text, answer options, and which occupations each answer eliminates.
- **Rules:** Prefer picking from the bank. Only generate a new question if no bank question would meaningfully separate the remaining occupations. Never generate questions on sensitive topics. Always provide answer choices that map to specific occupations. Label the scoring component. Include microcopy. Respect position constraints (Q17 not before question 7, Q25 near end, Q28 last).
- **Conversation history:** All prior questions and answers.
- **Remaining occupations:** The current viable list with partial scores.
- **Instruction:** "Based on the remaining occupations, select the one question from the bank that will eliminate the most careers regardless of how the user answers. If no bank question meaningfully separates the remaining occupations, generate a new targeted question. Return: question source (bank or generated), question ID (if bank), rephrased text, answer choices with occupation mappings, scoring component, microcopy, and a one-line explanation of why this question is most useful right now."

### Guardrails on the LLM

- **Bank first, generate second.** The LLM only generates when no bank question would meaningfully separate the remaining occupations. This keeps most intakes auditable against the known bank.
- **Scoring is not done by the LLM.** The S × I × F formula runs deterministically after each answer. The LLM selects or generates questions; the math scores occupations.
- **Elimination is rule-based.** When a user answers, which occupations get eliminated or down-weighted follows fixed rules — not LLM judgment.
- **Anchor questions are hardcoded.** C1, C2, C3, Q26 always come first in order. The LLM takes over starting at question 5.
- **Position constraints are enforced.** Even if the LLM thinks Q17 (free text) would be most informative at question 3, the system blocks it until question 7.
- **Confirmation before big cuts.** If the chosen question could wipe out an entire cluster, the system forces a confirmation screen before proceeding.
- **Generated questions are capped.** Maximum 2 LLM-generated questions per intake. If the LLM needs more than 2, that signals the bank has a serious gap — flag for product review.
- **Fallback to deterministic.** If the LLM API is slow (over 2 seconds) or fails, the system falls back to deterministic information-gain calculation to pick the next question from the bank. The user never waits or sees an error.

### LLM cost and performance

| Metric | Estimate |
|---|---|
| Prompt size per turn | ~4,000–6,000 tokens (50 questions + conversation history + occupation list) |
| Response size | ~100–300 tokens (question source + ID + rephrased text + mappings + reasoning) |
| Latency per turn | 500–1,200ms (acceptable for conversational chat) |
| Cost per full intake (8 questions) | ~$0.04–0.08 using Claude Sonnet |
| Generated questions per intake | Expected 0–1 on average, capped at 2 |
| Fallback if LLM fails | Deterministic information-gain calculation (under 50ms) |

**Bottom line:** The 50-question bank is the LLM's primary menu. The user's answers shrink the occupation list. The LLM reads both and picks the best next question from the bank — or generates a new one when the bank does not have a question that fits. Generated questions get logged and reviewed so the bank grows over time. Scoring and elimination stay math-based. The LLM decides what to ask and how to say it.
