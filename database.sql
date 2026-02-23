-- =========================================
-- DATABASE
-- =========================================
CREATE DATABASE IF NOT EXISTS my_database;
USE my_database;

-- =========================================
-- ROLES
-- =========================================    
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name ENUM('super_admin','sales','finance','affiliate') NOT NULL
);

INSERT INTO roles (name) VALUES
('super_admin'), ('sales'), ('finance'), ('affiliate');

-- =========================================
-- USERS
-- =========================================
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),

    status ENUM('active','inactive') DEFAULT 'active',
    affiliate_status ENUM('inactive','pending','approved','rejected','suspended') DEFAULT 'inactive',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- =========================================
-- EVENTS (EVENT SETTING - SUPER ADMIN)
-- =========================================
CREATE TABLE events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    title VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,

    -- TIPE EVENT
    event_type ENUM('gratis','berbayar') NOT NULL,

    -- HARGA (WAJIB JIKA BERBAYAR)
    price_original DECIMAL(15,2) DEFAULT 0,
    price_promo DECIMAL(15,2) DEFAULT 0,

    -- PEMBAYARAN (ONLY JIKA BERBAYAR)
    payment_methods ENUM('cash','transfer') NULL,

    bank_name VARCHAR(100) NULL,
    bank_account_name VARCHAR(100) NULL,
    bank_account_number VARCHAR(50) NULL,

    -- AFFILIATE
    affiliate_enabled BOOLEAN DEFAULT FALSE,

    -- ADMIN KONFIRMASI
    admin_whatsapp VARCHAR(20),

    -- WAKTU EVENT
    start_date DATE,
    end_date DATE,

    status ENUM('draft','active','inactive') DEFAULT 'draft',

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- =========================================
-- AFFILIATE LINKS
-- =========================================
CREATE TABLE affiliate_links (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id BIGINT,
    event_id BIGINT,
    code VARCHAR(50) UNIQUE,

    clicks INT DEFAULT 0,
    last_clicked_at TIMESTAMP NULL,
    is_active TINYINT(1) DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (affiliate_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- =========================================
-- AFFILIATE REFERRALS (TRACKING)
-- =========================================
CREATE TABLE affiliate_referrals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id BIGINT,
    event_id BIGINT,
    referred_user_id BIGINT,
    referral_code VARCHAR(50),

    converted_at TIMESTAMP NULL, -- When the referred user made a purchase
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (affiliate_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- =========================================
-- CUSTOMERS
-- =========================================
CREATE TABLE customers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- TRANSACTIONS
-- =========================================
CREATE TABLE transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    event_id BIGINT,
    affiliate_id BIGINT,
    customer_id BIGINT,

    payment_method ENUM('cash','transfer'),
    payment_status ENUM('pending','paid','rejected') DEFAULT 'pending',

    total_amount DECIMAL(15,2),

    status ENUM(
        'pending',
        'stage_1_approved',
        'stage_2_approved',
        'stage_3_approved',
        'completed',
        'rejected'
    ) DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (affiliate_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- =========================================
-- PAYMENT PROOF
-- =========================================
CREATE TABLE payment_proofs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT,
    payout_id BIGINT,
    proof_file VARCHAR(255),
    proof_type ENUM('customer_payment','payout_transfer') DEFAULT 'customer_payment',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (payout_id) REFERENCES payouts(id)
);

-- =========================================
-- VERIFICATIONS (3 TAHAP)
-- =========================================
CREATE TABLE verifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT,

    stage TINYINT COMMENT '1=Sales(Chat), 2=Finance(Payment), 3=Sales(Delivery)',
    verifier_id BIGINT,

    status ENUM('approved','rejected'),
    note TEXT,

    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (verifier_id) REFERENCES users(id)
);

-- =========================================
-- COMMISSIONS
-- =========================================
CREATE TABLE commissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT,
    affiliate_id BIGINT,

    stage TINYINT COMMENT '1,2,3',
    amount DECIMAL(15,2),

    stage_status ENUM('waiting','in_review','approved','rejected','expired') DEFAULT 'waiting',
    commission_status ENUM('pending','approved','ready_for_withdraw','paid','rejected') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (affiliate_id) REFERENCES users(id)
);

-- =========================================
-- COMMISSION RULES
-- =========================================
CREATE TABLE IF NOT EXISTS `commission_rules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event_id` bigint DEFAULT NULL,
  `commission_type` enum('flat','percentage') NOT NULL,
  `commission_value` decimal(15,2) NOT NULL,
  `min_stage` tinyint DEFAULT '3',
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` bigint DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `commission_rules_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`),
  CONSTRAINT `commission_rules_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =========================================
-- PAYOUTS
-- =========================================
CREATE TABLE payouts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id BIGINT,
    total_amount DECIMAL(15,2),

    status ENUM('pending','approved','paid') DEFAULT 'pending',
    approved_by BIGINT,
    processed_at TIMESTAMP NULL,

    FOREIGN KEY (affiliate_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- =========================================
-- PAYOUT DETAILS
-- =========================================
CREATE TABLE payout_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payout_id BIGINT,
    commission_id BIGINT,

    FOREIGN KEY (payout_id) REFERENCES payouts(id),
    FOREIGN KEY (commission_id) REFERENCES commissions(id)
);

-- =========================================
-- ACTIVITY LOG
-- =========================================
CREATE TABLE activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE users
ADD bank_name VARCHAR(100) NULL AFTER affiliate_status,
ADD bank_account_name VARCHAR(100) NULL AFTER bank_name,
ADD bank_account_number VARCHAR(50) NULL AFTER bank_account_name;

ALTER TABLE users
ADD no_wa VARCHAR(20) NULL AFTER email;

CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id BIGINT,
    event_id BIGINT,
    referred_user_id BIGINT,
    referral_code VARCHAR(50),
    converted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (affiliate_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- Add new columns to activity_logs table
ALTER TABLE activity_logs
ADD COLUMN approved_by BIGINT AFTER id,
ADD COLUMN target_user_id BIGINT AFTER approved_by,
ADD COLUMN target_type VARCHAR(50) AFTER action,
ADD COLUMN target_id BIGINT AFTER target_type,
ADD COLUMN old_status VARCHAR(50) AFTER target_id,
ADD COLUMN new_status VARCHAR(50) AFTER old_status;

-- Add foreign key constraints
ALTER TABLE activity_logs
ADD CONSTRAINT fk_activity_logs_approved_by 
FOREIGN KEY (approved_by) REFERENCES users(id);

ALTER TABLE activity_logs
ADD CONSTRAINT fk_activity_logs_target_user_id 
FOREIGN KEY (target_user_id) REFERENCES users(id);


ALTER TABLE activity_logs DROP COLUMN user_id;


CREATE TABLE commission_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NULL,

    commission_type ENUM('flat','percentage') NOT NULL,
    commission_value DECIMAL(15,2) NOT NULL,

    min_stage TINYINT DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,

    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
# ========================================= 
-- PACKAGES
-- =========================================
CREATE TABLE packages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  logo_url TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE events
ADD COLUMN headline VARCHAR(255) DEFAULT NULL AFTER title,
ADD COLUMN subheadline TEXT DEFAULT NULL AFTER headline,
ADD COLUMN hero_media_type ENUM('image','video') DEFAULT NULL AFTER subheadline,
ADD COLUMN hero_media_url TEXT DEFAULT NULL AFTER hero_media_type,
ADD COLUMN hero_as_background TINYINT(1) DEFAULT 1 AFTER hero_media_url;

CREATE TABLE event_packages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  package_id BIGINT NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_event_package (event_id, package_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_benefits (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  benefit_text VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_problem_sections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  title VARCHAR(150) DEFAULT NULL,
  subtitle TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_pains (
  id BIGINT NOT NULL AUTO_INCREMENT,
  problem_section_id BIGINT NOT NULL,
  pain_title VARCHAR(150) DEFAULT NULL,
  pain_description TEXT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (problem_section_id) REFERENCES event_problem_sections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE event_faqs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,

  question VARCHAR(255) NOT NULL,
  answer TEXT NOT NULL,

  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_event_id (event_id),

  CONSTRAINT fk_event_faqs_event
    FOREIGN KEY (event_id)
    REFERENCES events(id)
    ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- End of database.sql