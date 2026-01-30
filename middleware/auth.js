const jwt = require("jsonwebtoken");
const db = require("../config/database");

const authMiddleware = async (req, res, next) => {
  try {
    // Try Authorization header, then parsed cookies, then raw Cookie header
    let token =
      req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;

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
          `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, r.name as role
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
            `SELECT u.id, u.name, u.email, u.role_id, u.affiliate_status, u.status, r.name as role
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
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

module.exports = authMiddleware;
