const db = require("../config/database");

async function trackAffiliateClick(req, res) {
  try {
    const { ref, event_slug } = req.body;

    if (!ref)
      return res
        .status(400)
        .json({ success: false, message: "ref is required" });

    // Find affiliate link by code
    const [links] = await db.query(
      "SELECT id, clicks FROM affiliate_links WHERE code = ? LIMIT 1",
      [ref],
    );
    if (links.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "affiliate link not found" });

    const link = links[0];

    // Increment clicks and update last_clicked_at
    await db.query(
      "UPDATE affiliate_links SET clicks = clicks + 1, last_clicked_at = NOW() WHERE id = ?",
      [link.id],
    );

    return res.json({ success: true, message: "click recorded" });
  } catch (err) {
    console.error("trackAffiliateClick error", err);
    return res.status(500).json({ success: false, message: "internal error" });
  }
}

module.exports = {
  trackAffiliateClick,
};
