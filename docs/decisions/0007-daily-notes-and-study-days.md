# ADR 0007: daily notes and study days in the user's timezone

- Status: accepted
- Date: 2026-10-13

## Context

The learning journal, the study tree and the streak must agree on "which day" an activity belongs to. Device clocks and the server's UTC clock disagree around midnight for learners in UTC+7.

## Decision

- `DailyNote` is unique per `(userId, date)` where `date` is a `DATE` (no time) for the user's local day. Writes use `PUT /notes/:date` (create without `version`, update with the current `version`; a blind overwrite or stale version returns `409`). `DELETE /notes/:date?version=` removes it.
- The server decides "today" from `User.timezone` (falling back to `Asia/Ho_Chi_Minh` if the runtime does not know the stored zone) and rejects notes for future days.
- Tags are a per-user vocabulary (`Tag.normalized` is NFC, trimmed, whitespace-collapsed and lower-cased), linked through `DailyNoteTag`.
- `DailyNoteLink` points at exactly one of the author's own documents or submitted attempts (CHECK constraint). Foreign or missing ids return the same `404`; links to sources that later become invisible are hidden, not errors.
- A **study session** is a local calendar day with at least one note or submitted quiz attempt. Submission days are converted to the user's zone in PostgreSQL. `GET /notes/progress` returns `today`, `completedSessions` and `streakDays`; the streak survives until the current day ends. Every study tree in the UI reads this endpoint.
- Notes are private to their author for every role; there is no teacher view of student notes.

## Consequences

- Several activities on one day still grow one leaf, which differs from the earlier demo that counted each note and attempt.
- Changing the account timezone (a later profile feature) re-buckets attempt days but not stored note dates, which keep the day the learner chose.
- Dashboard weekly activity reads notes and submitted attempts from the API. Score cards and charts on the Progress page still use demo data until the Phase 6 dashboard API.
