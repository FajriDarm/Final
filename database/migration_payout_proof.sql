-- =========================================
-- MIGRATION: Add payout_id to payment_proofs
-- =========================================
-- This migration adds support for storing payout transfer proofs

-- Add column payout_id if not exists
ALTER TABLE payment_proofs 
ADD COLUMN IF NOT EXISTS payout_id BIGINT DEFAULT NULL AFTER transaction_id;

-- Add column proof_type if not exists
ALTER TABLE payment_proofs 
ADD COLUMN IF NOT EXISTS proof_type ENUM('customer_payment','payout_transfer') DEFAULT 'customer_payment' AFTER proof_file;

-- Add foreign key constraint if not exists
ALTER TABLE payment_proofs
ADD CONSTRAINT IF NOT EXISTS fk_payment_proofs_payout 
FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE;

-- Verify the table structure
-- DESCRIBE payment_proofs;
