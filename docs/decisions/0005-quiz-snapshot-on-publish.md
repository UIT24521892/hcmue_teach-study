# ADR 0005: quizzes freeze approved questions on publish

- Status: accepted
- Date: 2026-10-12

## Context

Questions in the bank stay editable after approval, and any edit returns them to `pending_review`. A quiz that has been published (and later assigned or attempted) must not change silently when its source questions are edited or deleted, and unreviewed content must never reach learners.

## Decision

Add `Quiz` (`draft → published → archived`, optimistic `version`) and `QuizQuestion` (ordered `position`, nullable `questionId`, nullable `snapshot` JSON).

- Creating or editing a draft only accepts questions the owner can access that are `approved`; cross-owner IDs return `404` like unknown IDs.
- Drafts reference live questions. Publishing runs in one transaction: every live item must still be `approved`, items whose source was removed are dropped, at least one item must remain, and each item's content plus `sourceVersion` is written into `snapshot`.
- Published quizzes are immutable; changes require a new quiz. Archiving keeps all data.
- `QuizQuestion.questionId` uses `ON DELETE SET NULL`, so deleting a source question never breaks a published quiz.
- Authoring routes (`/api/v1/quizzes`) are limited to `teacher` and `self_learner` and are owner-scoped. Students will reach published quizzes only through assignments, using a projection without answers.

## Consequences

- Later attempts can snapshot from the published items without reading the mutable bank.
- Correcting a mistake in a published quiz means publishing a new quiz; this keeps attempt history consistent.
- The owner detail response includes answers and explanations. A separate learner projection is required before any non-owner route exposes quiz content.
