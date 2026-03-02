CREATE TABLE IF NOT EXISTS event_activity_docs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  media_type ENUM('image','video') DEFAULT 'image',
  media_url TEXT NOT NULL,
  info_text VARCHAR(255) DEFAULT NULL,
  layout_orientation ENUM('portrait','landscape') DEFAULT 'portrait',
  layout_style ENUM('grid','auto_slide') DEFAULT 'grid',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_activity_docs_event_id (event_id),
  CONSTRAINT fk_event_activity_docs_event
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
