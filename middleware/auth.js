const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Get fresh user data from database
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: error.message
    });
  }
};

// Middleware untuk mengecek apakah user SUDAH login
// Jika sudah login, redirect ke dashboard
const checkAlreadyLoggedIn = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      // Tidak ada token, lanjut ke halaman login/register
      return next();
    }

    // Ada token, verifikasi
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('👤 User already logged in, user_id:', decoded.user_id);

    // Ambil data user dari database
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.user_id]
    );

    if (users.length === 0) {
      // Token valid tapi user tidak ditemukan, lanjut ke login
      return next();
    }

    // User sudah login dan valid, redirect ke dashboard sesuai role
    const role = users[0].role;
    if (role === 'super_admin') {
      return res.redirect('/dashboard_admin');
    } else if (role === 'sales') {
      return res.redirect('/dashboard_sales');
    } else {
      return res.redirect('/profile');
    }
  } catch (error) {
    // Token tidak valid, lanjut ke halaman login/register
    console.log('⚠️  Token tidak valid atau expired, mengizinkan akses ke login/register');
    next();
  }
};

const authMiddlewarePage = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      console.log('⚠️  No token found in request');
      return res.redirect('/login');
    }

    console.log('🔍 Token found, verifying...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Token verified, user_id:', decoded.user_id);

    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.user_id]
    );

    if (users.length === 0) {
      console.log('⚠️  User not found in database');
      return res.redirect('/login');
    }

    console.log('✅ User found:', users[0].name);
    req.user = users[0];
    next();
  } catch (error) {
    console.error('❌ Auth middleware page error:', error.message);
    return res.redirect('/login');
  }
};

module.exports = authMiddleware;
module.exports.authMiddlewarePage = authMiddlewarePage;
module.exports.checkAlreadyLoggedIn = checkAlreadyLoggedIn;
