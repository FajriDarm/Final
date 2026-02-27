-- Add event-level active period for auto status management
-- Safe to run multiple times (MySQL 8+)

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'events'
    AND COLUMN_NAME = 'active_start_date'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE events ADD COLUMN active_start_date DATE NULL AFTER end_date',
  'SELECT "events.active_start_date already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'events'
    AND COLUMN_NAME = 'active_end_date'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE events ADD COLUMN active_end_date DATE NULL AFTER active_start_date',
  'SELECT "events.active_end_date already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Optional backfill: if event-level period kosong, pakai periode lama supaya transisi aman
UPDATE events
SET
  active_start_date = COALESCE(active_start_date, start_date),
  active_end_date = COALESCE(active_end_date, end_date)
WHERE active_start_date IS NULL OR active_end_date IS NULL;
