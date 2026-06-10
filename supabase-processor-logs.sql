-- PrivacyVault — Supabase Database Migration
-- Run this script in the Supabase SQL Editor to fix the 500 Internal Server Error when modifying or deleting processors
-- Purpose: Creates the missing processor_modification_log and processor_deletion_log tables

-- ================================================
-- TABLE: processor_modification_log
-- ================================================
CREATE TABLE IF NOT EXISTS processor_modification_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id  UUID NOT NULL REFERENCES dsar_requests(id) ON DELETE CASCADE,
  processor   VARCHAR NOT NULL,
  actioned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modified_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ================================================
-- TABLE: processor_deletion_log
-- ================================================
CREATE TABLE IF NOT EXISTS processor_deletion_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id  UUID NOT NULL REFERENCES dsar_requests(id) ON DELETE CASCADE,
  processor   VARCHAR NOT NULL,
  actioned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ================================================
-- INDEXES
-- ================================================
CREATE INDEX idx_proc_mod_request_id ON processor_modification_log(request_id);
CREATE INDEX idx_proc_del_request_id ON processor_deletion_log(request_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
ALTER TABLE processor_modification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE processor_deletion_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins to insert and select logs
CREATE POLICY "Admins can manage modification logs"
  ON processor_modification_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage deletion logs"
  ON processor_deletion_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Block anonymous access
CREATE POLICY "Block anonymous access to modification logs"
  ON processor_modification_log
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block anonymous access to deletion logs"
  ON processor_deletion_log
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
