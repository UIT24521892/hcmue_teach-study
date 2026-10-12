# ADR 0006: server-graded quiz attempts with snapshot, autosave and deadline

- Status: accepted
- Date: 2026-10-12

## Context

Quiz results must not depend on the browser: the client timer is only UX, answers must survive reloads and short disconnects, and a double click or retry must not grade twice. Learners must not receive answers or explanations before they submit.

## Decision

- `QuizAttempt` copies the published items (answers included) into `items` at start. Grading and review read only this copy, never the quiz or question bank.
- `activeKey = quizId:userId` is unique while the attempt is in progress, so concurrent starts resume the same attempt instead of opening two.
- `deadlineAt = startedAt + timeLimit` is set by the server. Saves and final answers are accepted until `deadlineAt + 5s` grace; later, reads, saves, submits and new starts finalize the attempt with what was already saved.
- Saves (`PUT /attempts/:id/answers`) and submit both begin with a conditional `UPDATE ... WHERE status = IN_PROGRESS`, which takes the row lock. A save therefore cannot land after grading, and only one submit performs the grading; the others re-read and return the stored result (`POST /attempts/:id/submit` is idempotent).
- The learner projection sets `result = null` for every item until the attempt is submitted.
- Fill-in answers are compared after NFC normalisation, trimming, whitespace collapsing and lower-casing; choices and true/false must match exactly.
- Access: until assignments exist (Phase 5) only the owner of a published quiz may start attempts. The route is open to every role so the policy can later grant students access through assignments without moving routes.
- The client keeps unsaved answers in `localStorage` (`mach-attempt-<id>`) and retries saves; the server copy stays authoritative and the backup is cleared after submit.

## Consequences

- Editing or deleting questions or quizzes never changes past attempts.
- Auto-finalisation is lazy (on the next request); there is no background sweeper yet, so an abandoned expired attempt stays `IN_PROGRESS` in the database until it is touched. Reports must treat an expired in-progress attempt as finished.
- Learner data scope is per user; teachers will see students' attempts only through assignment progress views in Phase 5.
