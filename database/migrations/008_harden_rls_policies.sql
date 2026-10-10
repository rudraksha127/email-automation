-- Apply after migrations 001-007 for existing Supabase databases.
-- New databases should use `database/policies/rls.sql` after `schema.sql`.

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sender_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarding_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forward_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_meta ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.current_user_org_ids()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT membership.org_id
  FROM public.organization_members AS membership
  WHERE membership.admin_email = (SELECT auth.jwt() ->> 'email');
$$;

REVOKE ALL ON FUNCTION private.current_user_org_ids() FROM PUBLIC, anon, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_org_ids() TO authenticated;

DROP POLICY IF EXISTS "Users can only view batches of their organization" ON public.batches;
DROP POLICY IF EXISTS "Users can only modify batches of their organization" ON public.batches;
DROP POLICY IF EXISTS "Users can only view recipients of their organization" ON public.recipients;
DROP POLICY IF EXISTS "Users can only modify recipients of their organization" ON public.recipients;
DROP POLICY IF EXISTS "Users can only view mails of their organization" ON public.mails;
DROP POLICY IF EXISTS "Users can only modify mails of their organization" ON public.mails;
DROP POLICY IF EXISTS "Users can only view forwarding rules of their organization" ON public.forwarding_rules;
DROP POLICY IF EXISTS "Users can only modify forwarding rules of their organization" ON public.forwarding_rules;
DROP POLICY IF EXISTS "Users can only view sender rules of their organization" ON public.sender_rules;
DROP POLICY IF EXISTS "Users can only modify sender rules of their organization" ON public.sender_rules;
DROP POLICY IF EXISTS "Users can only view settings of their organization" ON public.settings;
DROP POLICY IF EXISTS "Users can only modify settings of their organization" ON public.settings;
DROP POLICY IF EXISTS "Users can view audit events of their organization" ON public.audit_events;

DROP FUNCTION IF EXISTS public.current_user_org_ids();

CREATE POLICY "members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped batches"
  ON public.batches FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped recipients"
  ON public.recipients FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped sender rules"
  ON public.sender_rules FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped forwarding rules"
  ON public.forwarding_rules FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped settings"
  ON public.settings FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped mails"
  ON public.mails FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped forward logs"
  ON public.forward_logs FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
CREATE POLICY "members can view scoped audit events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (org_id IN (SELECT private.current_user_org_ids()));
