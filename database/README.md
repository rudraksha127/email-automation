# Supabase Database Guide & Migrations

This package contains the PostgreSQL database schema, numbered migrations, Row Level Security (RLS) policies, and seed data for the **Mail Automation Platform** hosted on **Supabase**.

---

## 1. Directory Structure

```
packages/database/
├── migrations/
│   ├── 001_create_organizations.sql
│   ├── 002_create_users_and_members.sql
│   ├── 003_create_batches_and_recipients.sql
│   ├── 004_create_mails_and_attachments.sql
│   ├── 005_create_rules_and_settings.sql
│   ├── 006_create_gmail_and_audit.sql
│   └── 007_create_indexes.sql
├── policies/
│   └── rls.sql                   # Multi-tenant Row Level Security policies
├── schema.sql                    # Consolidated complete schema DDL
├── seed.sql                      # Initial workspace, batch, and settings seed
├── .env.example                  # Supabase environment variables reference
└── README.md
```

---

## 2. Applying Migrations to Supabase

### Option A: Using Supabase Web Dashboard (Simplest)
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project or select your existing project.
3. Open the **SQL Editor** from the left navigation.
4. Copy and paste the contents of `schema.sql` into the editor and click **Run**.
5. Copy and paste the contents of `policies/rls.sql` and click **Run**.
6. Copy and paste the contents of `seed.sql` to initialize default batches and click **Run**.

### Option B: Using Supabase CLI
```bash
# 1. Login to Supabase CLI
supabase login

# 2. Link your local project to Supabase
supabase link --project-ref <your-project-ref>

# 3. Apply migrations
supabase db push
```

---

## 3. Database Security & Multi-Tenancy

- **Row Level Security (RLS):** Enabled on all tenant tables (`batches`, `recipients`, `mails`, `forwarding_rules`, `settings`, `audit_events`).
- **Organization Isolation:** Every tenant row is tagged with `org_id`.
- **Backend Service Role:** The Render backend connects using `SUPABASE_SERVICE_ROLE_KEY` to perform administrative operations and background mail processing.
- **Token Security:** Gmail refresh and access tokens are encrypted with `GMAIL_TOKEN_KEY` (AES-256-GCM) before being stored in `gmail_tokens`.

---

## 4. Environment Variables Required by Backend

In Render backend configuration:
- `SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key (never expose to frontend)
- `DATABASE_URL`: Direct PostgreSQL connection string if using direct SQL driver
