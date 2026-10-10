-- ==============================================================================
-- Mail Automation Platform — Test / Pilot Recipient Seed Data (TESTING ONLY)
-- ==============================================================================
-- NOTE: Clearly marked as TEST/PILOT DATA. Replace with production records later.
-- Safe idempotent execution with ON CONFLICT DO NOTHING.

-- 1. Ensure Default Workspace exists
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES ('org_default', 'Main Workspace', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure Batches exist
INSERT INTO batches (id, org_id, name, description, created_at, updated_at)
VALUES 
    ('b2027', 'org_default', 'Batch 2027', 'Test Batch 2027', NOW(), NOW()),
    ('b2028', 'org_default', 'Batch 2028', 'Test Batch 2028', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Allowed Sender Rules (TEST DATA)
INSERT INTO sender_rules (id, org_id, sender_email, active, created_at)
VALUES
    ('sr_test_lucky', 'org_default', 'luckyudiya@gmail.com', TRUE, NOW()),
    ('sr_test_rudraksha', 'org_default', 'rudrakshaudiya96@gmail.com', TRUE, NOW())
ON CONFLICT (org_id, sender_email) DO NOTHING;

-- 4. Batch 2027 Recipients (TEST DATA)
INSERT INTO recipients (id, batch_id, org_id, name, email, created_at)
VALUES
    ('b2027-cg712987', 'b2027', 'org_default', 'Test Student (cg712987)', 'cg712987@gmail.com', NOW()),
    ('b2027-sonali', 'b2027', 'org_default', 'Test Student (sonali)', 'sonaliporwal82@gmail.com', NOW()),
    ('b2027-cutie', 'b2027', 'org_default', 'Test Student (cutie)', 'cutie9459@gmail.com', NOW())
ON CONFLICT (batch_id, email) DO NOTHING;

-- 5. Batch 2028 Recipients (TEST DATA)
INSERT INTO recipients (id, batch_id, org_id, name, email, created_at)
VALUES
    ('b2028-cpie', 'b2028', 'org_default', 'Test Student (cpie)', 'cpie55808@gmail.com', NOW()),
    ('b2028-kishtee', 'b2028', 'org_default', 'Test Student (kishtee)', 'kishteejaiswal11@gmail.com', NOW()),
    ('b2028-kuttakutti', 'b2028', 'org_default', 'Test Student (kuttakutti)', 'kuttakutti92247@gmail.com', NOW()),
    ('b2028-pooja', 'b2028', 'org_default', 'Test Student (pooja)', 'poojaporwal6734@gmail.com', NOW())
ON CONFLICT (batch_id, email) DO NOTHING;

-- 6. Safety Settings (Fail-closed: autoForwarding disabled, CC pending)
INSERT INTO settings (org_id, key, value)
VALUES
    ('org_default', 'autoForwarding', 'false'),
    ('org_default', 'ccEmail', '')
ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value;
