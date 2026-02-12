const jwt = require("jsonwebtoken");
const db = require("../config/database");

const authMiddleware = async (req, res, next) => {
  try {
    // Try Authorization header, then parsed cookies, then raw Cookie header
    let token =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.token ||
      req.query?.token ||
      req.query?.access_token;

    // Fallback: parse raw cookie header if needed
    if (!token && req.headers.cookie) {
      const m = req.headers.cookie.match(/(?:^|; )token=([^;]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );

    // Support several possible token id fields for robustness
    const tokenUserId =
      decoded?.user_id ||
      decoded?.id ||
      decoded?.sub ||
      decoded?.userId ||
      decoded?.userid ||
      decoded?._id;

    // Try to find user by id if available
    let users = [];
    if (tokenUserId) {
      try {
        const result = await db.query(
          `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, u.created_at, r.name as role
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE u.id = ?`,
          [tokenUserId],
        );
        users = result[0] || result;
      } catch (e) {
        users = [];
      }
    }

    // If not found by id, try lookup by email (some tokens omit id)
    if (!users || users.length === 0) {
      if (decoded && decoded.email) {
        try {
          const result = await db.query(
            `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, u.created_at, r.name as role
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.email = ? LIMIT 1`,
            [decoded.email],
          );
          users = result[0] || result;
        } catch (e) {
          users = [];
        }
      }
    }

    if (!users || users.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      error: error.message,
    });
  }
};

// Middleware untuk mengecek apakah user SUDAH login
// Jika sudah login, redirect ke dashboard
const checkAlreadyLoggedIn = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;

    if (!token) {
      // Tidak ada token, lanjut ke halaman login/register
      return next();
    }

    // Ada token, verifikasi
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );
    console.log("👤 User already logged in, user_id:", decoded.user_id);

    // Ambil data user dari database
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.user_id],
    );

    if (users.length === 0) {
      // Token valid tapi user tidak ditemukan, lanjut ke login
      return next();
    }

    // User sudah login dan valid, redirect ke dashboard sesuai role
    const role = users[0].role;
    if (role === "super_admin") {
      return res.redirect("/dashboard_admin");
    } else if (role === "sales") {
      return res.redirect("/dashboard_sales");
    } else if (role === "finance") {
      return res.redirect("/dashboard_finance");
    } else {
      return res.redirect("/profile");
    }
  } catch (error) {
    // Token tidak valid, lanjut ke halaman login/register
    console.log(
      "⚠️  Token tidak valid atau expired, mengizinkan akses ke login/register",
    );
    next();
  }
};

const authMiddlewarePage = async (req, res, next) => {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;

    if (!token) {
      console.log("⚠️  No token found in request");
      return res.redirect("/login");
    }

    console.log(
      "🔍 Token found, verifying... (first 8 chars):",
      token ? token.slice(0, 8) + "..." : null,
    );
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
      console.log(
        "✅ Token verified, user_id:",
        decoded.user_id || decoded.id || decoded.sub,
      );
    } catch (err) {
      console.error("Token verification failed:", err.message);
      return res.redirect("/login");
    }

    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, u.created_at, u.no_wa, u.bank_name, u.bank_account_number, u.bank_account_name, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.user_id || decoded.id || decoded.sub],
    );
    console.log("user lookup count:", users.length);

    if (users.length === 0) {
      console.log("⚠️  User not found in database");
      return res.redirect("/login");
    }

    console.log("✅ User found:", users[0].name);
    req.user = {
      ...users[0],
      phone: users[0].no_wa || "",
      bank_name: users[0].bank_name || "",
      bank_account: users[0].bank_account_number || "",
      bank_account_name: users[0].bank_account_name || "",
    };
    next();
  } catch (error) {
    console.error("❌ Auth middleware page error:", error.message);
    return res.redirect("/login");
  }
};

module.exports = authMiddleware;
// Require a specific role (e.g., 'finance', 'sales', 'affiliate')
function requireRole(roleOrRoles) {
  const allowed = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return (req, res, next) => {
    try {
      if (!req.user) {
        if (req.accepts && req.accepts("html")) return res.redirect("/login");
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (!allowed.includes(req.user.role)) {
        if (req.accepts && req.accepts("html"))
          return res.redirect("/dashboard");
        return res.status(403).json({
          success: false,
          message: `Forbidden - role '${req.user.role}' not allowed`,
        });
      }
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
}

module.exports.verifyToken = authMiddleware;
module.exports.authMiddlewarePage = authMiddlewarePage;
module.exports.checkAlreadyLoggedIn = checkAlreadyLoggedIn;
module.exports.requireRole = requireRole;
