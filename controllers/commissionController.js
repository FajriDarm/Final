const db = require("../config/database");

// Get all commission rules (API)
exports.getAllCommissionsAPI = async (req, res) => {
  try {
    const [results] = await db.query(`
            SELECT 
                cr.id,
                cr.event_id,
                COALESCE(e.title, 'Global') as event_title,
                cr.commission_type,
                cr.commission_value,
                cr.min_stage,
                cr.is_active,
                u.name as created_by_name,
                cr.created_at
            FROM commission_rules cr
            LEFT JOIN events e ON cr.event_id = e.id
            LEFT JOIN users u ON cr.created_by = u.id
            ORDER BY cr.created_at DESC
        `);

    res.json({ success: true, commissions: results });
  } catch (error) {
    console.error("Error loading commissions:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Get all commission rules (PAGE)
exports.getAllCommissions = async (req, res) => {
  try {
    const [results] = await db.query(`
            SELECT 
                cr.id,
                cr.event_id,
                COALESCE(e.title, 'Global') as event_title,
                cr.commission_type,
                cr.commission_value,
                cr.min_stage,
                cr.is_active,
                u.name as created_by_name,
                cr.created_at
            FROM commission_rules cr
            LEFT JOIN events e ON cr.event_id = e.id
            LEFT JOIN users u ON cr.created_by = u.id
            ORDER BY cr.created_at DESC
        `);

    res.render("admin/commissions", {
      commissions: results,
      title: "Commission Management",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).render("error", { message: "Failed to load commissions" });
  }
};

// Get commission details
exports.getCommissionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [results] = await db.query(
      `
            SELECT * FROM commission_rules WHERE id = ?
        `,
      [id],
    );

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Commission not found" });
    }

    res.json({ success: true, data: results[0] });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Create new commission rule
exports.createCommission = async (req, res) => {
  try {
    const { event_id, commission_type, commission_value, min_stage } = req.body;
    const created_by = req.user?.id || 1; // Default to user 1 if not authenticated

    // Validation
    if (!commission_type || commission_value === undefined) {
      return res.status(400).json({
        success: false,
        message: "Commission type and value are required",
      });
    }

    if (!["flat", "percentage"].includes(commission_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid commission type",
      });
    }

    if (commission_value <= 0) {
      return res.status(400).json({
        success: false,
        message: "Commission value must be greater than 0",
      });
    }

    if (commission_type === "percentage" && commission_value > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage commission cannot exceed 100%",
      });
    }

    const eventIdValue = event_id ? event_id : null;
    const minStageValue = min_stage || 3;

    const [result] = await db.query(
      `
            INSERT INTO commission_rules 
            (event_id, commission_type, commission_value, min_stage, created_by, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        `,
      [
        eventIdValue,
        commission_type,
        commission_value,
        minStageValue,
        created_by,
      ],
    );

    // Log activity
    const description = `Created ${commission_type} commission rule: ${commission_value}${commission_type === "percentage" ? "%" : "IDR"}`;

    await db.query(
      `
            INSERT INTO activity_logs 
            (approved_by, action, target_type, target_id, new_status, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      [
        created_by,
        "CREATE",
        "commission_rule",
        result.insertId,
        "active",
        description,
      ],
    );

    res.json({
      success: true,
      message: "Commission rule created successfully",
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error("Error creating commission:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Update commission rule
exports.updateCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { commission_type, commission_value, min_stage, is_active } =
      req.body;
    const updated_by = req.user?.id || 1;

    // Validation
    if (commission_type && !["flat", "percentage"].includes(commission_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid commission type",
      });
    }

    if (commission_value && commission_value <= 0) {
      return res.status(400).json({
        success: false,
        message: "Commission value must be greater than 0",
      });
    }

    if (
      commission_type === "percentage" &&
      commission_value &&
      commission_value > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage commission cannot exceed 100%",
      });
    }

    let updateFields = [];
    let updateValues = [];

    if (commission_value !== undefined) {
      updateFields.push("commission_value = ?");
      updateValues.push(commission_value);
    }

    if (commission_type !== undefined) {
      updateFields.push("commission_type = ?");
      updateValues.push(commission_type);
    }

    if (min_stage !== undefined) {
      updateFields.push("min_stage = ?");
      updateValues.push(min_stage);
    }

    if (is_active !== undefined) {
      updateFields.push("is_active = ?");
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    updateValues.push(id);

    const query = `UPDATE commission_rules SET ${updateFields.join(", ")} WHERE id = ?`;

    await db.query(query, updateValues);

    // Log activity
    const description = `Updated commission rule ${id}`;

    await db.query(
      `
            INSERT INTO activity_logs 
            (approved_by, action, target_type, target_id, new_status, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      [updated_by, "UPDATE", "commission_rule", id, "updated", description],
    );

    res.json({
      success: true,
      message: "Commission rule updated successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Delete commission rule
exports.deleteCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted_by = req.user?.id || 1;

    // Check if commission rule exists
    const [checkResult] = await db.query(
      `
            SELECT id FROM commission_rules WHERE id = ?
        `,
      [id],
    );

    if (checkResult.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Commission rule not found" });
    }

    await db.query(`DELETE FROM commission_rules WHERE id = ?`, [id]);

    // Log activity
    await db.query(
      `
            INSERT INTO activity_logs 
            (approved_by, action, target_type, target_id, new_status, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      [
        deleted_by,
        "DELETE",
        "commission_rule",
        id,
        "deleted",
        `Deleted commission rule ${id}`,
      ],
    );

    res.json({
      success: true,
      message: "Commission rule deleted successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Get all events for dropdown
exports.getEvents = async (req, res) => {
  try {
    const [results] = await db.query(`
            SELECT id, title FROM events 
            WHERE status = 'active' 
            ORDER BY title ASC
        `);

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Get commission statistics
exports.getCommissionStats = async (req, res) => {
  try {
    const [results] = await db.query(`
            SELECT 
                COUNT(*) as total_rules,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_rules,
                SUM(CASE WHEN commission_type = 'flat' THEN 1 ELSE 0 END) as flat_rules,
                SUM(CASE WHEN commission_type = 'percentage' THEN 1 ELSE 0 END) as percentage_rules
            FROM commission_rules
        `);

    res.json({ success: true, data: results[0] });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
