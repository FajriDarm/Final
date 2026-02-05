# 🔧 Troubleshooting: Error 500 pada Upload Bukti Transfer

## ❌ Masalah

Saat melakukan "Tandai Dibayar" dengan upload file gambar, muncul error:

```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

## ✅ Solusi

### Step 1: Jalankan Database Migration

**PENTING!** Kolom `payout_id` dan `proof_type` harus ditambahkan ke tabel `payment_proofs`.

**Opsi A: Menggunakan MySQL Client (Recommended)**

```bash
# Login ke MySQL
mysql -u [username] -p

# Pilih database
USE my_database;

# Jalankan script migration
source /path/to/database/migration_payout_proof.sql;

# Verify hasilnya
DESCRIBE payment_proofs;
```

Output yang benar:

```
| Field     | Type         | Null | Key |
|-----------|--------------|------|-----|
| id        | bigint       | NO   | PRI |
| transaction_id | bigint  | YES  | FK  |
| payout_id | bigint       | YES  | FK  | ← BARU
| proof_file| varchar(255) | YES  |     |
| proof_type| enum(...)    | YES  |     | ← BARU
| uploaded_at | timestamp  | YES  |     |
```

**Opsi B: Menggunakan SQL Query Langsung**

Copy-paste di MySQL atau phpMyAdmin:

```sql
ALTER TABLE payment_proofs
ADD COLUMN IF NOT EXISTS payout_id BIGINT DEFAULT NULL AFTER transaction_id;

ALTER TABLE payment_proofs
ADD COLUMN IF NOT EXISTS proof_type ENUM('customer_payment','payout_transfer') DEFAULT 'customer_payment' AFTER proof_file;

ALTER TABLE payment_proofs
ADD CONSTRAINT IF NOT EXISTS fk_payment_proofs_payout
FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE;
```

### Step 2: Restart Node Server

```bash
# Stop server (Ctrl+C jika running)

# Restart dengan
npm start
# atau jika pakai nodemon
npm run dev
```

### Step 3: Clear Browser Cache & Reload

```
- Ctrl+Shift+Delete (buka cache settings)
- atau Ctrl+F5 (hard refresh)
```

### Step 4: Test Upload Ulang

1. Buka Finance Panel
2. Tab "Approved (Menunggu Pembayaran)"
3. Klik "Tandai Dibayar"
4. Upload file gambar (JPG/PNG)
5. Klik "Tandai Dibayar"

---

## 🐛 Debugging: Lihat Error Detail

Jika masih error, cek console/logs:

### Frontend Console (Browser F12)

```javascript
// Buka F12 → Console tab
// Cari message:
"Error: Internal server error";
// Cari network error di Network tab
```

### Backend Logs (Terminal)

```bash
# Output akan terlihat seperti:
Mark withdrawal as paid error: Error: Unknown column 'payout_id' in 'field list'

Error details: {
  message: "Unknown column 'payout_id' in 'field list'",
  code: "ER_BAD_FIELD_ERROR",
  sqlState: "42S22",
  sql: "INSERT INTO payment_proofs ..."
}
```

**Jika error: `Unknown column 'payout_id'`**
→ Database migration belum dijalankan (Step 1)

**Jika error: `File upload validation failed`**
→ Check file format (harus JPG/PNG/PDF)

**Jika error: `ENOENT: no such file or directory`**
→ Directory `/public/uploads/payment_proofs/` tidak ada/permission denied

---

## 📂 Verifikasi Directory Permissions

```bash
# Check directory ada
ls -la /public/uploads/

# Output:
# drwxr-xr-x  payment_proofs

# Jika permission error, jalankan:
chmod 755 /public/uploads/payment_proofs
chmod 777 /public/uploads/payment_proofs  # Jika perlu write access
```

---

## 📦 Verifikasi Package Dependencies

```bash
# Pastikan multer sudah installed
npm list multer

# Output:
# ├── multer@2.0.2

# Jika tidak ada, install:
npm install multer
```

---

## 🔄 Alur Debugging Lengkap

```
1. Database Migration ✓
   ↓
2. Directory Permission ✓
   ↓
3. Restart Server ✓
   ↓
4. Clear Browser Cache ✓
   ↓
5. Test Upload ✓
   ↓
6. Check Console Logs ✓
   ↓
7. Verify Database Record ✓
```

---

## ✅ Verifikasi Sukses

Setelah berhasil, cek:

### 1. Database Record

```sql
SELECT * FROM payment_proofs WHERE proof_type = 'payout_transfer' LIMIT 1;

-- Output:
| id | transaction_id | payout_id | proof_file                      | proof_type      |
|----|----------------|-----------|--------------------------------|-----------------|
| 1  | NULL           | 19        | /uploads/payment_proofs/...jpg  | payout_transfer |
```

### 2. File Uploaded

```bash
ls -la /public/uploads/payment_proofs/

# Output:
-rw-r--r-- 1 owner group 125000 Feb  5 10:30 1707130500000-987654321.jpg
```

### 3. Frontend Success Message

```
✅ Penarikan berhasil ditandai sebagai dibayar dengan bukti transfer!
```

---

## 📞 Jika Masih Error

Beritahu saya dengan screenshot:

1. Error message di browser console
2. Error message di terminal/server logs
3. Struktur tabel `payment_proofs` (hasil `DESCRIBE payment_proofs;`)
4. Apakah sudah jalankan migration?

Maka saya bisa debug lebih detail!
