const db = require("../config/database");

const dashboard = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || null;

    if (!userId) {
      return res
        .status(401)
        .send("Unauthorized - user id required (for testing use ?user_id=)");
    }

    // Basic user info
    const [users] = await db.query(
      "SELECT id, name, email, status, affiliate_status FROM users WHERE id = ?",
      [userId],
    );
    const user = users[0] || { name: "Affiliate", status: "inactive" };

    // Referral link - try to get existing affiliate_links, otherwise build a sample code
    let referralLink = "";
    let sampleRefCode = null;
    try {
      const [links] = await db.query(
        "SELECT code FROM affiliate_links WHERE affiliate_id = ? LIMIT 1",
        [userId],
      );
      if (links.length > 0) {
        sampleRefCode = links[0].code;
      }
    } catch (e) {
      // ignore
    }

    // siteUrl from env or localhost
    const siteUrl =
      process.env.SITE_URL || req.protocol + "://" + req.get("host");
    referralLink = sampleRefCode
      ? `${siteUrl}/?ref=${sampleRefCode}`
      : `${siteUrl}/?ref=AFF${userId}`;

    // Summary metrics
    let activeProgramsCount = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM events WHERE affiliate_enabled = 1 AND status = 'active'",
      );
      activeProgramsCount = rows[0]?.cnt || 0;
    } catch (e) {}

    let totalCommission = "0.00";
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM commissions WHERE affiliate_id = ?",
        [userId],
      );
      totalCommission = rows[0]?.total || "0.00";
    } catch (e) {}

    let totalLeads = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM transactions WHERE affiliate_id = ?",
        [userId],
      );
      totalLeads = rows[0]?.cnt || 0;
    } catch (e) {}

    let leadsLast30 = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM transactions WHERE affiliate_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        [userId],
      );
      leadsLast30 = rows[0]?.cnt || 0;
    } catch (e) {}

    // Recent leads details
    let leads = [];
    try {
      const [rows] = await db.query(
        `SELECT t.id, c.name, c.email, c.phone, e.title as event_title, t.payment_status, t.created_at
         FROM transactions t
         LEFT JOIN customers c ON t.customer_id = c.id
         LEFT JOIN events e ON t.event_id = e.id
         WHERE t.affiliate_id = ?
         ORDER BY t.created_at DESC
         LIMIT 10`,
        [userId],
      );
      leads = rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        event_title: r.event_title || "-",
        payment_status: r.payment_status,
        created_at: r.created_at,
      }));
    } catch (e) {}

    // Affiliate profile (optional table)
    let affiliateProfile = null;
    try {
      const [rows] = await db.query(
        "SELECT * FROM affiliate_profiles WHERE affiliate_id = ? LIMIT 1",
        [userId],
      );
      if (rows.length > 0) affiliateProfile = rows[0];
    } catch (e) {
      // table may not exist
    }

    res.render("affiliate/dashboard_affiliate", {
      name: user.name,
      userStatus: user.status || user.affiliate_status || "inactive",
      referralLink,
      siteUrl,
      sampleRefCode,
      activeProgramsCount,
      totalCommission,
      totalLeads,
      leadsLast30,
      leads,
      affiliateProfile,
    });
  } catch (error) {
    console.error("Affiliate dashboard error:", error);
    res.status(500).send("Internal server error");
  }
};

module.exports = {
  dashboard,
};
