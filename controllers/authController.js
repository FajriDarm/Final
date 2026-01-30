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
    try {
      const [roles] = await db.query(
        "SELECT id FROM roles WHERE name = ? LIMIT 1",
        ["affiliate"],
      );
      if (roles.length > 0) {
        roleId = roles[0].id;
      }
    } catch (err) {
      // If roles table doesn't exist, we'll insert without role_id
    }

    // Insert user - try with role_id first, fall back to simple insert
    let result;
    try {
      [result] = await db.query(
        'INSERT INTO users (name, email, password, role_id, affiliate_status, status) VALUES (?, ?, ?, ?, "inactive", "active")',
        [name, email, hashedPassword, roleId],
      );
    } catch (error) {
      // If that fails, try without role_id
      try {
        [result] = await db.query(
          "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
          [name, email, hashedPassword],
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
        affiliate_status: newUser.affiliate_status || "inactive",
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
      `SELECT u.id, u.name, u.email, u.affiliate_status, u.status, u.created_at, r.name as role
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

module.exports = {
  register,
  login,
  getProfile,
  logout,
};
