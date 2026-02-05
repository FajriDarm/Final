-- ==========================================
-- ADD finance_note COLUMN TO payouts TABLE
-- ==========================================
-- This migration adds a column to store finance notes/comments
-- when submitting withdrawal requests to admin

ALTER TABLE payouts 
ADD COLUMN IF NOT EXISTS finance_note TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL 
AFTER finance_note;

-- Verify the table structure
-- DESCRIBE payouts;
