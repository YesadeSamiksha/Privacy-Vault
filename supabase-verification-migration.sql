-- PrivacyVault — Supabase Database Migration
-- Run this script in the Supabase SQL Editor AFTER running the original supabase-setup.sql
-- Purpose: Adds multi-step verification capabilities (phone OTP & email magic link)

-- ================================================
-- 1. ADD NEW COLUMNS FOR VERIFICATION
-- ================================================
ALTER TABLE dsar_requests 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_otp VARCHAR,
ADD COLUMN IF NOT EXISTS email_token VARCHAR;

-- ================================================
-- 2. UPDATE STATUS CHECKS AND DEFAULTS
-- ================================================
-- Drop existing constraint
ALTER TABLE dsar_requests DROP CONSTRAINT IF EXISTS dsar_requests_status_check;

-- Create constraint with new 'pending' status
ALTER TABLE dsar_requests ADD CONSTRAINT dsar_requests_status_check 
  CHECK (status IN ('pending', 'submitted', 'under_review', 'processing', 'completed', 'rejected'));

-- Update default status for new insertions
ALTER TABLE dsar_requests ALTER COLUMN status SET DEFAULT 'pending';

-- ================================================
-- 3. ADD RLS POLICIES FOR VERIFICATION UPDATES
-- ================================================
-- Allow anonymous update to 'dsar_requests' ONLY for requests currently 'pending'
-- This enables our API routes to mark verification columns true
DROP POLICY IF EXISTS "Allow anonymous update for pending requests" ON dsar_requests;
CREATE POLICY "Allow anonymous update for pending requests"
  ON dsar_requests
  FOR UPDATE
  TO anon
  USING (status = 'pending')
  WITH CHECK (status IN ('pending', 'submitted'));
