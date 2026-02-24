-- Migration: allow multiple payment methods by changing ENUM to VARCHAR
-- Run this against your database to allow CSV multi-selection in payment_methods
ALTER TABLE events
  MODIFY COLUMN payment_methods VARCHAR(255) NULL;

-- Note: If you need to revert, convert values back to a single choice compatible with the ENUM and then ALTER TABLE to ENUM(...).
