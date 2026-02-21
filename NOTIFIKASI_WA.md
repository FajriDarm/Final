📲 WhatsApp Auto Notification System

(Customer Checkout & Payout Success — Fully Automatic)

Dokumen ini menjelaskan mekanisme pengiriman WhatsApp otomatis:

Customer menerima pesan setelah submit checkout

Affiliate menerima pesan setelah komisi cair

Metode ini menggunakan WhatsApp Gateway / WhatsApp API (bukan link wa.me).

1️⃣ Mekanisme WA Otomatis Saat Customer Submit Checkout
🎯 Tujuan

Memberikan konfirmasi otomatis kepada customer bahwa:

Data berhasil diterima

Pendaftaran berhasil

Pembayaran sedang diproses

Customer tidak perlu klik WhatsApp apa pun.
Pesan langsung masuk dari nomor Admin.

🔄 Alur Sistem

Customer mengisi form checkout

Customer menekan tombol Kirim / Submit

Sistem menyimpan data ke database:

customers

transactions

Jika penyimpanan berhasil →
Sistem memanggil layanan WhatsApp Gateway

Gateway mengirim pesan dari nomor Admin ke nomor customer

Customer menerima pesan konfirmasi otomatis

📌 Syarat Agar Bisa Fully Automatic

Karena WhatsApp tidak mengizinkan kirim otomatis dari browser biasa, maka harus menggunakan:

WhatsApp Business API (resmi Meta)
atau

WhatsApp Gateway pihak ketiga (Fonnte, Wablas, Ultramsg, dll)

Tanpa gateway/API, pesan tidak bisa terkirim otomatis.

📄 Isi Pesan ke Customer

Struktur pesan yang disarankan:

Assalamu'alaikum [Nama Customer],

Alhamdulillah, pendaftaran Anda untuk:

[Nama Event]

Telah berhasil kami terima.

Metode Pembayaran: [Transfer / Cash]
Total Pembayaran: Rp [Nominal]

Tim kami akan segera memproses data Anda.
Jika ada pertanyaan, silakan balas pesan ini.

Terima kasih atas kepercayaannya 🙏

🔐 Validasi Sebelum Kirim Pesan

Sistem harus memastikan:

Nomor customer valid (format 62xxxxxxxx)

Data transaksi benar-benar tersimpan

Tidak terjadi error database

Tidak mengirim pesan dua kali (hindari double submit)

2️⃣ Mekanisme WA Otomatis Saat Komisi Affiliate Cair
🎯 Tujuan

Memberikan konfirmasi resmi kepada affiliate bahwa dana telah berhasil ditransfer.

🔄 Alur Sistem

Affiliate mengajukan withdraw

Finance melakukan transfer dana

Finance mengubah status payout menjadi “paid”

Sistem mendeteksi perubahan status

Sistem mengirim pesan WhatsApp otomatis ke affiliate

Affiliate menerima notifikasi pencairan

📄 Isi Pesan ke Affiliate

Assalamu'alaikum [Nama Affiliate],

Alhamdulillah 🎉

Penarikan komisi Anda telah berhasil diproses.

Jumlah Cair: Rp [Nominal]
Bank: [Nama Bank]
Tanggal: [Tanggal]

Dana telah ditransfer ke rekening Anda.

Terima kasih atas kerja samanya 🙏
Semoga semakin sukses bersama kami.

⚠️ Hal Penting yang Harus Diperhatikan

✔ Pesan checkout dikirim hanya setelah transaksi sukses tersimpan
✔ Pesan payout dikirim hanya setelah status benar-benar “paid”
✔ Gunakan log sistem untuk mencatat setiap pengiriman pesan
✔ Batasi pengiriman agar tidak spam
✔ Pastikan server stabil karena pengiriman tergantung koneksi gateway

� Testing dengan nomor pribadi (development)
- Untuk tes cepat gunakan mode `mock` dan override nomor tujuan.
- Environment variables (development):
  - `WA_PROVIDER=mock`
  - `WA_COPY_TO=+6287888669113`  (send copy to tester; messages still go to customer)
- Cara tes singkat:
  1. Start server: `npm run dev`
  2. Submit checkout form atau jalankan `node scripts/test-checkout.js`
  3. Cek terminal — akan muncul log `MOCK WA -> +6287888669117: ...`
  4. Cek `activity_logs` (kolom `action = 'SEND_WA'`) untuk catatan pengiriman.
- Setelah verifikasi, ubah `WA_PROVIDER` ke `wablas`/`waba` dan isi API key sebelum produksi.

�📊 Ringkasan Workflow
Checkout

Customer submit form
→ Data tersimpan
→ Sistem kirim WA otomatis dari Admin
→ Customer menerima pesan

Withdraw

Affiliate request withdraw
→ Finance transfer dana
→ Status payout = paid
→ Sistem kirim WA otomatis ke Affiliate
