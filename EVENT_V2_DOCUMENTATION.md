📘 Dokumentasi Perubahan Event — Versi 2 (Landing Page CMS)
Overview

Event sebelumnya hanya berfungsi sebagai container pricing & pembayaran.
Pada versi ini, Event ditingkatkan menjadi Landing Page CMS yang mendukung:

Hero Section (headline, subheadline, image/video)

Dynamic Benefits

Problem Amplifier Section (Pain Points)

Dynamic Package Selection (admin hanya isi harga)

Relasi terstruktur & scalable

Perubahan ini membuat Event menjadi fleksibel dan siap untuk kebutuhan marketing.

🎯 Tujuan Perubahan

Sebelumnya:

Event hanya menyimpan harga & metode pembayaran.

Sekarang:

Event menyimpan konten Landing Page lengkap.

Admin dapat membangun LP tanpa hardcode.

Package dapat dipilih & digunakan ulang.

Struktur database dinormalisasi.

🏗️ Perubahan Struktur Database
1️⃣ Update Tabel events

Menambahkan field untuk Hero Section.

ALTER TABLE events
ADD COLUMN headline VARCHAR(255) DEFAULT NULL AFTER title,
ADD COLUMN subheadline TEXT DEFAULT NULL AFTER headline,
ADD COLUMN hero_media_type ENUM('image','video') DEFAULT NULL AFTER subheadline,
ADD COLUMN hero_media_url TEXT DEFAULT NULL AFTER hero_media_type,
ADD COLUMN hero_as_background TINYINT(1) DEFAULT 1 AFTER hero_media_url;
Penjelasan Field Baru
Field	Fungsi
headline	Judul utama LP
subheadline	Subjudul LP
hero_media_type	image / video
hero_media_url	URL atau path upload
hero_as_background	Apakah dijadikan background
2️⃣ Pricing Embedded in Event

Model "packages" sudah tidak digunakan dalam versi terbaru. Semua informasi harga dan
pilihan kini disimpan langsung di tabel `events` (kolom `price_original`,
`price_promo`, dll). Pendekatan ini menyederhanakan alur dan menghilangkan
kebutuhan relasi `packages`/`event_packages`.

> Jika di masa depan diperlukan kembali struktur paket terpisah, kita dapat
> menambahkan tabel baru atau mengembalikan `packages` dengan desain yang
> sesuai.

4️⃣ Tabel event_benefits

Menyimpan benefit yang ditampilkan di LP.

CREATE TABLE event_benefits (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  benefit_text VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
Karakteristik

1 event → banyak benefit

Bisa diurutkan menggunakan sort_order

5️⃣ Tabel event_problem_sections

Header untuk section Problem Amplifier.

CREATE TABLE event_problem_sections (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  title VARCHAR(150) DEFAULT NULL,
  subtitle TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
6️⃣ Tabel event_pains

Detail pain points.

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
Struktur Relasi
events
│
├── event_benefits
│
└── event_problem_sections
      └── event_pains
🎨 Struktur Landing Page Rendering
1️⃣ Hero Section

Ambil dari tabel events.

SELECT * FROM events WHERE slug = ?;
2️⃣ Benefits
SELECT benefit_text
FROM event_benefits
WHERE event_id = ?
ORDER BY sort_order ASC;
3️⃣ Problem Section
SELECT * FROM event_problem_sections
WHERE event_id = ?;
SELECT *
FROM event_pains
WHERE problem_section_id = ?
ORDER BY sort_order ASC;
🧠 Logic Admin Panel

Saat Admin Membuat Event:

Isi Headline

Isi Subheadline

Upload Image / Video

Tambah Benefit (multiple)

Isi Problem Section

Isi Harga (jika berbayar)

Save Event

🔐 Business Rules

✔ Harga wajib jika event berbayar
✔ Benefit & Pain unlimited
✔ Jika event dihapus → semua relasi ikut terhapus (CASCADE)
✔ Struktur scalable & future-ready

🚀 Dampak Perubahan

Event berubah dari:

Pricing Model

Menjadi:

Landing Page CMS + Dynamic Pricing Engine

🔁 Workflow Event V2 — Landing Page CMS + Dynamic Pricing
📌 Overview

Event V2 mengubah Event dari sekadar pricing menjadi:

Landing Page Builder + Dynamic Pricing

Workflow ini menjelaskan alur dari:

Admin membuat event

Admin mengisi konten LP

Admin menentukan harga

Event dipublish

Landing Page ditampilkan ke user

🏗️ WORKFLOW 1 — Super Admin Membuat Event
Step 1 — Masuk ke Event Management

Super Admin Login
↓
Klik Create Event

Step 2 — Isi Informasi Dasar Event

Admin mengisi:

Title

Slug

Event Type (gratis / berbayar)

Start Date

End Date

Status = draft

Simpan → event dibuat

🎨 WORKFLOW 2 — Mengisi Hero Section

Admin mengisi:

Headline

Subheadline

Hero Media Type

image

video

Hero Media URL (upload atau link)

Hero as Background (true / false)

Sistem menyimpan ke tabel:

events
⭐ WORKFLOW 3 — Menambahkan Benefit

Admin klik: Tambah Benefit

Admin bisa:

Tambah 1 benefit

Tambah banyak benefit

Atur urutan

Data masuk ke:

event_benefits

Relasi:
event_id → benefits (1:N)

⚠️ WORKFLOW 4 — Mengisi Problem Amplifier Section

Admin mengisi:

A. Section Header

Problem Title

Problem Subtitle

Masuk ke:

event_problem_sections
B. Tambah Pain Items (Multiple)

Admin klik: Tambah Pain

Isi:

Pain Title

Pain Description

Sort Order

Masuk ke:

event_pains

Relasi:
event_problem_sections → event_pains (1:N)

💼 WORKFLOW 5 — Menentukan Harga

Jika event bertipe berbayar, admin menginput nilai:

- `price_original`
- `price_promo` (opsional)

Nilai harga disimpan langsung di tabel `events`.

Rule:

Harga wajib diisi jika event berbayar

💳 WORKFLOW 6 — Pengaturan Pembayaran

Jika Event Type = BERBAYAR

Admin wajib isi:

Payment Methods (cash / transfer)

Bank Name

Account Number

Account Holder

Admin WhatsApp

Jika Event Type = GRATIS

Sistem otomatis:

Harga NULL

Bank NULL

Payment method NULL

Tidak tampil section pembayaran di LP

🚀 WORKFLOW 7 — Publish Event

Admin klik:

Set Status → active

Validasi sistem:

Headline tidak boleh kosong

Minimal 1 package (jika berbayar)

Harga wajib ada

Jika berbayar → bank wajib ada

Jika valid → Event Active

🌐 WORKFLOW 8 — Landing Page Rendering

User membuka:

/domain/e/{slug}

Sistem melakukan:

1️⃣ Ambil event berdasarkan slug
2️⃣ Ambil hero section
3️⃣ Ambil benefits
4️⃣ Ambil problem section
5️⃣ Ambil pains
6️⃣ Ambil harga & info pembayaran dari tabel events
7️⃣ Render ke frontend

📊 WORKFLOW 9 — Perubahan Harga / Edit Event

Jika admin edit event:

Update headline → langsung update LP

Update benefit → replace data

Update harga → langsung modify kolom pada tabel events

Hapus harga → set nilai 0 atau null sesuai status

Semua relasi ON DELETE CASCADE.

🧠 WORKFLOW 10 — Struktur Relasi Data
events
│
├── event_benefits
│
├── event_problem_sections
│     └── event_pains
│

🔐 VALIDATION RULES
Event Gratis

Tidak perlu payment

Tidak tampil harga

Event Berbayar

Minimal 1 package

Harga wajib

Bank wajib

Payment method wajib

Umum

Slug unique

Package tidak boleh duplicate

Benefit & pain unlimited

🎯 RINGKASAN SUPER SINGKAT

Create Event
↓
Isi Hero
↓
Tambah Benefit
↓
Isi Problem Section
↓
Pilih Package
↓
Isi Harga
↓
Isi Payment
↓
Publish
↓
Landing Page Live

🔥 HASIL AKHIR

Event sekarang:

✅ Dynamic Landing Page Builder
✅ Dynamic Pricing per Package
✅ Scalable
✅ Production Ready
✅ Clean Relational Structure
✅ Tidak Hardcode