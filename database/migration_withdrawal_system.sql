-- =========================================
-- VERIFY ON-DEMAND WITHDRAWAL SYSTEM TABLES
-- =========================================
-- Run this to verify/update database structure for commission withdrawal system

USE affiliate_system;

-- Verify commissions table has all required fields
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS stage_status ENUM('waiting','in_review','approved','rejected','expired') DEFAULT 'waiting',
ADD COLUMN IF NOT EXISTS commission_status ENUM('pending','approved','ready_for_withdraw','paid','rejected') DEFAULT 'pending';

-- Verify payouts table exists with correct structure
CREATE TABLE IF NOT EXISTS payouts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id BIGINT,
    total_amount DECIMAL(15,2),
    status ENUM('pending','approved','rejected','paid') DEFAULT 'pending',
    approved_by BIGINT,
    processed_at TIMESTAMP NULL,
    -- Optional bank details (copied from user's profile or provided at request)
    bank_name VARCHAR(100) NULL,
    bank_account_number VARCHAR(50) NULL,
    bank_account_name VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (affiliate_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Verify payout_details table exists
CREATE TABLE IF NOT EXISTS payout_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payout_id BIGINT,
    commission_id BIGINT,
    FOREIGN KEY (payout_id) REFERENCES payouts(id),
    FOREIGN KEY (commission_id) REFERENCES commissions(id)
);

-- Verify activity_logs has withdrawal-related columns
ALTER TABLE activity_logs 
ADD COLUMN IF NOT EXISTS approved_by BIGINT AFTER id,
ADD COLUMN IF NOT EXISTS target_user_id BIGINT AFTER approved_by,
ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) AFTER action,
ADD COLUMN IF NOT EXISTS target_id BIGINT AFTER target_type,
ADD COLUMN IF NOT EXISTS old_status VARCHAR(50) AFTER target_id,
ADD COLUMN IF NOT EXISTS new_status VARCHAR(50) AFTER old_status;

-- Add foreign keys if they don't exist
ALTER TABLE activity_logs
ADD CONSTRAINT IF NOT EXISTS fk_activity_logs_approved_by 
FOREIGN KEY (approved_by) REFERENCES users(id);

ALTER TABLE activity_logs
ADD CONSTRAINT IF NOT EXISTS fk_activity_logs_target_user_id 
FOREIGN KEY (target_user_id) REFERENCES users(id);

-- Verify users table has bank details
ALTER TABLE users
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS no_wa VARCHAR(20) NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_status 
ON commissions(affiliate_id, commission_status);

CREATE INDEX IF NOT EXISTS idx_commissions_transaction 
ON commissions(transaction_id);

CREATE INDEX IF NOT EXISTS idx_payouts_affiliate_status 
ON payouts(affiliate_id, status);

CREATE INDEX IF NOT EXISTS idx_payouts_status 
ON payouts(status);

CREATE INDEX IF NOT EXISTS idx_payout_details_payout 
ON payout_details(payout_id);

CREATE INDEX IF NOT EXISTS idx_payout_details_commission 
ON payout_details(commission_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_target 
ON activity_logs(target_type, target_id);

-- =========================================
-- VERIFICATION QUERIES
-- =========================================
-- Run these to verify data integrity

-- Check all commission status types
-- SELECT DISTINCT commission_status FROM commissions;

-- Check all payout status types
-- SELECT DISTINCT status FROM payouts;

-- Check payout completion
-- SELECT 
--   p.id, u.name, p.total_amount, p.status, 
--   COUNT(pd.id) as commission_count
-- FROM payouts p
-- LEFT JOIN users u ON p.affiliate_id = u.id
-- LEFT JOIN payout_details pd ON p.id = pd.payout_id
-- GROUP BY p.id
-- ORDER BY p.created_at DESC;

-- =========================================
-- END OF MIGRATION
-- =========================================
