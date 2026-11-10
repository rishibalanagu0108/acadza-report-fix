# Acadza Review Desk — faculty console design

**Status:** Design direction for Milestone 4. This document defines the screen before UI implementation.

## Reference and product idea

Use the [Sanity design analysis on getdesign.md](https://getdesign.md/sanity/design-md) as a **visual reference**: content gets the most space, labels are quiet and precise, surfaces are restrained, and one warm accent draws attention to the next action. This is our own review workflow, not a copy of Sanity's site, logo, or screen.

The console should feel like a **teacher's review desk**. The question is the document on the desk. Reports and evidence are annotations. The decision controls are close by. This gives the product a clear identity without a generic dashboard of equal-sized cards.

## Main screen

On a laptop, use three working areas below a slim header:

| Area | Purpose | Starting width |
|---|---|---:|
| Dark case queue | Find the next question; see urgency, report count, and state | 260–300 px |
| Light question canvas | Read the original question and solution, reports, evidence, and proposed change | Remaining width, at least 480 px when possible |
| Decision rail | Check the proposed outcome and student reply; approve, edit, or reject | 300–340 px |

The dark queue and paper-like reading area make the parts easy to tell apart. Use thin separators, a generous reading column, and a few strong headings. Avoid a grid of decorative metric cards. The right rail stays visible while reading long questions on wide screens.

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ACADZA / REVIEW DESK             Pending  •  Reviewed                 Reviewer  │
├──────────────────────┬────────────────────────────────────┬──────────────────────┤
│ CASE QUEUE           │ QUESTION Q012                      │ DECISION             │
│ Search + filters     │ Subject / chapter / type           │ Faculty review       │
│                      │                                    │ AI verdict + reason  │
│ ● Q012  3 reports    │ Original question + options        │ Confidence + caveat  │
│   Answer disputed    │ Math and images in reading order   │                      │
│                      │                                    │ Proposed edit        │
│ ○ Q019  2 reports    │ Reports and observed issue         │ Before → after       │
│   Solution mismatch  │ Evidence and independent check     │                      │
│                      │                                    │ Student reply        │
│ ○ Q027  1 report     │ Full rendered proposed preview     │ Preview              │
│   Needs review       │                                    │                      │
│                      │ Decision history                   │ Approve Edit Reject  │
└──────────────────────┴────────────────────────────────────┴──────────────────────┘
```

This is a layout sketch, not the system architecture. The decision flow remains in [SYSTEM_FLOW.md](SYSTEM_FLOW.md).

## What a teacher sees and does

1. **Pick a case.** Each queue row shows question ID, short issue label, number of reports, review state, and one visible urgency reason. Keep filters for pending, decided, and route; do not use report count as proof of a defect.
2. **Read the source.** Render the question, choices, answer, and solution in their original order. Preserve allowed MathML and image references. Show student comments as plain text.
3. **Check the evidence.** Put the AI verdict next to a short, specific explanation and any independent check. Show uncertainty plainly; a confidence number alone is insufficient.
4. **Compare the correction.** Label the target field and show the exact before/after text with changed words highlighted. A rendered preview lets the teacher check the whole question, including math and surrounding context.
5. **Decide.** Keep Approve, Edit, and Reject together in the rail. Require a reason for edits and rejections. Show what the student reply will say before saving. After a decision, show actor, time, outcome, and reason in the history.

For cases with no proposed edit, replace the diff with a clear “No question change proposed” state and the explanation. Never show an enabled Approve action for a patch that failed validation. A case with several reports keeps the reports and individual replies visible even though it has one queue entry.

## Visual rules

| Token | Color | Use |
|---|---|---|
| `shell` | `#111315` | Header and queue |
| `darkSurface` | `#212427` | Selected queue row and dark controls |
| `paper` | `#FCFBF8` | Question reading surface |
| `canvas` | `#F2F0EC` | Space around the paper and rail |
| `ink` | `#202322` | Main text |
| `muted` | `#626A68` | Metadata |
| `line` | `#DEDCD6` | Hairline dividers |
| `coral` | `#F36458` | Selected case marker and primary decision action |
| `amber` | `#9A6417` | Needs review / uncertainty |
| `teal` | `#087C6F` | Verified / approved state |
| `red` | `#B83B3B` | Rejected / failed validation |

Use coral sparingly so it retains meaning. Every state must have a written label and, where useful, an icon; color is a second cue. For `no_change`, use a neutral slate label. Keep errors and destructive decisions distinct from the coral primary action.

Use **IBM Plex Sans** for interface text, **IBM Plex Mono** for case IDs, field names, and small labels, and a readable serif such as **Source Serif 4** for the question body if it renders the supplied material well. Keep body text comfortably readable (at least 16 px in the reading area), with sensible line length and strong focus indicators. Use square or lightly rounded corners (about 4–6 px) and mostly flat surfaces; do not rely on heavy shadows or gradients.

## Responsive behavior

- **Wide desktop:** all three areas visible; queue and decision rail may stay in place while the question scrolls.
- **Typical laptop:** keep the question readable first. Allow the queue to collapse to a compact list button; the decision rail may become a drawer if the middle area would get cramped.
- **Phone:** show a case list, then one case at a time. Stack Question, Reports, Evidence, Proposed change, Student reply, and Decision in that order. Keep the final decision controls reachable without covering question content.

Keyboard users must be able to move through cases, inspect the diff, choose an action, enter a reason, and submit. Focus and validation errors need visible text. Test supplied MathML and messy HTML in an actual browser before calling the layout complete.

## Tailwind CSS implementation note

Use Tailwind CSS for layout, spacing, typography, responsive breakpoints, and state styles. Define the colors above as theme tokens rather than scattering hex values through components. Keep custom CSS small and limited to the sanitized question/MathML content where utility classes cannot describe the source markup. Build real workflow components—queue row, question view, evidence block, diff, reply preview, and decision rail—rather than a reusable decorative card system.

## Milestone 4 acceptance

- A teacher can tell within a few seconds which case needs attention and why.
- The original question, all reports, evidence, exact change, and student reply are visible without switching to unrelated screens.
- Approve, Edit, and Reject are clear, keyboard usable, and persist with an audit entry.
- MathML, long questions, and malformed source HTML remain readable on laptop and phone.
- The console is visually recognizable as Acadza Review Desk while following the restraint and content hierarchy of the reference.
