# Payout Proof Implementation - Bukti Transfer Penarikan Komisi

## 📋 Ringkasan Implementasi

Fitur untuk upload dan view bukti transfer (proof) penarikan komisi affiliate telah berhasil diimplementasikan dengan alur approval dari Admin.

---

## 🔄 Alur Sistem

```
FINANCE VIEW (withdrawal_management.ejs)
        ↓
1. Approved status → "Tandai Dibayar"
        ↓
2. Upload file bukti transfer (JPG/PNG/PDF, max 5MB)
        ↓
3. Save ke payment_proofs table + Update payouts status = 'paid'
        ↓
4. Bukti tersimpan dengan status (pending approval dari admin)
        ↓

AFFILIATE VIEW (commission_dashboard.ejs)
        ↓
5. Riwayat Penarikan → Lihat icon bukti ✓
        ↓
6. Klik "Lihat Bukti" → Modal untuk view bukti (image atau PDF)
```

---

## 📝 Perubahan Database

### Table: `payment_proofs`

**Kolom Baru:**

```sql
ALTER TABLE payment_proofs ADD COLUMN payout_id BIGINT;
ALTER TABLE payment_proofs ADD COLUMN proof_type ENUM('customer_payment','payout_transfer') DEFAULT 'customer_payment';
ALTER TABLE payment_proofs ADD FOREIGN KEY (payout_id) REFERENCES payouts(id);
```

**Struktur Akhir:**

```sql
CREATE TABLE payment_proofs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT,              -- Bukti pembayaran customer
    payout_id BIGINT,                   -- Bukti transfer payout (NEW)
    proof_file VARCHAR(255),            -- Path file
    proof_type ENUM('customer_payment','payout_transfer') DEFAULT 'customer_payment',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (payout_id) REFERENCES payouts(id)  -- NEW FK
);
```

---

## 💻 Frontend Changes

### 1. withdrawal_management.ejs (Finance Panel)

**Perubahan:**

- ❌ Hapus: Quill WYSIWYG Editor
- ✅ Tambah: File upload dengan drag & drop
- ✅ Support format: JPG, PNG, PDF
- ✅ Max file size: 5MB

**UI Elements:**

```html
<!-- File Upload Area -->
<div class="border-2 border-dashed border-gray-300 rounded-lg p-6">
  <i class="fas fa-cloud-upload-alt text-3xl"></i>
  <p>Klik untuk upload atau drag & drop</p>
  <input
    type="file"
    accept=".jpg,.jpeg,.png,.pdf"
    onchange="handleFileSelect(event)"
  />
</div>

<!-- File Info Display -->
<div id="proof-file-info">
  <p>File terpilih: <span id="proof-file-name"></span></p>
  <p>Ukuran: <span id="proof-file-size"></span></p>
</div>
```

**JS Functions:**

```javascript
// Handle file selection + validation
function handleFileSelect(event)

// Send file + update payout
async function confirmPaid()
```

---

### 2. commission_dashboard.ejs (Affiliate Panel)

**Perubahan di "Riwayat Penarikan":**

- ✅ Icon indicator untuk bukti tersedia (✓ green check)
- ✅ Tombol "Lihat Bukti" untuk view proof
- ✅ Modal viewer untuk image & PDF

**UI Elements:**

```html
<!-- Icon + Button dalam Riwayat List -->
<i
  class="fas fa-check-circle text-green-600"
  title="Bukti transfer tersedia"
></i>
<button onclick="viewProof(${payoutId})">Lihat Bukti</button>

<!-- Proof Modal -->
<div id="proofModal">
  <!-- Display image atau PDF viewer -->
</div>
```

**JS Functions:**

```javascript
// View bukti transfer
async function viewProof(payoutId)

// Handle image & PDF display
// Close proof modal
function closeProofModal()
```

---

## 🔧 Backend Changes

### 1. financeController.js

**Function: `markWithdrawalAsPaidAPI`**

```javascript
// BEFORE: Accept text proof dari Quill editor
// AFTER: Accept file upload dari multer

exports.markWithdrawalAsPaidAPI = async (req, res) => {
  // 1. Validasi file upload
  // 2. Save ke payment_proofs table
  // 3. Update payouts status = 'paid'
  // 4. Log activity
};
```

**Logic:**

```sql
-- Insert bukti ke payment_proofs
INSERT INTO payment_proofs (payout_id, proof_file, proof_type, uploaded_at)
VALUES (?, ?, 'payout_transfer', NOW())

-- Update payout ke paid status
UPDATE payouts SET status = 'paid', paid_at = NOW() WHERE id = ?
```

### 2. financeRoutes.js

**Tambah multer middleware:**

```javascript
const multer = require("multer");

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
    // Validasi tipe file
  },
});

// Apply ke route
router.post(
  "/api/withdrawals/:id/mark-paid",
  auth,
  upload.single("proof_file"), // ← NEW
  financeController.markWithdrawalAsPaidAPI,
);
```

### 3. withdrawalService.js

**Function: `getWithdrawalDetail`**

**Tambah query:**

```javascript
// Fetch proof file dari payment_proofs
const [proofRows] = await db.query(
  `SELECT proof_file FROM payment_proofs 
   WHERE payout_id = ? AND proof_type = 'payout_transfer' LIMIT 1`,
  [payoutId],
);

// Return dalam response
return {
  ...payout,
  commissions: commissions,
  proof_file: proof_file, // ← NEW
};
```

---

## 📂 File Upload Path

```
/public/uploads/payment_proofs/
  └── {timestamp}-{randomId}.{ext}
```

**Example:**

```
/uploads/payment_proofs/1707130500000-987654321.jpg
/uploads/payment_proofs/1707130510000-876543210.pdf
```

---

## 🧪 Testing Checklist

### Scenario 1: Finance Upload Bukti Transfer

```
✅ 1. Login as Finance user
✅ 2. Buka Manajemen Penarikan → Tab "Approved"
✅ 3. Klik "Tandai Dibayar"
✅ 4. Modal terbuka dengan file upload area
✅ 5. Drag & drop atau klik untuk upload file
✅ 6. Validasi file type & size
✅ 7. Klik "Tandai Dibayar" → Success message
✅ 8. File tersimpan di /public/uploads/payment_proofs/
✅ 9. Database: payment_proofs record created
```

### Scenario 2: Affiliate View Bukti

```
✅ 1. Login as Affiliate user
✅ 2. Buka Commission Dashboard
✅ 3. Tab "Riwayat Penarikan"
✅ 4. Cari payout dengan status 'paid'
✅ 5. Lihat icon ✓ untuk bukti tersedia
✅ 6. Klik "Lihat Bukti"
✅ 7. Modal terbuka menampilkan:
      - Jika image: Preview gambar
      - Jika PDF: Link download / preview
✅ 8. Dapat download/view file
```

### Scenario 3: Validasi File

```
✅ 1. Test upload JPG/PNG → Success
✅ 2. Test upload PDF → Success
✅ 3. Test upload format lain (.doc, .zip) → Error
✅ 4. Test file > 5MB → Error
✅ 5. Test no file selected → Error message
```

---

## 🐛 Troubleshooting

### 1. File Not Found

**Issue:** 404 saat akses file
**Solution:**

```bash
# Pastikan directory ada
mkdir -p /public/uploads/payment_proofs

# Pastikan permissions benar
chmod 755 /public/uploads/payment_proofs
```

### 2. File Size Error

**Issue:** File upload rejected (>5MB)
**Solution:** Edit `financeRoutes.js`

```javascript
limits: { fileSize: 10 * 1024 * 1024 }, // Ubah ke 10MB jika perlu
```

### 3. File Type Not Supported

**Issue:** Upload file valid tapi ditolak
**Solution:** Check `allowedMimes` di routes

```javascript
const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
// Tambah type jika diperlukan
```

### 4. Database Error

**Issue:** payment_proofs columns tidak ada
**Solution:** Run migration

```sql
ALTER TABLE payment_proofs ADD COLUMN payout_id BIGINT;
ALTER TABLE payment_proofs ADD COLUMN proof_type ENUM('customer_payment','payout_transfer') DEFAULT 'customer_payment';
ALTER TABLE payment_proofs ADD FOREIGN KEY (payout_id) REFERENCES payouts(id);
```

---

## 📚 API Endpoints

### 1. POST `/finance/api/withdrawals/:id/mark-paid`

**Request:**

```http
POST /finance/api/withdrawals/123/mark-paid
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
  proof_file: {File object}
  payout_id: 123
```

**Response Success:**

```json
{
  "success": true,
  "message": "Withdrawal marked as paid successfully with proof",
  "data": {
    "payout_id": 123,
    "proof_file": "/uploads/payment_proofs/1707130500000-987654321.jpg"
  }
}
```

**Response Error:**

```json
{
  "success": false,
  "message": "Proof file is required"
}
```

### 2. GET `/affiliate/api/withdrawal/requests/:id`

**Request:**

```http
GET /affiliate/api/withdrawal/requests/123?user_id=456
Authorization: Bearer {token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "affiliate_id": 456,
    "affiliate_name": "John Affiliate",
    "total_amount": 500000,
    "status": "paid",
    "proof_file": "/uploads/payment_proofs/1707130500000-987654321.jpg",
    "commissions": [...],
    "created_at": "2024-02-05..."
  }
}
```

---

## 🔐 Security Considerations

1. **File Upload Validation:**
   - ✅ MIME type validation
   - ✅ File size limit (5MB)
   - ✅ Only image & PDF allowed

2. **Path Traversal Prevention:**
   - ✅ Filename generated dengan timestamp + random
   - ✅ Tidak menggunakan original filename

3. **Access Control:**
   - ✅ Middleware `auth` required
   - ✅ Affiliate hanya bisa view own withdrawal
   - ✅ Finance only bisa upload

---

## 📞 Support

Jika ada issue atau pertanyaan, silakan tanyakan dengan menyebutkan:

- Step yang dijalankan
- Error message yang muncul
- Browser/OS yang digunakan
- Screenshot (jika perlu)

---

**Status:** ✅ IMPLEMENTED & READY FOR TESTING  
**Last Updated:** February 5, 2024
