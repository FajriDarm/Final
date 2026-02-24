-- Add repeatable variants and testimonials for events

CREATE TABLE IF NOT EXISTS event_testimonials (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  media_type ENUM('image','video') DEFAULT 'image',
  media_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_testimonials_event_id (event_id),
  CONSTRAINT fk_event_testimonials_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_variants (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  event_type ENUM('gratis','berbayar') NOT NULL DEFAULT 'berbayar',
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT DEFAULT NULL,
  price_original DECIMAL(15,2) DEFAULT 0,
  price_promo DECIMAL(15,2) DEFAULT 0,
  logo_media_type ENUM('image','video') DEFAULT NULL,
  logo_media_url TEXT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_variants_event_id (event_id),
  KEY idx_event_variants_slug (slug),
  CONSTRAINT fk_event_variants_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
