-- =========================================
-- ADD CASCADE DELETE TO FOREIGN KEYS
-- =========================================
USE my_database;

-- Drop existing foreign key constraints on affiliate_links
ALTER TABLE affiliate_links DROP FOREIGN KEY affiliate_links_ibfk_2;

-- Add new foreign key with CASCADE DELETE
ALTER TABLE affiliate_links 
ADD CONSTRAINT fk_affiliate_links_event_id 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Drop and recreate foreign key for affiliate_referrals
ALTER TABLE affiliate_referrals DROP FOREIGN KEY affiliate_referrals_ibfk_2;

ALTER TABLE affiliate_referrals 
ADD CONSTRAINT fk_affiliate_referrals_event_id 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Drop and recreate foreign key for transactions
ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_1;

ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_event_id 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
