ALTER TABLE events
ADD COLUMN lp_style ENUM('classic','modern','elegant') NOT NULL DEFAULT 'classic' AFTER status;
