-- ==========================================
-- ADD admin_note COLUMN TO payouts TABLE
-- ==========================================
-- This migration adds a column to store admin approval notes/comments
-- when approving withdrawal requests

ALTER TABLE payouts 
ADD COLUMN admin_note TEXT DEFAULT NULL;

-- Verify the table structure
-- DESCRIBE payouts;
