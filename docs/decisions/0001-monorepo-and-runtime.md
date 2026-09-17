# ADR 0001: npm workspaces with separate web, API, and worker apps

- Status: accepted
- Date: 2026-09-16

## Context

The product needs a browser application, an HTTP API, and background document/AI processing. Contracts and design primitives should be shared without coupling deployment lifecycles.

## Decision

Use npm workspaces with a clearly separated `frontend/` application and `backend/` services (`api`, `worker`, `prisma`), plus shared packages (`contracts`, `ui`, `config`). Use TypeScript strict mode throughout. PostgreSQL is accessed through Prisma; Redis is reserved for queued background work.

## Consequences

- A contributor can install and run the repository with npm already bundled with Node.
- The API and worker can scale and deploy independently.
- Shared contracts require an explicit build before API development; root scripts handle that ordering.
- More workspace configuration is required than in a single full-stack framework, but provider and process boundaries remain clear.
