-- PrivacyVault — AI Privacy Report and Security Migration
-- Run this script in the Supabase SQL Editor to add AI-report and OTP-limiting capabilities to dsar_requests

-- Add AI Privacy Report and security columns to dsar_requests table
ALTER TABLE dsar_requests 
ADD COLUMN IF NOT EXISTS exposure_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_score VARCHAR DEFAULT 'Low',
ADD COLUMN IF NOT EXISTS data_categories JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS compliance_insights TEXT,
ADD COLUMN IF NOT EXISTS dpdp_recommendations TEXT,
ADD COLUMN IF NOT EXISTS processor_summary JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS last_otp_sent_at TIMESTAMPTZ;
