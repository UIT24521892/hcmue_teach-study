# Repository Agent Instructions

Before making any change in this repository, read these files completely and follow them in this order:

1. `prompt-website-hoc-tieng-anh.md` — product requirements and design direction.
2. `PROJECT_PLAN.md` — implementation phases, scope and acceptance criteria.
3. `agent.md` — execution workflow, architecture, security and quality rules.

The latest explicit user request takes precedence if instructions conflict. When that request changes product scope or architecture, update the relevant Markdown documents as part of the same change.

Work from the first unfinished item in the active phase unless the user selects another task. Only mark a plan checkbox complete after its implementation and applicable verification are complete.

## Frontend UI consistency

Before any frontend or UI-related work, use the installed `ui-skills-root` skill and follow its routing protocol. Load only the smallest relevant UI skill context through `npx ui-skills`; do not apply unrelated visual guidance.

Keep every new or edited screen consistent with the existing product language:

- Reuse semantic design tokens, typography, spacing, radii, shadows, motion and shared components before introducing new values.
- Preserve the established warm-paper, coral and navy/cobalt palette unless the user explicitly requests a redesign.
- Keep the app shell, navigation behavior, responsive breakpoints, dark mode, loading/empty/error states and accessibility patterns coherent across features.
- Do not build a screen as an isolated mockup. Compare it with adjacent screens and remove one-off styles that make it look visually unrelated.
- Before handoff, verify the affected UI at relevant desktop/mobile widths and in both themes when applicable, then run lint, typecheck, tests and build.
