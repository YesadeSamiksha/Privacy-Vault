-- PrivacyVault — Supabase Database Setup
-- Run this entire script in the Supabase SQL Editor
-- Project: PrivacyVault | DPDP Act 2023 Compliance Platform

-- ================================================
-- TABLE 1: users (citizen identity storage)
-- ================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       VARCHAR NOT NULL,
  email      VARCHAR UNIQUE NOT NULL,
  phone      VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ================================================
-- TABLE 2: admins (DPO identity — password via Supabase Auth)
-- ================================================
CREATE TABLE IF NOT EXISTS admins (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       VARCHAR NOT NULL,
  email      VARCHAR UNIQUE NOT NULL,
  role       VARCHAR DEFAULT 'dpo',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ================================================
-- TABLE 3: dsar_requests (core table)
-- ================================================
CREATE TABLE IF NOT EXISTS dsar_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token           VARCHAR UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)) NOT NULL,
  user_name       VARCHAR NOT NULL,
  user_email      VARCHAR NOT NULL,
  user_phone      VARCHAR,
  request_type    TEXT CHECK (request_type IN ('access', 'correction', 'erasure')) NOT NULL,
  request_details TEXT,
  status          TEXT CHECK (status IN ('submitted', 'under_review', 'processing', 'completed', 'rejected')) DEFAULT 'submitted',
  deadline        DATE GENERATED ALWAYS AS ((created_at + INTERVAL '30 days')::date) STORED,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP
);

-- ================================================
-- INDEXES: Performance optimization
-- ================================================
CREATE INDEX idx_dsar_requests_token ON dsar_requests(token);
CREATE INDEX idx_dsar_requests_status ON dsar_requests(status);
CREATE INDEX idx_dsar_requests_created_at ON dsar_requests(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_admins_email ON admins(email);

-- ================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_timestamp
BEFORE UPDATE ON dsar_requests
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- *** DSAR REQUESTS TABLE ***
ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;

-- Allow any anonymous user to INSERT (submit a request)
CREATE POLICY "Allow anonymous insert"
  ON dsar_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous SELECT (application handles token validation in API route)
-- SECURITY NOTE: Token validation happens at the API layer (/track page)
CREATE POLICY "Allow anonymous select"
  ON dsar_requests
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated (admin) users full access
CREATE POLICY "Allow authenticated full access"
  ON dsar_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- *** USERS TABLE ***
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins to read all users
CREATE POLICY "Admins can read users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Block anonymous access to users
CREATE POLICY "Block anonymous access to users"
  ON users
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- *** ADMINS TABLE ***
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin users can access admin list
CREATE POLICY "Only admins can read admin list"
  ON admins
  FOR SELECT
  TO authenticated
  USING (true);

-- Block anonymous access to admin list
CREATE POLICY "Block anonymous access to admins"
  ON admins
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ================================================
-- ADMIN LOGIN CREDENTIALS
-- ================================================
-- Step 1: Create admin users in Supabase Auth FIRST:
--   Go to: Supabase Dashboard > Authentication > Users
--   Click "Add user" and create with:
--     Email: admin@privacyvault.com
--     Password: [Your secure password]
--
-- Step 2: Copy the UUID from the auth.users table
--
-- Step 3: Uncomment the INSERT below, replace the UUID, and run it:

-- INSERT INTO admins (id, name, email, role)
-- VALUES 
--   ('550e8400-e29b-41d4-a716-446655440000', 'DPO Administrator', 'admin@privacyvault.com', 'dpo')
-- ON CONFLICT (email) DO NOTHING;

-- ================================================
-- ENABLE REALTIME (Optional)
-- ================================================
-- Enable via Supabase Dashboard > Database > Replication > dsar_requests
-- Then uncomment below (requires superuser role):
-- ALTER PUBLICATION supabase_realtime ADD TABLE dsar_requests;
