# Mạch — English learning, kept in rhythm

Mạch is a web platform for teachers, students in a class, and independent learners. The repository is an npm-workspaces monorepo with an explicit `frontend/` React application, a `backend/` containing the Express API, worker and Prisma schema, plus shared contracts and a small design system in `packages/`.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- Docker Desktop (recommended for PostgreSQL and Redis)

## Local setup

To try the UI only (no database or AI key required):

```bash
npm install
npm run dev -w @mach/web
```

The routed frontend includes a growing study tree, documents, classes, practice/results, daily notes, progress, settings and real account screens. Registration, login, refresh, logout, the read-only account page and the personal document pipeline use the API; unfinished learning/classroom features remain clearly labelled demo data. See [frontend UI guide](docs/frontend-ui.md) for routes, behavior and limitations.

For the full development services:

```bash
cp .env.example .env
npm install
npm run services:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: <http://localhost:5173>
- API health: <http://localhost:4000/api/v1/health>

`npm run dev` starts the web application and API. The default `DOCUMENT_JOB_MODE=inline` still runs extraction after the upload response, so Redis is not required for ordinary local UI work. Set `DOCUMENT_JOB_MODE=redis` and use `npm run dev:all` to run the production-shaped API/web/worker split. Production configuration rejects inline mode.

## Authentication

Phase 1 auth is implemented on the API (`/api/v1/auth`) and wired to `/login`, `/register` and `/account`. Access tokens are short-lived JWTs kept in browser memory and sent as `Authorization: Bearer`; the refresh token lives in an `httpOnly` cookie and rotates atomically on every use. Concurrent refreshes receive a bounded retry response, while replaying a stale token revokes the whole login family. See [ADR 0002](docs/decisions/0002-auth-session-and-refresh-rotation.md).

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/register` | Create a `teacher`, `student` or `self_learner` account and start a session |
| `POST /api/v1/auth/login` | Start a session |
| `POST /api/v1/auth/refresh` | Rotate the refresh token and mint a new access token |
| `POST /api/v1/auth/logout` | Revoke the session family and clear the cookie |
| `GET /api/v1/auth/me` | Current user for a valid access token |

`admin` exists in the schema but cannot be self-assigned through registration or the demo role selector. The authenticated role takes precedence across navigation and role-sensitive demo screens; backend policy remains the security boundary. Password recovery and profile editing are still pending Phase 1 work.

## Document uploads

Phase 2 provides authenticated multipart upload and background processing for teachers and self-learners. Send one file in the `file` field to `POST /api/v1/documents`; supported formats are PDF, DOCX, UTF-8 TXT, JPEG, PNG and WebP. The API checks the extension, declared MIME, detected content, filename and configured byte limit before persisting owner-scoped metadata and a SHA-256 checksum. Students cannot create personal uploads.

Upload returns a queued `DocumentJob` immediately. PDF.js, Mammoth, strict UTF-8 decoding and local Tesseract OCR extract content; a deterministic mock AI provider creates validated multiple-choice, fill-blank and true/false questions. The owner can poll status, retry failures, edit questions and approve/reject them in `/documents`. This does not publish or assign questions to a class.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/documents` | Paginated owner library |
| `POST /api/v1/documents` | Validate, privately store and enqueue one multipart file |
| `GET /api/v1/documents/:documentId` | Owner-scoped metadata |
| `POST /api/v1/documents/:documentId/process` | Idempotently enqueue or retry processing |
| `GET /api/v1/documents/:documentId/jobs` | Poll recent attempts and progress |
| `GET /api/v1/documents/:documentId/questions` | Paginated generated questions |
| `PATCH /api/v1/documents/:documentId/questions/:questionId` | Edit with optimistic `version` |
| `POST /api/v1/documents/:documentId/questions/:questionId/review` | Approve or reject with optimistic `version` |

Stored bytes use the private local adapter configured by `STORAGE_LOCAL_PATH` and are never exposed as static files or filesystem paths. The defaults are 10 MiB/file, 100,000 extracted characters, three job attempts and 20 generated sets per owner per rolling 24 hours; all are configurable through `.env`. See [ADR 0003](docs/decisions/0003-private-document-storage.md) and [ADR 0004](docs/decisions/0004-document-processing-queue-and-local-ai.md).

## Tests

API integration tests perform broad cleanup and therefore run only against the dedicated database named exactly `mach_test`. Create it once:

```bash
docker exec <postgres-container> psql -U mach -d postgres -c 'CREATE DATABASE mach_test;'
```

Set `TEST_DATABASE_URL` as shown in `.env.example`. Pending migrations are applied automatically before the suite runs. The test bootstrap ignores `DATABASE_URL` and refuses malformed, non-PostgreSQL or differently named targets; the fixed local fallback also points only to `mach_test`.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run test:e2e -w @mach/web
```

UI E2E tests use an installed Google Chrome locally; in CI, install Chromium with `npx playwright install --with-deps chromium` and run with `CI=true`.

Seed accounts use the password in `SEED_PASSWORD` and are only intended for local development:

- `teacher@mach.local`
- `student@mach.local`
- `learner@mach.local`

Product requirements are in `prompt-website-hoc-tieng-anh.md`; the implementation roadmap is in `PROJECT_PLAN.md`.
