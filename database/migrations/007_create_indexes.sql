-- Migration 007: Create Performance Indexes

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
