const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/database");
const { sendPasswordResetEmail } = require("../services/emailService");

const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, agree_terms } = req.body;

    // Get affiliate tracking info from cookies
    const affiliateRef = req.cookies.affiliate_ref;
    const eventSlug = req.cookies.event_slug;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
        errors: {
          ...(name ? {} : { name: ["Name is required"] }),
          ...(email ? {} : { email: ["Email is required"] }),
          ...(password ? {} : { password: ["Password is required"] }),
        },
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
        errors: {
          confirmPassword: ["Passwords do not match"],
        },
      });
    }

    if (!agree_terms) {
      return res.status(400).json({
        success: false,
        message: "You must agree to the Terms & Conditions",
        errors: {
          agree_terms: ["You must agree to the Terms & Conditions"],
        },
      });
    }

    // Check if email already exists
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
        errors: {
          email: ["Email already registered"],
        },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if roles table exists
    let roleId = 4; // Default to affiliate/user role
    let isAffiliate = false;
    try {
      const [roles] = await db.query(
        "SELECT id FROM roles WHERE name = ? LIMIT 1",
        ["affiliate"],
      );
      if (roles.length > 0) {
        roleId = roles[0].id;
        isAffiliate = true;
      }
    } catch (err) {
      // If roles table doesn't exist, we'll insert without role_id
    }

    // Determine initial affiliate status
    const affiliateStatus = isAffiliate ? "pending" : "inactive";

    // Insert user - try with role_id first, fall back to simple insert
    let result;
    try {
      [result] = await db.query(
        'INSERT INTO users (name, email, password, role_id, affiliate_status, status) VALUES (?, ?, ?, ?, ?, "active")',
        [name, email, hashedPassword, roleId, affiliateStatus],
      );
    } catch (error) {
      // If that fails (e.g., roles table missing), try inserting with affiliate_status but without role_id
      try {
        [result] = await db.query(
          "INSERT INTO users (name, email, password, affiliate_status, status) VALUES (?, ?, ?, ?, 'active')",
          [name, email, hashedPassword, affiliateStatus],
        );
      } catch (error2) {
        throw error;
      }
    }

    // Get user with role
    let newUser;
    try {
      const [newUsers] = await db.query(
        `SELECT u.id, u.name, u.email, u.affiliate_status, u.status,
         COALESCE(r.name, 'user') as role
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [result.insertId],
      );
      newUser = newUsers[0];
    } catch (err) {
      // Fallback to simple query
      const [newUsers] = await db.query(
        "SELECT id, name, email, ? as role FROM users WHERE id = ?",
        ["user", result.insertId],
      );
      newUser = newUsers[0];
    }

    // Create JWT token
    const token = jwt.sign(
      {
        user_id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    // Affiliate tracking: log the referral if tracking cookie exists
    if (affiliateRef) {
      try {
        // Parse affiliate code to get affiliate_id and event_id
        // Format: AFF{affiliate_id}-E{event_id}-{RANDOM}
        const refMatch = affiliateRef.match(/^AFF(\d+)-E(\d+)-/);

        if (refMatch) {
          const affiliateId = refMatch[1];
          const eventId = refMatch[2];

          // Log affiliate referral (you can create a separate table for this)
          await db.query(
            `INSERT INTO affiliate_referrals (affiliate_id, event_id, referred_user_id, referral_code, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [affiliateId, eventId, newUser.id, affiliateRef],
          );

          console.log(
            `[Affiliate Tracking] User ${newUser.id} referred by affiliate ${affiliateId} for event ${eventId} with code ${affiliateRef}`,
          );
        }
      } catch (trackingError) {
        // Don't fail registration if tracking fails
        console.error(
          "[Affiliate Tracking] Failed to log referral:",
          trackingError,
        );
      }
    }

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token: token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        affiliate_status:
          newUser.affiliate_status || affiliateStatus || "inactive",
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
        errors: {
          ...(email ? {} : { email: ["Email is required"] }),
          ...(password ? {} : { password: ["Password is required"] }),
        },
      });
    }

    // Find user - try with role join first, fall back to simple query
    let users;
    try {
      [users] = await db.query(
        `SELECT u.*, r.name as role
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.email = ?`,
        [email],
      );
    } catch (err) {
      // Fallback to simple query
      [users] = await db.query(
        "SELECT *, ? as role FROM users WHERE email = ?",
        ["user", email],
      );
    }

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        errors: {
          email: ["Invalid email or password"],
        },
      });
    }

    const user = users[0];

    // Check if account is active (if status field exists)
    if (user.status !== undefined && user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
        errors: {
          email: ["Account is inactive"],
        },
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        errors: {
          password: ["Invalid email or password"],
        },
      });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        role: user.role || "user",
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    console.log("✅ Login successful for user:", user.email);
    console.log("🔐 Token created, expires in 7 days");
    console.log("📦 Setting httpOnly cookie...");

    // Set token in cookie for page authentication
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: false,
      sameSite: "lax",
    });

    res.json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
        affiliate_status: user.affiliate_status || "inactive",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.affiliate_status, u.status, u.created_at,
         u.no_wa, u.bank_name, u.bank_account_name, u.bank_account_number,
         r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        ...users[0],
        phone: users[0].no_wa || "",
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  res.json({
    success: true,
    message: "Logout successful",
  });
};

const updateProfile = async (req, res) => {
  try {
    // Gabungkan field dari kedua versi
    const {
      name,
      email,
      phone,
      bank_name,
      bank_account_name,
      bank_account_number,
      bank_account,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // Cek email sudah dipakai user lain
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, req.user.id],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }

    // Update semua field yang mungkin ada
    await db.query(
      "UPDATE users SET name = ?, email = ?, no_wa = ?, bank_name = ?, bank_account_name = ?, bank_account_number = ? WHERE id = ?",
      [
        name,
        email,
        phone || null,
        bank_name || null,
        bank_account_name || null,
        bank_account_number || bank_account || null,
        req.user.id,
      ],
    );

    const [updatedUsers] = await db.query(
      `SELECT u.id, u.name, u.email, u.affiliate_status, u.status, u.created_at,
              u.no_wa, u.bank_name, u.bank_account_name, u.bank_account_number,
              r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id],
    );

    const updatedUser = updatedUsers[0] || null;

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        ...updatedUser,
        phone: updatedUser ? updatedUser.no_wa : "",
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    // Ambil field sesuai frontend (settings.ejs)
    const currentPassword =
      req.body.current_password || req.body.currentPassword;
    const newPassword = req.body.new_password || req.body.newPassword;
    const confirmPassword =
      req.body.confirm_password || req.body.confirmPassword;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    // Get user from database to verify current password
    const [users] = await db.query("SELECT password FROM users WHERE id = ?", [
      req.user.id,
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      users[0].password,
    );

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      req.user.id,
    ]);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    // Settings functionality - can be extended later with settings table
    const {
      emailNotifications,
      referralNotifications,
      commissionNotifications,
      language,
    } = req.body;

    res.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const showForgotPasswordPage = async (req, res) => {
  return res.render("forgot-password", {
    error: req.query.error || null,
    success: req.query.success || null,
    email: req.query.email || "",
  });
};

const requestPasswordReset = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const isApi = req.originalUrl.startsWith("/api/");

    if (!email) {
      if (isApi) {
        return res.status(400).json({ success: false, message: "Email is required" });
      }
      return res.redirect("/forgot-password?error=" + encodeURIComponent("Email wajib diisi"));
    }

    const [users] = await db.query(
      "SELECT id, name, email, status FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (!users.length) {
      if (isApi) {
        return res.status(404).json({ success: false, message: "Email tidak terdaftar" });
      }
      return res.redirect(
        "/forgot-password?error=" +
          encodeURIComponent("Email tidak terdaftar") +
          "&email=" +
          encodeURIComponent(email),
      );
    }

    const user = users[0];
    if (user.status !== undefined && user.status !== "active") {
      if (isApi) {
        return res.status(403).json({ success: false, message: "Akun tidak aktif" });
      }
      return res.redirect(
        "/forgot-password?error=" +
          encodeURIComponent("Akun tidak aktif") +
          "&email=" +
          encodeURIComponent(email),
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await db.query("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NULL)`,
      [user.id, tokenHash],
    );

    const appBaseUrl =
      process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${appBaseUrl}/reset-password/${token}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      name: user.name,
    });

    if (isApi) {
      return res.json({
        success: true,
        message: "Email reset password telah dikirim",
      });
    }
    return res.redirect(
      "/forgot-password?success=" +
        encodeURIComponent("Link reset password telah dikirim ke email Anda"),
    );
  } catch (error) {
    console.error("requestPasswordReset error:", error);
    const isApi = req.originalUrl.startsWith("/api/");
    if (isApi) {
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
    return res.redirect("/forgot-password?error=" + encodeURIComponent("Terjadi kesalahan server"));
  }
};

const showResetPasswordPage = async (req, res) => {
  try {
    const token = String(req.params.token || "");
    if (req.query.success) {
      return res.render("reset-password", {
        token,
        validToken: true,
        error: null,
        success: req.query.success,
      });
    }

    if (!token) {
      return res.status(400).render("reset-password", {
        token: "",
        validToken: false,
        error: "Token tidak valid",
        success: null,
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [rows] = await db.query(
      `SELECT prt.id, prt.used_at, prt.expires_at, prt.created_at
       FROM password_reset_tokens prt
       WHERE LOWER(prt.token_hash) = LOWER(?)
       LIMIT 1`,
      [tokenHash],
    );

    let validToken = false;
    let validationError = null;
    if (!rows.length) {
      validationError = "Token tidak ditemukan";
    } else {
      const row = rows[0];
      const usedAt = row.used_at ? new Date(row.used_at) : null;
      const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
      if (usedAt && !Number.isNaN(usedAt.getTime())) {
        validationError = "Token sudah pernah digunakan";
      } else if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
        validationError = "Masa berlaku token tidak valid";
      } else if (expiresAt.getTime() <= Date.now()) {
        validationError = "Token sudah kadaluarsa";
      } else {
        validToken = true;
      }
      console.log("[reset-password] token check:", {
        tokenHashPrefix: tokenHash.slice(0, 10),
        used_at: row.used_at || null,
        expires_at: row.expires_at || null,
        validToken,
        validationError,
      });
    }

    return res.render("reset-password", {
      token,
      validToken,
      error: req.query.error || validationError,
      success: req.query.success || null,
    });
  } catch (error) {
    console.error("showResetPasswordPage error:", error);
    return res.status(500).render("reset-password", {
      token: "",
      validToken: false,
      error: "Terjadi kesalahan server",
      success: null,
    });
  }
};

const resetPasswordWithToken = async (req, res) => {
  try {
    const token = String(req.params.token || "");
    const newPassword = String(req.body.newPassword || req.body.password || "");
    const confirmPassword = String(
      req.body.confirmPassword || req.body.confirm_password || "",
    );
    const isApi = req.originalUrl.startsWith("/api/");

    if (!token) {
      if (isApi) return res.status(400).json({ success: false, message: "Token tidak valid" });
      return res.redirect("/reset-password/invalid?error=" + encodeURIComponent("Token tidak valid"));
    }

    if (!newPassword || !confirmPassword) {
      if (isApi) return res.status(400).json({ success: false, message: "Semua field password wajib diisi" });
      return res.redirect(
        `/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent("Semua field password wajib diisi")}`,
      );
    }

    if (newPassword.length < 8) {
      if (isApi) return res.status(400).json({ success: false, message: "Password minimal 8 karakter" });
      return res.redirect(
        `/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent("Password minimal 8 karakter")}`,
      );
    }

    if (newPassword !== confirmPassword) {
      if (isApi) return res.status(400).json({ success: false, message: "Konfirmasi password tidak sama" });
      return res.redirect(
        `/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent("Konfirmasi password tidak sama")}`,
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [rows] = await db.query(
      `SELECT prt.id, prt.user_id, prt.used_at, prt.expires_at
       FROM password_reset_tokens prt
       WHERE LOWER(prt.token_hash) = LOWER(?)
       LIMIT 1`,
      [tokenHash],
    );

    if (!rows.length) {
      if (isApi) return res.status(400).json({ success: false, message: "Token reset tidak ditemukan" });
      return res.redirect(
        `/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent("Token reset tidak ditemukan")}`,
      );
    }

    const resetRow = rows[0];
    const usedAt = resetRow.used_at ? new Date(resetRow.used_at) : null;
    const expiresAt = resetRow.expires_at ? new Date(resetRow.expires_at) : null;
    if (usedAt && !Number.isNaN(usedAt.getTime())) {
      if (isApi) return res.status(400).json({ success: false, message: "Token reset sudah digunakan" });
      return res.redirect(
        `/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent("Token reset sudah digunakan")}`,
      );
    }
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      if (isApi) return res.status(400).json({ success: false, message: "Token reset sudah kadaluarsa" });
      return res.redirect(
        `/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent("Token reset sudah kadaluarsa")}`,
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      resetRow.user_id,
    ]);
    await db.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [
      resetRow.id,
    ]);

    if (isApi) {
      return res.json({
        success: true,
        message: "Password berhasil diperbarui",
      });
    }
    return res.redirect(
      `/reset-password/${encodeURIComponent(token)}?success=${encodeURIComponent("Password berhasil diperbarui. Silakan login.")}`,
    );
  } catch (error) {
    console.error("resetPasswordWithToken error:", error);
    const isApi = req.originalUrl.startsWith("/api/");
    if (isApi) {
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
    return res.redirect(
      `/reset-password/${encodeURIComponent(req.params.token || "invalid")}?error=${encodeURIComponent("Terjadi kesalahan server")}`,
    );
  }
};

module.exports = {
  register,
  login,
  getProfile,
  logout,
  updateProfile,
  changePassword,
  updateSettings,
  showForgotPasswordPage,
  requestPasswordReset,
  showResetPasswordPage,
  resetPasswordWithToken,
};
