# ADR 0004: document processing queue and deterministic local AI

- Status: accepted
- Date: 2026-09-20

## Context

Extraction, OCR and question generation can take seconds or minutes. Upload requests must not wait for that work, production needs bounded retry/backoff, and local development/tests must work without an AI key or a permanently running Redis worker. The API and worker must not grow separate extraction or validation behavior.

## Decision

Put extraction, OCR, question-output validation and the processor orchestration in the shared `@mach/document-pipeline` package. PDF uses PDF.js, DOCX uses Mammoth, TXT uses strict UTF-8 decoding, and images use Tesseract with bundled English language data. Extracted text has a configured hard character limit. Parser/provider errors are converted to public-safe codes; document contents are never logged.

Persist every run as a `DocumentJob` and use its database state as the polling source of truth. An `active_key` unique constraint makes concurrent process requests idempotent. Attempts, progress, public-safe error metadata and terminal timestamps live in PostgreSQL. Successful completion writes extracted text and schema-validated questions in the same transaction. Questions begin in `pending_review`; edits and review decisions use optimistic versions and append `QuestionRevision` audit rows.

Production dispatches jobs through BullMQ/Redis with bounded exponential backoff. The worker and development inline dispatcher execute the same processor. Inline mode schedules work after the HTTP response and is allowed only outside production; tests may use a manual dispatcher to avoid timer races. Non-retryable extraction failures become BullMQ `UnrecoverableError`s. API and worker close their Redis/Prisma resources on shutdown.

Use `MockQuestionGenerationProvider` by default. It is deterministic, creates all three MVP question types and still passes through the same Zod structured-output validation as a future external provider. No external AI account, key or cost is introduced in this phase. AI work is protected by a request limiter and a database-backed rolling 24-hour per-owner quota enforced in a serializable transaction.

## Consequences

- Upload returns a queued job immediately; clients poll owner-scoped document/job endpoints.
- Local development can run API-only in inline mode, while Redis mode exercises the production deployment boundary with `npm run dev:all`.
- OCR works offline after install because trained language data is packaged with the repository dependencies, at the cost of a larger install.
- A real question-generation provider can be added behind the existing interface, but must keep structured validation, quota accounting and safe error behavior.
- Extracted source text is private database content. It is not returned by list/detail APIs or written to logs; later RAG work will version and scope it separately.
