-- Migration: add per-variant periods and solution section support
-- Target: MySQL 8+
-- Safe to run multiple times.

-- 1) event_variants: add start_date/end_date if missing
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'event_variants'
    AND COLUMN_NAME = 'start_date'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE event_variants ADD COLUMN start_date DATE DEFAULT NULL AFTER price_promo',
  'SELECT "event_variants.start_date already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'event_variants'
    AND COLUMN_NAME = 'end_date'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE event_variants ADD COLUMN end_date DATE DEFAULT NULL AFTER start_date',
  'SELECT "event_variants.end_date already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) New table: event_solution_sections
CREATE TABLE IF NOT EXISTS event_solution_sections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  title VARCHAR(150) DEFAULT NULL,
  subtitle TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_solution_sections_event_id (event_id),
  CONSTRAINT fk_event_solution_sections_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) New table: event_solutions
CREATE TABLE IF NOT EXISTS event_solutions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  solution_section_id BIGINT NOT NULL,
  solution_title VARCHAR(150) DEFAULT NULL,
  solution_description TEXT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_solutions_section_id (solution_section_id),
  CONSTRAINT fk_event_solutions_section
    FOREIGN KEY (solution_section_id) REFERENCES event_solution_sections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) Backfill existing variants with event-level dates where variant dates are null
UPDATE event_variants v
JOIN events e ON e.id = v.event_id
SET
  v.start_date = COALESCE(v.start_date, e.start_date),
  v.end_date = COALESCE(v.end_date, e.end_date)
WHERE v.start_date IS NULL OR v.end_date IS NULL;

-- 5) Optional visibility check
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_variants' AND COLUMN_NAME IN ('start_date','end_date')
  ) AS variant_period_columns_found,
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_solution_sections'
  ) AS solution_sections_table_found,
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_solutions'
  ) AS solutions_table_found;
