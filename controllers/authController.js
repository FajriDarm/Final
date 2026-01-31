const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, agree_terms } = req.body;

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
         u.bank_name, u.bank_account_name, u.bank_account_number,
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
      user: users[0],
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
    const { name, email, bank_name, bank_account_name, bank_account_number } =
      req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // Check if email exists for another user
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

    await db.query(
      "UPDATE users SET name = ?, email = ?, bank_name = ?, bank_account_name = ?, bank_account_number = ? WHERE id = ?",
      [
        name,
        email,
        bank_name || null,
        bank_account_name || null,
        bank_account_number || null,
        req.user.id,
      ],
    );

    const [updatedUsers] = await db.query(
      `SELECT u.id, u.name, u.email, u.affiliate_status, u.status, u.created_at,
              u.bank_name, u.bank_account_name, u.bank_account_number,
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
      user: updatedUser,
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
    const { currentPassword, newPassword, confirmPassword } = req.body;

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

module.exports = {
  register,
  login,
  getProfile,
  logout,
  updateProfile,
  changePassword,
  updateSettings,
};
