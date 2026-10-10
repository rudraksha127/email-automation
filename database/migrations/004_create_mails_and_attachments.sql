-- Migration 004: Create Mails, Attachments, and Forward Logs

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

CREATE TABLE IF NOT EXISTS mail_attachments (
    id TEXT PRIMARY KEY,
    mail_id TEXT NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    gmail_attachment_id TEXT,
    data_b64 TEXT
);
