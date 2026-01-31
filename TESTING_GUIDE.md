# 🧪 Testing Profile & Settings Flow

## ✅ Masalah yang sudah diperbaiki:

1. **Cookie Parser Middleware** - Ditambahkan `cookie-parser` di `app.js` untuk parse cookies dari request
2. **Login Credentials** - Login sudah punya `credentials: 'include'` untuk mengirim cookies ke browser
3. **Test User** - User test sudah dibuat: `test@example.com / password123`

## 📝 Step-by-Step Testing:

### 1. **Login**
- Buka `http://localhost:5000/login`
- Masukkan email: `test@example.com`
- Masukkan password: `password123`
- Klik "Log In"
- ✓ Seharusnya redirect ke `/dashboard`

### 2. **Dashboard Redirect**
- Dari dashboard, seharusnya redirect berdasarkan role:
  - Affiliate role → redirect ke `/profile`
  - Admin role → redirect ke `/dashboard_admin`
  - Sales role → redirect ke `/dashboard_sales`

### 3. **Profile Page**
- Buka `http://localhost:5000/profile` (setelah login)
- ✓ Seharusnya menampilkan data user dari database
- ✓ Bisa edit nama dan email
- ✓ Klik "Simpan Perubahan" → update ke database

### 4. **Settings Page**
- Buka `http://localhost:5000/settings` (setelah login)
- ✓ Ubah password → verify password lama, update password baru
- ✓ Toggle notifikasi → simpan ke backend
- Klik "Simpan Pengaturan"

### 5. **Logout**
- Di navbar, klik avatar profile → klik "Keluar"
- ✓ Form POST ke `/logout`
- ✓ Clear cookie dan redirect ke `/login`
- ✓ Coba buka `/profile` → harus redirect ke login

## 🔍 Debugging Tips:

Jika masih redirect ke login saat mengakses `/profile`:

1. **Check cookie di browser:**
   - Buka DevTools (F12) → Application → Cookies
   - Seharusnya ada cookie `token` setelah login

2. **Check server logs:**
   - Lihat terminal node.js apakah ada error saat middleware

3. **Check localStorage:**
   - DevTools → Application → Local Storage
   - Seharusnya ada `token` dan `user` setelah login

## 📋 Database Credentials:
- **Host:** localhost
- **User:** root
- **Password:** (kosong)
- **Database:** my_database
- **Table:** users, roles

## ✨ Yang Sudah Diimplementasikan:

✅ Cookie parser middleware
✅ Login set cookie httpOnly (7 hari)
✅ authMiddlewarePage untuk protect halaman
✅ Profile form update nama/email
✅ Settings form ubah password
✅ Logout clear cookie & redirect
✅ Test user ready
✅ Database integration lengkap
