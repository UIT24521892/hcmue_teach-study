# ADR 0002: Session auth with short-lived access tokens and rotating refresh tokens

- Status: accepted
- Date: 2026-09-18

## Context

Phase 1 introduces register, login, refresh and logout for `teacher`, `student` and `self_learner` (and `admin` as a schema-only role). The choice of session model is hard to reverse later: it determines what the browser stores, how logout and revocation work, and what a leaked credential is worth to an attacker.

The product requirements add two constraints: the API must own authorisation decisions (the frontend only reflects them), and the client must never hold a long-lived bearer credential.

## Decision

Use a two-token model:

- **Access token** — JWT, HS256, 15-minute default TTL, sent by the client as `Authorization: Bearer`. It carries only `sub` (user id), `role` and `typ: access`, plus `iss`/`aud`. It is never persisted in a cookie.
- **Refresh token** — 256 bits of random data, delivered in an `httpOnly`, `sameSite=lax`, `path=/api/v1/auth` cookie (`secure` in production). Only its SHA-256 hash is stored, in `refresh_tokens`.

Rotation and reuse detection:

- Each login starts a `familyId`. Every refresh revokes the presented token and issues its successor in the same family, inside one transaction, recording `replacedById`.
- Rotation claims the presented row with an atomic `revokedAt IS NULL` compare-and-set. Two concurrent requests cannot both create live successors.
- A token rotated within the previous five seconds returns a retryable `SESSION_REFRESH_CONFLICT` without clearing the shared browser cookie. This covers legitimate overlapping tabs while never returning token material to the losing request.
- Presenting an already-revoked token outside that narrow concurrency window, or an expired token, revokes the **entire family** and returns 401. A stolen cookie therefore cannot outlive its legitimate use.
- The refresh route clears the cookie only for confirmed unauthenticated outcomes. Retryable conflicts and transient server failures preserve it so a recoverable outage cannot destroy an otherwise valid session.
- Logout revokes the family and clears the cookie; the endpoint is idempotent.

Authorisation is decided from the database, not from the token:

- `authenticate` verifies the signature and then re-reads the user, so a soft delete or role change applies to the next request instead of waiting for the token to expire.
- `requireRole` gates routes; every guarded service must also scope its query, because hiding UI is not access control.
- `admin` cannot be self-assigned: public registration validates against `selfRegisterableRole` at the contract boundary and maps to the Prisma enum in the service.

## Consequences

- The long-lived refresh credential is never exposed to browser scripts. The short-lived access token remains in memory only, and logout is a real server-side revocation rather than a client-side token discard.
- One indexed primary-key lookup is added per authenticated request in exchange for immediate revocation and accurate roles.
- Multi-instance deployments need a shared secret (already environment-driven) but no shared session store for access tokens.
- Auth endpoints are rate limited per instance by an in-process fixed-window limiter. A shared Redis-backed limiter is required before production; the in-process version is a safety net, not a substitute.
- `AUTH_ACCESS_TOKEN_SECRET` is mandatory in production; `parseEnv` refuses to fall back to the development placeholder outside development/test.
