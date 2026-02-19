<!-- UPDATED: `verify-stage1` & `verify-stage3` deprecated — functionality konsolidasi ke `verify-leads` (lihat bagian "Ringkasan singkat (apa yang berubah)") -->

# Workflow Sistem Affiliate (Final) — (updated)

Dokumen ini menjelaskan **alur kerja lengkap sistem affiliate** dengan **4 role utama**
(Super Admin, Sales, Finance, Affiliate) serta **3 tahap verifikasi**, dari pembuatan event
hingga payout komisi.

> Ringkasan singkat (apa yang berubah):
>
> - `verify-stage1` dan `verify-stage3` **deprecated** — UI/API digantikan oleh `verify-leads`.
> - Gunakan `GET /sales/verify-leads` untuk UI, `POST /sales/update-lead-status` untuk aksi, dan `GET /sales/lead-events` untuk SSE.
> - Workflow dan dokumentasi di bawah ini telah diperbarui untuk mencerminkan konsolidasi tersebut.

---

## 1. Role & Tanggung Jawab

### 1. Super Admin

**Halaman:**

- Dashboard Super Admin
- Event Management
- Affiliate Approval
- Payout Approval
- Activity Log

**Tugas:**

- Membuat & mengatur event promo
- Mengatur harga coret & harga promo
- Menentukan metode pembayaran (cash / transfer)
- Mengatur rekening tujuan pembayaran
- Approve / reject pendaftaran affiliate
- Approve batch payout akhir bulan
- Monitoring seluruh aktivitas sistem

---

### 2. Sales

**Halaman:**

- Dashboard Sales
- Transaction Review
- Verification Stage 1 & 3
- Monitoring Affiliate

**Tugas:**

- Verifikasi chat / intent customer (Tahap 1)
- Verifikasi pengiriman / penyelesaian order (Tahap 3)
- Approve / reject setiap tahap komisi
- Monitoring performa affiliate

---

### 3. Finance

**Halaman:**

- Dashboard Finance
- Payment Verification
- Payout Processing

**Tugas:**

- Verifikasi pembayaran (DP / lunas)
- Validasi bukti transfer / cash
- Rekonsiliasi keuangan
- Proses payout setelah disetujui Super Admin

---

### 4. Affiliate

**Halaman:**

- Dashboard Affiliate
- Event List
- Affiliate Link
- Transaction List
- Commission & Withdraw

**Tugas:**

- Mendaftar sebagai affiliate
- Generate link affiliate
- Promosi produk
- Monitoring komisi & status transaksi
- Mengajukan withdraw

---

## 2. Workflow Utama Sistem

---

## Workflow 0 – Setup Event (Super Admin)

Super Admin Login
↓
Buat Event Promo
↓
Atur:

Harga awal (harga coret)

Harga promo

Metode pembayaran

Rekening tujuan

Periode event
↓
Simpan Event (draft)
↓
Aktifkan Event (active)

**Output:**

- Event siap digunakan affiliate
- Landing Page otomatis menampilkan harga promo

---

## Workflow 1 – Pendaftaran Affiliate

User Login
↓
Klik "Daftar Affiliate"
↓
affiliate_status = pending
↓
Super Admin Review
├─ Approve → affiliate_status = approved
└─ Reject → affiliate_status = rejected

**Catatan:**

- Affiliate **tidak bisa generate link sebelum approved**

---

## Workflow 2 – Generate Link Affiliate

Affiliate Login
↓
Pilih Event Active
↓
Generate Link Affiliate
↓
Sistem membuat:

affiliate_links.code

tracking click

**Output:**

- Link siap dibagikan ke customer

---

## Workflow 3 – Customer Click & Isi Data

Customer klik link affiliate
↓
Masuk ke Landing Page
↓
Isi data:

Nama

Email

No HP
↓
Pilih metode pembayaran
↓
Data tersimpan:

customers

transactions

---

## Workflow 4 – Pembayaran Customer

### A. Transfer

Customer submit data
↓
Muncul form transfer
↓
Customer upload bukti transfer
↓
payment_status = pending

### B. Cash

Customer submit data
↓
payment_status = pending
↓
Menunggu bukti pembayaran

---

## Workflow 5 – Verifikasi (Dropdown oleh Finance & Admin)

Alur verifikasi tiga-tahap lama telah disederhanakan: verifikasi kini dilakukan melalui dropdown/status pada halaman Finance / Admin, sementara Sales tetap menggunakan halaman terpusat `verify-leads` untuk mengelola lead (intent/delivery).

- Sales: mengatur `lead_status` lewat `GET /sales/verify-leads` / `POST /sales/update-lead-status` (nilai seperti `LEAD BARU`, `SEDANG DI PROSPEK`, `HOT`, `DP`, `LUNAS`, `SEDANG BERANGKAT`, `REJECTED`).
- Finance / Admin: memverifikasi pembayaran dan mengubah status transaksi melalui dropdown pada halaman Payment Verification / Admin Dashboard (mis. `payment_status`: `pending`, `paid`, `invalid`; dan/atau mengubah `lead_status`).

Perilaku penting saat status berubah:

- Jika `lead_status` diset `SEDANG BERANGKAT` (oleh Sales atau Finance/Admin), sistem akan:
  - mencoba men-award komisi stage‑3 (idempotent),
  - set komisi stage‑3 menjadi `ready_for_withdraw`,
  - **default:** *tidak melakukan auto‑payout* — pembuatan/penandaan payout sebagai `paid` hanya terjadi jika fitur `AUTO_PAYOUT_ON_STAGE3` diaktifkan (env var). Ini mencegah payout prematur dan memungkinkan Finance melakukan verifikasi manual sebelum pembayaran;
  - memastikan `transactions.payment_status = 'paid'` serta `transactions.status` dapat diupdate ke tanda internal yang cocok (mis. `stage_3_approved`).

  Catatan: untuk mengaktifkan auto-payout tambahkan `AUTO_PAYOUT_ON_STAGE3=true` pada konfigurasi lingkungan.
- Jika Finance mengubah `payment_status` menjadi `paid`, ini menjadi otoritatif untuk proses payout/reconciliation.

Aturan bisnis (ringkas):

- Komisi hanya bisa ditarik bila kondisi pembayaran valid dan lead telah mencapai status yang memadai (mis. `SEDANG BERANGKAT`).
- Cash tidak di‑auto‑valid oleh Finance; butuh verifikasi manual.
- Affiliate tidak boleh mengedit transaksi setelah submit.
- Withdraw harus diverifikasi data bank affiliate sebelum diproses.

Catatan migrasi: setiap UI atau script yang sebelumnya menargetkan endpoint `verify-stage1` / `verify-stage3` harus dialihkan ke:

- UI terpusat Sales: `GET /sales/verify-leads` (render)
- Aksi ubah status: `POST /sales/update-lead-status`
- SSE untuk notifikasi real‑time: `GET /sales/lead-events`

---

## Workflow 6 – Komisi Affiliate

Tahap 1 approved → komisi pending
Tahap 2 approved → komisi pending
Tahap 3 approved → komisi ready_for_withdraw

**Rule Atomic:**
Jika semua tahap approved
→ Semua komisi = READY FOR WITHDRAW

---

## Workflow 7 – Dashboard Affiliate

**Yang Ditampilkan:**

- Total pending komisi
- Ready for withdraw
- Riwayat transaksi
- Status setiap tahap

---

## Workflow 8 – Payout Akhir Bulan

Tanggal 25

Finance generate laporan komisi

Tanggal 28–30

Super Admin approve payout

Finance transfer dana

Status komisi → PAID

---

## 3. Ringkasan Alur Global

Super Admin buat event
↓
Affiliate generate link
↓
Customer klik & isi data
↓
Pembayaran
↓
Verifikasi 3 tahap
↓
Komisi siap ditarik
↓
Payout akhir bulan

---

## 4. Kesimpulan

- Workflow **aman untuk produksi**
- Role & tanggung jawab jelas
- Cocok untuk Node.js + Express.js + REST API
- Siap digunakan sebagai:
  - Dokumentasi backend
  - SOP internal
  - Acuan frontend

## EVENT >

1️⃣ JIKA EVENT = GRATIS

✅ Yang ditampilkan:

Nama Event

Deskripsi

Tanggal & Waktu

Admin WhatsApp

❌ Yang disembunyikan:

Metode Pembayaran

Bank

No Rekening

Atas Nama

Harga

Affiliate

Diskon

👉 User langsung bisa daftar tanpa bayar

2️⃣ JIKA EVENT = BERBAYAR

✅ WAJIB ditampilkan (seperti gambar kamu):

🔹 Pembayaran

Metode (Manual Transfer / Gateway)

Bank

No Rekening

Atas Nama

🔹 Harga

Harga Coret (sebelum diskon)

Harga Aktif

🔹 Affiliate (opsional)

Toggle: Aktifkan Affiliate

(kalau ON → event bisa dipromosikan affiliate)

🔹 Admin WhatsApp

Untuk konfirmasi pembayaran

## WORKFLOW AFFILATE

🔁 WORKFLOW AFFILIATE

Dari Copy Link sampai Affiliate Menerima Uang

🟢 PRAKONDISI (WAJIB)

Affiliate SUDAH APPROVED

Event ACTIVE

Event affiliate_enabled = TRUE

1️⃣ Affiliate Copy / Generate Link
Alur

Affiliate Login
↓
Buka Event List
↓
Klik Generate / Copy Affiliate Link

Sistem Melakukan

Generate code unik

Simpan ke tabel:

affiliate_links

- affiliate_id
- event_id
- code (UNIQ)
- clicks = 0
- is_active = 1

Output ke Affiliate
https://domain.com/e/{event_slug}?ref=AFF123XYZ

2️⃣ Customer Klik Link Affiliate
Alur

Customer klik link
↓
Sistem membaca ref
↓
Tracking click

Update Database
affiliate_links.clicks +1
affiliate_links.last_clicked_at = now()

3️⃣ Customer Masuk Landing Page (LP)
LP Menampilkan

Nama Event

Deskripsi

Harga coret & promo

Form input customer

Pilihan pembayaran:

Transfer

Cash

4️⃣ Customer Isi Form & Submit
Customer Mengisi

Nama

Email

No HP

Pilih metode pembayaran

Database
customers
name
email
phone

transactions
event_id
affiliate_id
customer_id
payment_method
payment_status = pending
transaction_status = pending

5️⃣ Pembayaran Customer
A. TRANSFER

Customer:

Transfer ke rekening event

Upload bukti

payment_proofs

- transaction_id
- proof_file

B. CASH

Customer:

Menunggu konfirmasi manual

payment_status = pending

6️⃣ VERIFIKASI TAHAP 1 — SALES (INTENT)

Sales:

Cek chat / komunikasi

Pastikan customer real

Hasil
Keputusan Dampak
Approve Stage 1 approved
Reject Transaction rejected
Database
verifications

- transaction_id
- stage = 1
- status = approved

7️⃣ VERIFIKASI TAHAP 2 — FINANCE (PEMBAYARAN)

Finance:

Cek mutasi / bukti transfer

Validasi cash / transfer

Hasil
Keputusan Dampak
Approve Stage 2 approved
Reject Transaction rejected
verifications

- stage = 2

8️⃣ VERIFIKASI TAHAP 3 — SALES (DELIVERY)

Sales:

Pastikan layanan / produk sudah diterima

Event selesai / produk dikirim

transaction_status = completed

verifications

- stage = 3
- status = approved

9️⃣ KOMISI AFFILIATE DIHITUNG
Rule

Komisi TIDAK BISA DITARIK sebelum semua stage approved

Database
commissions

- transaction_id
- affiliate_id
- amount
- commission_status = ready_for_withdraw

🔟 Affiliate Melihat Dashboard

Affiliate melihat:

Total pending

Total ready for withdraw

Riwayat transaksi

1️⃣1️⃣ Affiliate Request Withdraw

Affiliate:

Klik Withdraw

Pilih saldo tersedia

payouts

- affiliate_id
- total_amount
- status = pending

1️⃣2️⃣ Finance Proses Withdraw

Finance:

Cek data bank affiliate

Transfer dana

payouts.status = paid
processed_at = now()

1️⃣3️⃣ UANG MASUK KE AFFILIATE 🎉
Final Status

Komisi → paid

Payout → paid

Aktivitas tercatat

activity_logs

🔐 RULE WAJIB (ANTI FRAUD)

✔ Komisi hanya READY jika 3 tahap approved
✔ Cash TIDAK AUTO VALID
✔ Affiliate tidak bisa edit transaksi
✔ Withdraw butuh data bank valid

🧠 RINGKASAN SUPER SINGKAT
Copy Link
↓
Customer klik
↓
Isi form
↓
Bayar
↓
Verifikasi 1
↓
Verifikasi 2
↓
Verifikasi 3
↓
Komisi READY
↓
Withdraw
↓
Affiliate terima uang

---

**Daftar Nilai Status (Dropdown) — Referensi**

- **Lead status (`lead_status`)** — nilai yang digunakan di UI Sales / Finance:
  - `LEAD BARU`, `SEDANG DI PROSPEK`, `HOT`, `DP`, `LUNAS`, `SEDANG BERANGKAT`, `REJECTED`.
  - Siapa yang dapat mengubah: `Sales` via `verify-leads` UI; `Finance`/`Admin` juga dapat menyesuaikan pada halaman Payment Verification / Admin.

- **Payment status (`payment_status`)** — status pembayaran transaksi:
  - `pending`, `dp`, `paid`, `invalid` (varian lain: `pending_payment` pada beberapa proses internal).
  - Diubah oleh: `Finance` saat verifikasi pembayaran, atau otomatis oleh sistem pada flows tertentu.

- **Transaction status (`status`)** — lifecycle internal transaksi:
  - `pending`, `stage_1_approved`, `stage_2_approved`, `stage_3_approved`, `completed`, `rejected`.
  - Diatur oleh controller (Sales/Finance flows) dan beberapa otomatisasi internal.

- **Commission status (`commission_status`)** — status komisi:
  - `pending`, `ready_for_withdraw`, `paid`, (kadang `pending_payment`).
  - Diubah oleh proses awarding/payout.

- **Payout status (`payout.status`)** — status proses payout:
  - `pending`, `paid` (kemungkinan `canceled` tergantung implementasi tambahan).

Catatan singkat: nilai-nilai di atas diambil dari implementasi saat ini (`views`, `controllers`, dan `scripts`) — jika Anda ingin menormalkan atau membatasi nilai yang valid (mis. paksa semua huruf kapital atau definisikan enum), saya dapat bantu membuat satu tempat sumber kebenaran (konstanta) di kode.
