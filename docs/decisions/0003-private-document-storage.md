# ADR 0003: private document storage behind an adapter

- Status: accepted
- Date: 2026-09-19

## Context

Uploaded learning material is untrusted and private. Development needs to work without a cloud account, while production will later use an S3-compatible provider. Serving uploaded files directly from the API origin would make executable or incorrectly detected content unnecessarily dangerous.

## Decision

Persist document metadata in PostgreSQL and file bytes through a `StorageService` interface. The initial adapter writes to a configured local root using server-generated keys, owner-scoped directories, exclusive creation and `0600` file permissions. The local root is never mounted as Express static content, and API responses never expose the storage key or filesystem path.

Validate the original name, allowlisted extension, declared MIME, detected content type and byte limit before storage. TXT must be valid UTF-8; other formats use magic/content detection. Persist a SHA-256 checksum for later idempotency and extraction jobs. Ownership is applied in the database query, with cross-owner lookups returning the same `404` as unknown IDs.

## Consequences

- Local development and tests need no object-storage credentials.
- Uploads consume API memory up to the configured per-file cap; streaming directly into quarantine storage is a future hardening step if the production limit or traffic increases.
- Adding S3 requires a new adapter and configuration branch, not changes to document business rules.
- File download/preview will require a separately authorized endpoint or short-lived signed URL; raw storage paths remain private.
