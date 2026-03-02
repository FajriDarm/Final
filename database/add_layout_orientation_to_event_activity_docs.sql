ALTER TABLE event_activity_docs
ADD COLUMN layout_orientation ENUM('portrait','landscape') DEFAULT 'portrait' AFTER info_text;
