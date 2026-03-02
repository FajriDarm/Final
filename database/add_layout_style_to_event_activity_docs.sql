ALTER TABLE event_activity_docs
ADD COLUMN layout_style ENUM('grid','auto_slide') DEFAULT 'grid' AFTER layout_orientation;
