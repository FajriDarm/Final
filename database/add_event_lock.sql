-- Add event lock flag (prevent edit/delete when locked)
-- Safe to run multiple times (MySQL 8+)

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'events'
    AND COLUMN_NAME = 'is_locked'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE events ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER status',
  'SELECT "events.is_locked already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
