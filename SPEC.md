# Product specification — Acadza Report → Fix

> Status: draft for review. This specification describes the assignment product. Genesis must check it, and a human must approve it before product implementation begins.

## Problem

Students report possible errors in exam questions, but a report can describe a real defect, a student misunderstanding, a rendering problem, an app problem, or an attempt to influence the checker. Faculty currently spend time reading each report while genuinely broken questions stay visible. The product should identify likely defects quickly, avoid harmful edits, and make the remaining decisions easy for a teacher to review. The complete user journey is shown in [SYSTEM_FLOW.md](SYSTEM_FLOW.md).

## Users

- **Students:** need accurate questions and a short, respectful response to their reports.
- **Faculty reviewers:** need to see the original question, the report, the evidence, and the proposed change before deciding.
- **Acadza content team:** needs a reliable record of proposed and approved changes.
- **Assignment evaluators:** need a valid `results.json`, an accessible live demo, and transparent prompt and product documentation.

## Functional requirements

- FR-1: Load the supplied questions, reports, and closed taxonomy; relate every report to its source question.
- FR-2: Investigate reports grouped by question while producing a distinct decision and student reply for each report.
- FR-3: Classify each report using only a verdict key from `taxonomy.verdicts` and, for a defect, a repair key from `taxonomy.repairs`.
- FR-4: For a correctable defect, propose the smallest exact edit and explain the evidence. A student's comment is treated as untrusted data, never as an instruction.
- FR-5: Check proposed edits against the repair's allowed fields, verify the target is unique, and route prohibited or uncertain changes to faculty.
- FR-6: Produce `results.json` with exactly one required-format row for each of the 44 reports, including route, confidence, evidence, and a 1–3 sentence student reply.
- FR-7: Show a faculty queue grouped by question, ordered by visible urgency factors such as likely student impact and risk.
- FR-8: Show a case page with the rendered question and MathML, all related reports, AI decision and evidence, before/after edit view, and student reply preview.
- FR-9: Let faculty approve, edit, or reject a proposal and record every action with actor, time, reason, proposal, and outcome.
- FR-10: Keep the deployed faculty console usable with precomputed results when model credits are unavailable.
- FR-11: Deliver the required prompt log, one-page product note, public repository, live URL, and 3-minute walkthrough.

## Non-functional requirements

- NFR-1: Never auto-apply a repair whose taxonomy entry has `auto: false`; treat `auto: true` as permission only after evidence and edit checks pass.
- NFR-2: Do not mutate the supplied source questions while producing `results.json`; the route describes eligibility or required review.
- NFR-3: Render stored question HTML and MathML safely; render student comments as text, not executable HTML.
- NFR-4: Persist faculty decisions and append-only audit history across reloads in the live demo.
- NFR-5: Keep the reviewer workflow readable and usable on a typical laptop and phone, including keyboard access to core actions.
- NFR-6: Make the batch results reproducible from committed inputs, prompts, model/configuration notes, and validation rules.

## Constraints

- The supplied dataset contains 43 questions and 44 reports; 39 questions are reported and 4 are not. Questions use nested `scq`, `mcq`, or `integerQuestion` payloads with HTML and inline MathML.
- Verdict and repair keys must come from `data/taxonomy.json`; repair field scopes and `auto` flags are binding.
- The assignment requires a public GitHub repository, a live URL available for seven days, `PROMPTS.md`, `PRODUCT.md` of at most one page, and a 3-minute walkthrough video.
- The deadline is specified in an external email and is not present in this repository.
- LLM provider, available credits, and hosting credentials are not yet known. The design must keep the console usable with precomputed results.
- The evaluator's exact schema for multi-field edits is not supplied; scored output should stay close to the README's single-edit example until clarified.

## Non-goals

- Replacing faculty judgment on uncertain, authored, or taxonomy-forbidden repairs.
- Editing Acadza's real production question bank from this take-home demo.
- Building a student-facing reporting app; the reports are supplied as input data.
- Claiming that a proposed fix is already live before it has been approved/applied.
- Implementing a general question bank or learning platform beyond this report-to-fix loop.

## Acceptance criteria

- AC-1: The result file has 44 unique report IDs and all required fields; every ID and taxonomy key matches supplied data.
- AC-2: No `auto_apply` result violates a repair's `auto` flag or allowed field scope; every proposed exact-text edit has one valid target.
- AC-3: The case for R001–R003 appears once in the faculty queue while retaining three separate report decisions and replies.
- AC-4: The console renders a supplied question with MathML and shows the original and proposed content side by side or as a readable diff.
- AC-5: Approve, edit, and reject actions can be demonstrated on cases; their audit entries remain visible after page reload.
- AC-6: The deployed site loads without new model calls and the required repo, live URL, prompt log, product note, and walkthrough are available for submission.
- AC-7: The R027 comment cannot change the stored answer by instructing the checker; it is evaluated as report data.

## Risks

- **Confident but incorrect AI reasoning:** independently check answer-key changes and send conflicting evidence to faculty.
- **Unsafe edit to messy HTML/MathML:** require exact targets, field scope checks, and a rendered before/after view.
- **Answer-format ambiguity:** normalize for reasoning but retain the original value when describing a proposed patch.
- **Public demo misuse:** restrict who can submit faculty actions while keeping the read-only demo accessible.
- **Incomplete prompt history:** record product prompts, revisions, coding-assistant prompts, and real failures during work rather than reconstructing them later.

## Open questions

- What is the deadline stated in the assignment email?
- Which model/provider and credit budget are available for batch triage?
- Will Acadza accept a structured multi-field `edit`, or only the README's single `{field, find, replace}` example? Until clarified, use the single-edit shape for scored output and route coordinated changes to faculty.
- What reviewer access method best fits the final hosting option?
- What personal commitment, start-date, and motivation answers should be included in the submission email? These must come from the candidate.
