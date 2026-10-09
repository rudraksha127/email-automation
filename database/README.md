# Database

## Actual implementation (verified — no Supabase/Prisma/Drizzle in this repo)

| Aspect | Value |
| --- | --- |
| Engine | SQLite via Node's built-in `node:sqlite` (`DatabaseSync`) |
| File | `./data/pilot.db` (gitignored) — override with `PILOT_DB_PATH` |
| Modes | WAL journal, foreign keys ON |
| Schema | Idempotent `CREATE TABLE/INDEX IF NOT EXISTS` executed on boot — **no migration framework, no migration files** |
| Location of DDL | [`src/lib/db.ts`](../src/lib/db.ts) |

## Tables

| Table | Purpose |
| --- | --- |
| `organizations` | Workspaces (tenants) |
| `organization_members` | User ↔ workspace membership with `admin`/`member` role |
| `users` | Accounts (scrypt password hashes) |
| `sessions` | httpOnly cookie sessions |
| `batches` | Recipient groups ("batches"/years per workspace) |
| `recipients` | Members of a batch |
| `mails` | Ingested mails + processing status (`pending`/`forwarded`/`needs_review`/`failed`) |
| `forward_logs` | Dispatch history (UNIQUE(org, gmail_message_id) = idempotency) |
| `mail_attachments` | Attachment metadata/content for ingested mails |
| `sender_rules` | Per-workspace sender allowlist (fail-closed when empty) |
| `forwarding_rules` | Keyword-based routing rules with priority |
| `gmail_tokens` | OAuth tokens, **AES-256-GCM encrypted at rest** (`GMAIL_TOKEN_KEY`) |
| `gmail_state` | OAuth transient state |
| `settings` | Per-workspace key/value settings (CC, automation toggle, seeds) |
| `audit_events` | Append-only admin audit trail |

Every tenant-scoped table carries `org_id`; all queries filter by it
(server-side isolation is verified in `tests/tenants.test.ts`).

## Migrations & recovery

- Schema changes ship as additive, idempotent statements in `db.ts` —
  applied automatically on boot, safe to redeploy (backward compatible).
- Legacy single-tenant databases are upgraded **in place** inside a
  transaction with an automatic timestamped backup
  (`pilot.db.bak-v1-<ts>`) — see the migration block in `db.ts`.
- **Backup:** copy `data/pilot.db` plus its `-wal`/`-shm` sidecars while the
  app is stopped (or use the SQLite backup API).
- **Restore:** put the backup file back at `PILOT_DB_PATH` and restart.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PILOT_DB_PATH` | Database file location (point at the Render persistent disk in production) |
| `GMAIL_TOKEN_KEY` | AES-256-GCM key for token encryption (`openssl rand -hex 32`); production refuses to store tokens without it |

## Rules

- Never commit the database file, backups, dumps or real credentials.
- Never run destructive SQL against production data as part of development.
- Development/test fixtures belong in code (`tests/`, `src/services/mock/`),
  not as committed database dumps.
