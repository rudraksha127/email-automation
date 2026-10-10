-- ==============================================================================
-- Supabase Row Level Security (RLS) Policies — Multi-Tenant Isolation
-- ==============================================================================
-- These policies ensure that data queries authenticated via Supabase JWT or session
-- context are restricted strictly to the organization (workspace) they belong to.
-- Service-role connections (used by Render backend Express server) bypass RLS.

-- Enable Row Level Security on tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE forwarding_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE forward_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Helper function to extract user's allowed organizations from JWT or context
CREATE OR REPLACE FUNCTION current_user_org_ids()
RETURNS SETOF TEXT AS $$
BEGIN
    RETURN QUERY
    SELECT org_id
    FROM organization_members
    WHERE admin_email = auth.jwt() ->> 'email';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Batches Policy
CREATE POLICY "Users can only view batches of their organization"
    ON batches FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));

CREATE POLICY "Users can only modify batches of their organization"
    ON batches FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- 2. Recipients Policy
CREATE POLICY "Users can only view recipients of their organization"
    ON recipients FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));

CREATE POLICY "Users can only modify recipients of their organization"
    ON recipients FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- 3. Mails Policy
CREATE POLICY "Users can only view mails of their organization"
    ON mails FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));

CREATE POLICY "Users can only modify mails of their organization"
    ON mails FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- 4. Rules Policy
CREATE POLICY "Users can only view forwarding rules of their organization"
    ON forwarding_rules FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));

CREATE POLICY "Users can only modify forwarding rules of their organization"
    ON forwarding_rules FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- 5. Sender Rules Policy
CREATE POLICY "Users can only view sender rules of their organization"
    ON sender_rules FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));

CREATE POLICY "Users can only modify sender rules of their organization"
    ON sender_rules FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- 6. Settings Policy
CREATE POLICY "Users can only view settings of their organization"
    ON settings FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));

CREATE POLICY "Users can only modify settings of their organization"
    ON settings FOR ALL
    USING (org_id IN (SELECT current_user_org_ids()));

-- 7. Audit Events Policy
CREATE POLICY "Users can view audit events of their organization"
    ON audit_events FOR SELECT
    USING (org_id IN (SELECT current_user_org_ids()));

-- Service role bypass policy for backend automation
-- Supabase automatically grants bypassrls to service_role keys.
