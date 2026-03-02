ALTER TABLE event_testimonials
ADD COLUMN layout_style ENUM('grid','auto_slide') DEFAULT 'grid' AFTER sort_order;
