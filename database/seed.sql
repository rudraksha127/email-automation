-- ==============================================================================
-- Mail Automation Platform — Supabase Seed Data
-- ==============================================================================

-- 1. Default Organization (Workspace)
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES ('org_default', 'Main Workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Default Batches (Pilot Batches 2027 and 2028)
INSERT INTO batches (id, org_id, name, description, created_at, updated_at)
VALUES 
    ('b2027', 'org_default', 'Batch 2027', 'Pilot batch 2027 (Pre-final year)', NOW(), NOW()),
    ('b2028', 'org_default', 'Batch 2028', 'Pilot batch 2028 (Sophomore year)', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Default Settings (Fail-closed defaults)
INSERT INTO settings (org_id, key, value)
VALUES
    ('org_default', 'autoForwarding', 'false'),
    ('org_default', 'ccEmail', ''),
    ('org_default', 'organizationName', 'Main Workspace')
ON CONFLICT (org_id, key) DO NOTHING;

-- 4. Initial Schema Version Metadata
INSERT INTO app_meta (key, value)
VALUES ('schema_version', '2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
