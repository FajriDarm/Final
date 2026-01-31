# 🔐 JWT Token & Cookie Testing Guide

## ✅ Status JWT

**JWT token berfungsi dengan sempurna!** ✅

Hasil testing menunjukkan:
- ✅ Token creation berhasil
- ✅ Token verification berhasil  
- ✅ Token correctly rejected dengan secret yang salah
- ✅ Expired token correctly rejected
- ✅ Payload decode correct

## 🔍 Cara Debug JWT & Cookie Issues

### 1. **Restart Server dengan Debug Mode**

```bash
cd c:\Users\HP\WebFinal
npm start
# Buka browser console (F12) dan lihat terminal node.js untuk log messages
```

Setelah login, Anda akan lihat di terminal:
```
✅ Login successful for user: test@example.com
🔐 Token created, expires in 7 days
📦 Setting httpOnly cookie...
```

### 2. **Cek Cookies di Browser**

Setelah login:
1. Buka DevTools (F12)
2. Tab **Application** → **Cookies**
3. Cari cookie `token`
4. Seharusnya ada dengan value yang panjang (JWT token)

### 3. **Cek Token di localStorage**

Di DevTools:
1. Tab **Application** → **Local Storage** → `http://localhost:5000`
2. Seharusnya ada:
   - `token`: JWT token string
   - `user`: JSON object dengan user data

### 4. **Manual JWT Test**

```bash
node test-jwt.js
```

Output akan show:
- ✅ Token creation
- ✅ Token verification
- ✅ Wrong secret rejection
- ✅ Expired token rejection

### 5. **Cookie Parser Test**

```bash
node test-cookie.js
```

Kemudian:
1. Buka `http://localhost:5001/set-cookie` (set test cookie)
2. Buka `http://localhost:5001/test-cookie` (check if parsed)
3. Lihat terminal untuk output cookies

## 🧪 Complete Flow Testing

### Langkah 1: Clear All (Fresh Start)
```
1. Buka DevTools (F12) → Application → Cookies → Delete 'token'
2. Application → Local Storage → Delete 'token' dan 'user'
3. Refresh page → harus ke login
```

### Langkah 2: Login
```
Email: test@example.com
Password: password123
```

Monitor terminal untuk:
```
✅ Login successful for user: test@example.com
🔐 Token created, expires in 7 days
📦 Setting httpOnly cookie...
```

### Langkah 3: Check Cookies
```
DevTools → Application → Cookies
Seharusnya ada: token=eyJhbGciOiJIUzI1NiIs...
```

### Langkah 4: Access Protected Pages
```
1. http://localhost:5000/profile
   - Monitor terminal: ✅ Token found, verifying...
   - Monitor terminal: ✅ Token verified, user_id: 1
   - Seharusnya render profile page

2. http://localhost:5000/settings
   - Monitor terminal: ✅ Token found, verifying...
   - Seharusnya render settings page
```

### Langkah 5: Logout
```
Klik Keluar di navbar
- Monitor terminal: Cookies cleared
- Seharusnya redirect ke /login
```

### Langkah 6: Try Access Protected Page After Logout
```
Coba akses http://localhost:5000/profile
- Monitor terminal: ⚠️ No token found in request
- Seharusnya redirect ke /login
```

## 🐛 Common Issues & Solutions

### Issue: Redirect to login saat akses /profile
**Solution:**
1. Cek di terminal apakah ada error message
2. Cek DevTools → Cookies apakah ada 'token'
3. Jika tidak ada, login dulu dengan benar

### Issue: Token verification failed
**Solution:**
1. Cek JWT_SECRET di .env (harus sama di login & verify)
2. Restart server setelah ubah .env
3. Test JWT dengan: `node test-jwt.js`

### Issue: Cookie tidak ter-set
**Solution:**
1. Pastikan `credentials: 'include'` di fetch request (sudah ada di login.ejs)
2. Pastikan `app.use(cookieParser())` sudah ada di app.js
3. Test dengan: `node test-cookie.js`

### Issue: httpOnly Cookie tidak bisa di-akses JavaScript
**Solution:**
- Ini NORMAL! httpOnly cookies tidak bisa diakses JavaScript
- Hanya bisa diakses oleh server saat request
- Aman dari XSS attack!

## 📊 JWT Token Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiYWZmaWxpYXRlIiwiaWF0IjoxNjkwNzc4NTI3LCJleHAiOjE2OTEzODMzMjd9.xyz...

[Header].[Payload].[Signature]
```

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "user_id": 1,
  "email": "test@example.com",
  "role": "affiliate",
  "iat": 1690778527,  // issued at
  "exp": 1691383327   // expires at (7 days)
}
```

## ✅ Checklist

- [ ] JWT creation berfungsi (login successful)
- [ ] Cookie ter-set di browser (DevTools → Cookies)
- [ ] localStorage ter-set dengan token & user
- [ ] Profile page accessible setelah login
- [ ] Settings page accessible setelah login
- [ ] Logout clear cookie
- [ ] Protected pages redirect ke login setelah logout
- [ ] Terminal menampilkan debug logs

## 💡 Tips

1. **Always check terminal logs** untuk debugging
2. **Never log JWT token in production** - security risk
3. **Keep JWT_SECRET aman** di .env file
4. **Use HTTPS in production** dengan `secure: true` di cookie
5. **Test dengan fresh browser tab** untuk clear cache

## 📝 Notes

- JWT expires in: **7 days**
- Cookie httpOnly: **true** (secure dari XSS)
- Cookie secure: **false** (untuk localhost, true di production)
- Cookie sameSite: **lax** (proteksi CSRF)

