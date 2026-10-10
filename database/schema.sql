-- ==============================================================================
-- Mail Automation Platform — Supabase PostgreSQL Schema (Multi-Tenant v2)
-- ==============================================================================
-- This schema models institutional email automation, multi-tenant organizations,
-- recipient batches, Gmail OAuth tokens (encrypted), forwarding rules, and audit logs.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations (Workspaces / Departments)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Admin Users (Institutional Staff / Faculty)
CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Organization Memberships (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS organization_members (
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    admin_email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, admin_email)
);

-- 4. User Sessions (httpOnly Cookie Sessions)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    admin_email TEXT NOT NULL REFERENCES admins(email) ON DELETE CASCADE,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 5. Student / Recipient Batches (e.g. Batch 2027, Batch 2028)
CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_batches_org_name UNIQUE (org_id, name)
);

-- 6. Batch Recipients
CREATE TABLE IF NOT EXISTS recipients (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_recipients_batch_email UNIQUE (batch_id, email)
);

-- 7. Sender Allowlist Rules (Authorized Senders per Workspace)
CREATE TABLE IF NOT EXISTS sender_rules (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_email TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sender_rules_org_email UNIQUE (org_id, sender_email)
);

-- 8. Forwarding Rules (Deterministic Keyword / Pattern Matching)
CREATE TABLE IF NOT EXISTS forwarding_rules (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sender_pattern TEXT,
    subject_keywords TEXT NOT NULL DEFAULT '',
    body_keywords TEXT NOT NULL DEFAULT '',
    target_batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Workspace Settings (Key/Value pairs: CC, Automation, Seeds)
CREATE TABLE IF NOT EXISTS settings (
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (org_id, key)
);

-- 10. Processed Mails (Inbox Ingestion & Routing Status)
CREATE TABLE IF NOT EXISTS mails (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gmail_message_id TEXT,
    sender TEXT NOT NULL,
    sender_name TEXT,
    subject TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'forwarded', 'needs_review', 'failed')),
    batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
    batch_name TEXT,
    recipient_count INTEGER,
    failure_reason TEXT,
    forwarded_at TIMESTAMPTZ,
    cc_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Dispatch Forward Logs (Idempotency Guard)
CREATE TABLE IF NOT EXISTS forward_logs (
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    recipient_count INTEGER NOT NULL,
    cc_email TEXT,
    provider TEXT NOT NULL DEFAULT 'gmail',
    status TEXT NOT NULL DEFAULT 'sent',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_forward_logs_org_gmail UNIQUE (org_id, gmail_message_id)
);

-- 12. Gmail OAuth Tokens (AES-256-GCM Encrypted at Rest)
CREATE TABLE IF NOT EXISTS gmail_tokens (
    org_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    account_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expiry_ms BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Gmail State (Transient OAuth State Tokens)
CREATE TABLE IF NOT EXISTS gmail_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Mail Attachments
CREATE TABLE IF NOT EXISTS mail_attachments (
    id TEXT PRIMARY KEY,
    mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    gmail_attachment_id TEXT,
    data_b64 TEXT
);

-- 15. Audit Log Events (Append-only Admin Action Trail)
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    actor TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. App Metadata (Schema version, migration milestones)
CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE & QUERY ACCELERATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_members_user ON organization_members(admin_email);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_email);
CREATE INDEX IF NOT EXISTS idx_batches_org ON batches(org_id);
CREATE INDEX IF NOT EXISTS idx_recipients_batch ON recipients(batch_id);
CREATE INDEX IF NOT EXISTS idx_recipients_org ON recipients(org_id);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);
CREATE INDEX IF NOT EXISTS idx_sender_rules_org ON sender_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_rules_org ON forwarding_rules(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mails_gmail ON mails(org_id, gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_mails_org ON mails(org_id);
CREATE INDEX IF NOT EXISTS idx_mails_status ON mails(org_id, status);
CREATE INDEX IF NOT EXISTS idx_mails_batch ON mails(batch_id);
CREATE INDEX IF NOT EXISTS idx_mails_received ON mails(org_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_fwd_mail ON forward_logs(mail_id);
CREATE INDEX IF NOT EXISTS idx_fwd_org ON forward_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_attachments_mail ON mail_attachments(mail_id);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_events(org_id, created_at DESC);
