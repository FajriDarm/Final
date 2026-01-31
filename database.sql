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
    payment_method ENUM('cash','transfer') NULL,

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
    proof_file VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
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
