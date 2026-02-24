const db = require("../config/database");

async function renderLandingPage(req, res) {
  try {
    const { slug } = req.params;
    const [rows] = await db.query(
      `SELECT data_json, template, slug, created_at
       FROM landing_pages
       WHERE slug = ?
       LIMIT 1`,
      [slug],
    );

    if (!rows.length) {
      return res.status(404).render("error", { message: "Landing page not found" });
    }

    let data = rows[0].data_json || {};
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        data = {};
      }
    }
    return res.render("LPCUST", {
      landingData: data,
      landingSlug: slug,
    });
  } catch (err) {
    console.error("renderLandingPage error", err);
    return res.status(500).render("error", { message: "Internal server error" });
  }
}

module.exports = {
  renderLandingPage,
};
