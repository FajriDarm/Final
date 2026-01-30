-- Tambahkan kolom event_type ke tabel events
ALTER TABLE events ADD COLUMN event_type ENUM('gratis', 'berbayar') DEFAULT 'berbayar' AFTER status;

-- Update existing records jika perlu
UPDATE events SET event_type = 'berbayar' WHERE event_type IS NULL;
