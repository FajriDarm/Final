# 💰 Commission Affiliate Flow - Complete Documentation

Dokumentasi lengkap alur komisi affiliate, dari transaksi hingga affiliate menerima uang.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Status & States](#status--states)
3. [Alur Lengkap](#alur-lengkap)
4. [Database Schema](#database-schema)
5. [Role & Responsibility](#role--responsibility)
6. [API Endpoints](#api-endpoints)
7. [Withdrawal Request Flow](#withdrawal-request-flow)
8. [Status Timeline](#status-timeline)

---

## Overview

### Key Point
**Affiliate harus secara aktif request/mengajukan withdrawal.** Finance tidak secara otomatis mengirim uang pada akhir bulan. Uang akan tetap tersimpan di komisi dengan status `ready_for_withdraw` sampai affiliate mengajukan request.

### Prinsip
- ✅ Affiliate kontrol kapan withdraw
- ✅ Finance cuma transfer saat ada request & sudah diapprove
- ✅ Transparent tracking untuk setiap request
- ✅ Flexibility untuk affiliate (bisa accumulate atau withdraw berkala)

---

## Status & States

### 1️⃣ Commission Status Lifecycle

```
PENDING
   ↓ (Stage 1 Approved)
WAITING → (Stage 2 Approved) → (Stage 3 Approved)
   ↓
READY_FOR_WITHDRAW  ← Affiliate bisa lihat & request
   ↓ (Masuk payout & transferred)
PAID
```

### 2️⃣ Payout Status (Withdrawal Request)

```
PENDING  ← Affiliate mengajukan request
   ↓
APPROVED  ← Finance mereview & approve
   ↓
PAID  ← Finance transfer uang
   ↓
✅ COMPLETE
```

---

## Alur Lengkap

### 🔄 Complete Commission & Withdrawal Journey

```
STAGE 1 APPROVED (Sales verifikasi intent)
    ↓
STAGE 2 APPROVED (Finance verifikasi pembayaran)
    ↓
STAGE 3 APPROVED (Sales verifikasi delivery)
    ↓
TRANSACTION = COMPLETED
    ↓
📍 COMMISSION RECORD DIBUAT
    commission_status = 'pending'
    commission.amount = CALCULATE(rule)
    ↓
    ↓ (Saat Stage 3 Approved)
    ↓
COMMISSION = READY_FOR_WITHDRAW
    commission_status = 'ready_for_withdraw'
    ↓
    ↓ (Affiliate Login Dashboard)
    ↓
🏦 AFFILIATE MELIHAT SALDO TERSEDIA
    - Total ready_for_withdraw
    - Detail per transaksi
    ↓
    ↓ (Affiliate klik "Request Withdrawal")
    ↓
📍 PAYOUT REQUEST DIBUAT
    INSERT INTO payouts {
      affiliate_id,
      total_amount = SUM(commission ready_for_withdraw),
      status = 'pending'  ← PENDING APPROVAL
    }
    ↓
    INSERT INTO payout_details {
      payout_id,
      commission_id  ← Link semua commission yang di-withdraw
    }
    ↓
    ↓ (Kirim notifikasi ke Finance)
    ↓
💼 FINANCE REVIEW REQUEST
    - Lihat detail affiliate
    - Lihat data bank affiliate
    - Lihat list komisi yang di-withdraw
    ↓
    - [APPROVE] atau [REJECT]
    ↓
JIKA APPROVE:
    UPDATE payouts SET status = 'approved'
    ↓
    ↓ (Finance process transfer)
    ↓
💳 FINANCE TRANSFER UANG
    - Via API Bank atau Manual Transfer
    - Confirm receipt
    ↓
    UPDATE payouts SET 
      status = 'paid',
      processed_at = NOW()
    ↓
    UPDATE commissions SET 
      commission_status = 'paid'
    WHERE commission_id IN (payout_details)
    ↓
✅ AFFILIATE TERIMA UANG
    - Status berubah jadi PAID
    - Riwayat withdrawal tersimpan
    - Saldo terecount untuk next withdraw

JIKA REJECT:
    UPDATE payouts SET status = 'rejected'
    
    UPDATE commissions SET 
      commission_status = 'ready_for_withdraw'  ← Balik ke ready
    
    ✗ Request ditolak, affiliate bisa request lagi
```

---

## Database Schema

### commissions Table

```sql
CREATE TABLE commissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT,
    affiliate_id BIGINT,
    
    stage TINYINT COMMENT '1, 2, atau 3',
    amount DECIMAL(15,2),
    
    -- STATUS TRACKING
    stage_status ENUM('waiting','in_review','approved','rejected','expired') 
        DEFAULT 'waiting',
    
    commission_status ENUM(
        'pending',                -- Menunggu tahap 3
        'approved',               -- Sudah 3 tahap approved
        'ready_for_withdraw',     -- Siap diambil affiliate
        'in_payout',              -- Sedang dalam proses payout
        'paid',                   -- Sudah diterima
        'rejected'                -- Komisi ditolak
    ) DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (affiliate_id) REFERENCES users(id)
);
```

### payouts Table (Withdrawal Request)

```sql
CREATE TABLE payouts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    affiliate_id BIGINT,
    total_amount DECIMAL(15,2),
    
    -- STATUS WITHDRAW REQUEST
    status ENUM(
        'pending',       -- Affiliate baru request, Finance blum review
        'approved',      -- Finance approve request
        'rejected',      -- Finance tolak request
        'paid'           -- Uang sudah dikirim
    ) DEFAULT 'pending',
    
    approved_by BIGINT,           -- Super Admin / Finance yang approve
    processed_at TIMESTAMP NULL,   -- Kapan transfer diproses
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (affiliate_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);
```

### payout_details Table (Link Commission to Payout)

```sql
CREATE TABLE payout_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payout_id BIGINT,
    commission_id BIGINT,
    
    FOREIGN KEY (payout_id) REFERENCES payouts(id),
    FOREIGN KEY (commission_id) REFERENCES commissions(id)
);
```

---

## Role & Responsibility

### Sales Role
```
✅ Verify Stage 1 (Intent/Chat)
✅ Verify Stage 3 (Delivery/Completion)
→ Mengubah commission_status jadi ready_for_withdraw
```

### Finance Role
```
✅ Verify Stage 2 (Payment)
✅ Review withdrawal requests (lihat payout.status = pending)
✅ Approve/Reject withdrawal
✅ Process bank transfer
✅ Update payout.status = paid
✅ Update commission.status = paid
```

### Affiliate Role
```
✅ View dashboard komisi
✅ Create withdrawal request
✅ Track withdrawal status
✅ View payout history
```

### Super Admin Role
```
✅ Can review withdrawal requests (optional oversight)
✅ Can reject/cancel payout requests
```

---

## API Endpoints

### Commission Endpoints (Existing)

```
GET  /api/commissions              → List all commissions (Admin)
GET  /api/commissions/stats        → Commission stats
GET  /api/commissions/:id          → Detail commission
POST /api/commissions              → Create rule (Admin)
PUT  /api/commissions/:id          → Update rule (Admin)
DELETE /api/commissions/:id        → Delete rule (Admin)
```

### NEW: Affiliate Commission Endpoints

```
GET  /api/affiliate/commissions         → List my commissions (Affiliate)
GET  /api/affiliate/commissions/ready   → List ready_for_withdraw (Affiliate)
GET  /api/affiliate/commissions/summary → Summary (pending, ready, paid)
```

### NEW: Withdrawal Request Endpoints

```
POST   /api/affiliate/withdrawal/request      → Affiliate request withdraw
GET    /api/affiliate/withdrawal/requests     → List my requests (Affiliate)
GET    /api/affiliate/withdrawal/requests/:id → Detail request

GET    /api/finance/withdrawal/requests       → List pending requests (Finance)
PUT    /api/finance/withdrawal/requests/:id/approve  → Finance approve
PUT    /api/finance/withdrawal/requests/:id/reject   → Finance reject
PUT    /api/finance/withdrawal/requests/:id/paid     → Mark as paid (after transfer)
```

---

## Withdrawal Request Flow

### Step 1️⃣: Affiliate Buat Request

**Endpoint:**
```
POST /api/affiliate/withdrawal/request
Body: {
  "commission_ids": [1, 2, 3],  // Optional: pilih commission spesifik
                                 // Jika kosong: withdraw all ready_for_withdraw
}
```

**Backend Logic:**
```javascript
// 1. Validasi affiliate
if (!req.user || req.user.role_id !== 4) {
  return res.status(403).json({ error: 'Affiliate only' });
}

// 2. Get komisi yang ready
const readyCommissions = SELECT * FROM commissions 
WHERE affiliate_id = req.user.id 
AND commission_status = 'ready_for_withdraw'
AND (commission_ids IS NULL OR id IN commission_ids)

// 3. Hitung total
const totalAmount = SUM(readyCommissions.amount)

// 4. Buat payout request
INSERT INTO payouts {
  affiliate_id: req.user.id,
  total_amount: totalAmount,
  status: 'pending'
}

// 5. Link commissions
INSERT INTO payout_details {
  payout_id,
  commission_id
}

// 6. Log activity
INSERT INTO activity_logs {
  approved_by: req.user.id,
  action: 'REQUEST_WITHDRAWAL',
  target_type: 'payout',
  target_id: payout.id,
  description: `Affiliate request withdrawal: IDR ${totalAmount}`
}

// 7. Return response
return { success: true, payout_id, total_amount }
```

---

### Step 2️⃣: Finance Review & Approve/Reject

**Endpoint (Approve):**
```
PUT /api/finance/withdrawal/requests/:id/approve
Body: {
  "note": "Approved - akan transfer hari ini"
}
```

**Backend Logic:**
```javascript
// 1. Validasi finance role
if (!req.user || req.user.role_id !== 3) {
  return res.status(403).json({ error: 'Finance only' });
}

// 2. Update payout status
UPDATE payouts SET status = 'approved' WHERE id = req.params.id

// 3. Log activity
INSERT INTO activity_logs {
  approved_by: req.user.id,
  action: 'APPROVE_WITHDRAWAL',
  target_type: 'payout',
  target_id: req.params.id,
  new_status: 'approved',
  description: req.body.note
}

return { success: true, message: 'Withdrawal approved' }
```

**Endpoint (Reject):**
```
PUT /api/finance/withdrawal/requests/:id/reject
Body: {
  "reason": "Bank account invalid"
}
```

**Backend Logic:**
```javascript
// 1. Validasi finance role
if (!req.user || req.user.role_id !== 3) {
  return res.status(403).json({ error: 'Finance only' });
}

// 2. Get payout & commission_ids
const payout = SELECT * FROM payouts WHERE id = req.params.id
const commissionIds = SELECT commission_id FROM payout_details WHERE payout_id = req.params.id

// 3. Update payout status
UPDATE payouts SET status = 'rejected' WHERE id = req.params.id

// 4. Revert commission status (balik ke ready)
UPDATE commissions SET commission_status = 'ready_for_withdraw'
WHERE id IN (commissionIds)

// 5. Log activity
INSERT INTO activity_logs {
  approved_by: req.user.id,
  action: 'REJECT_WITHDRAWAL',
  target_type: 'payout',
  target_id: req.params.id,
  new_status: 'rejected',
  description: req.body.reason
}

return { success: true, message: 'Withdrawal rejected' }
```

---

### Step 3️⃣: Finance Transfer & Mark Paid

**Endpoint:**
```
PUT /api/finance/withdrawal/requests/:id/paid
Body: {
  "transfer_method": "bank_transfer", // atau "cash"
  "transfer_proof": "TRANSFER_REF_123"
}
```

**Backend Logic:**
```javascript
// 1. Validasi finance role
if (!req.user || req.user.role_id !== 3) {
  return res.status(403).json({ error: 'Finance only' });
}

// 2. Get payout & commission_ids
const payout = SELECT * FROM payouts WHERE id = req.params.id
const commissionIds = SELECT commission_id FROM payout_details WHERE payout_id = req.params.id

// 3. Update payout status
UPDATE payouts SET 
  status = 'paid',
  processed_at = NOW()
WHERE id = req.params.id

// 4. Update all commissions to paid
UPDATE commissions SET commission_status = 'paid'
WHERE id IN (commissionIds)

// 5. Log activity
INSERT INTO activity_logs {
  approved_by: req.user.id,
  action: 'PROCESS_WITHDRAWAL',
  target_type: 'payout',
  target_id: req.params.id,
  new_status: 'paid',
  description: `Transferred IDR ${payout.total_amount} via ${req.body.transfer_method}`
}

return { success: true, message: 'Withdrawal processed & paid' }
```

---

## Status Timeline

### Timeline Withdrawal Request

| Stage | Status | Owner | Action | Duration |
|-------|--------|-------|--------|----------|
| 1 | Commission pending | System | Wait stage verification | 0-3 hari |
| 2 | Commission ready_for_withdraw | Affiliate | ----- | Bisa kapan saja |
| 3 | Payout pending | Finance | Review request | 1-2 hari |
| 4 | Payout approved | Finance | Prepare transfer | 1 hari |
| 5 | Payout paid | Finance | Complete | 0 hari |
| 6 | Commission paid | System | Close | ✅ Done |

### Example Timeline

```
Tanggal 5:   Transaksi dibuat
Tanggal 7:   Stage 1 Approved → commission pending
Tanggal 8:   Stage 2 Approved → commission pending
Tanggal 10:  Stage 3 Approved → commission ready_for_withdraw (IDR 50,000)
Tanggal 15:  Affiliate request withdrawal (IDR 50,000) → payout pending
Tanggal 16:  Finance approve → payout approved
Tanggal 17:  Finance transfer + mark paid → payout paid & commission paid
Tanggal 18:  ✅ Uang masuk ke rekening affiliate
```

---

## Key Differences: Old vs New

| Aspek | Old (Batch) | New (On-Demand) |
|-------|------------|-----------------|
| **Inisiasi** | Finance batch akhir bulan | Affiliate request |
| **Timing** | Fixed (akhir bulan) | Flexible (kapan saja) |
| **Kontrol** | Finance | Affiliate |
| **Approval** | 1 step | 2 steps (Review + Transfer) |
| **Akumulasi** | Auto | Manual request |
| **Holdback** | Bisa hold sampai bulan depan | Affiliate kontrol |

---

## Security & Validation

✅ **Affiliate Validation**
```
- Hanya affiliate role bisa request
- Hanya komisi milik affiliate yang bisa di-withdraw
- Hanya komisi status ready_for_withdraw yang valid
```

✅ **Finance Validation**
```
- Hanya finance role bisa approve/reject/mark paid
- Validasi data bank affiliate sebelum transfer
- Prevent double-processing (status check)
```

✅ **Commission Integrity**
```
- Commission tidak bisa di-edit after created
- Reject withdrawal → commission balik ke ready
- Paid commission tidak bisa di-reverse (permanent)
```

---

## Activity Logging

Semua withdrawal activity tercatat di `activity_logs`:

```sql
INSERT INTO activity_logs {
  approved_by,      -- Affiliate/Finance yang action
  action,           -- REQUEST_WITHDRAWAL, APPROVE_WITHDRAWAL, etc
  target_type,      -- 'payout'
  target_id,        -- payout.id
  new_status,       -- pending → approved → paid
  description       -- Detail message
}
```

---

## Summary

✅ **Affiliate-Initiated Withdrawal**
- Affiliate request kapan mereka mau
- Finance review & transfer
- Transparent & flexible

✅ **Status Tracking**
- Commission: pending → ready_for_withdraw → paid
- Payout: pending → approved → paid

✅ **Roles Clear**
- Affiliate: request withdraw
- Finance: review, approve, transfer
- System: track & log everything

✅ **Flexible Timing**
- Affiliate bisa accumulate komisi
- Atau withdraw berkali-kali
- Pilihan ada di tangan affiliate

---

## Next Steps

1. ✅ Create affiliate commission endpoints
2. ✅ Create withdrawal request endpoints
3. ✅ Create finance withdrawal management endpoints
4. ✅ Create affiliate dashboard UI
5. ✅ Create finance dashboard UI
6. ✅ Add notification system

---

**Document Version:** 1.0
**Last Updated:** 2026-02-03
**Status:** Complete
