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

The routed frontend includes a growing study tree, documents, classes, practice/results, daily notes, progress and settings. It is explicitly labeled as a local demo; auth, uploads, AI jobs and classroom APIs are not connected yet. See [frontend UI guide](docs/frontend-ui.md) for routes, behavior and limitations.

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

`npm run dev` starts the web application and API. Use `npm run dev:all` when work on the background worker begins.

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
