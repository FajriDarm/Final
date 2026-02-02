-- =========================================
-- ADD CASCADE DELETE TO FOREIGN KEYS
-- =========================================
USE my_database;

-- 1. affiliate_links → events
ALTER TABLE affiliate_links DROP FOREIGN KEY affiliate_links_ibfk_2;
ALTER TABLE affiliate_links 
ADD CONSTRAINT fk_affiliate_links_event_id 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- 2. affiliate_referrals → events
ALTER TABLE affiliate_referrals DROP FOREIGN KEY affiliate_referrals_ibfk_2;
ALTER TABLE affiliate_referrals 
ADD CONSTRAINT fk_affiliate_referrals_event_id 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- 3. transactions → events
ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_1;
ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_event_id 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- 4. payment_proofs → transactions
ALTER TABLE payment_proofs DROP FOREIGN KEY payment_proofs_ibfk_1;
ALTER TABLE payment_proofs 
ADD CONSTRAINT fk_payment_proofs_transaction_id 
FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;

-- 5. verifications → transactions
ALTER TABLE verifications DROP FOREIGN KEY verifications_ibfk_1;
ALTER TABLE verifications 
ADD CONSTRAINT fk_verifications_transaction_id 
FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;

-- 6. commissions → transactions
ALTER TABLE commissions DROP FOREIGN KEY commissions_ibfk_1;
ALTER TABLE commissions 
ADD CONSTRAINT fk_commissions_transaction_id 
FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;

-- 7. payout_details → commissions
ALTER TABLE payout_details DROP FOREIGN KEY payout_details_ibfk_2;
ALTER TABLE payout_details 
ADD CONSTRAINT fk_payout_details_commission_id 
FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE;

-- =========================================
-- SUMMARY
-- =========================================
-- Event → Transactions → Commissions → Payout Details
--       → Payment Proofs
--       → Verifications
-- Affiliate Links
-- Affiliate Referrals
--
-- Now when you delete an event, all related data cascades down automatically.
