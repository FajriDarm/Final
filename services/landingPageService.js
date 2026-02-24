const db = require("../config/database");

function generateSlug(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getLatestLandingPageSlug(eventId) {
  const [rows] = await db.query(
    `SELECT slug
     FROM landing_pages
     WHERE event_id = ?
     ORDER BY version DESC, created_at DESC
     LIMIT 1`,
    [eventId],
  );
  return rows.length ? rows[0].slug : null;
}

async function buildLandingData(eventId) {
  const [eventRows] = await db.query(
    `SELECT e.*, ehs.headline, ehs.subheadline, ehs.hero_media_type, ehs.hero_media_url, ehs.hero_as_background
     FROM events e
     LEFT JOIN event_hero_sections ehs ON ehs.event_id = e.id
     WHERE e.id = ? LIMIT 1`,
    [eventId],
  );
  if (!eventRows.length) return null;
  const event = eventRows[0];

  const [benefits] = await db.query(
    `SELECT benefit_text, sort_order FROM event_benefits WHERE event_id = ? ORDER BY sort_order ASC`,
    [eventId],
  );

  const [faqs] = await db.query(
    `SELECT question, answer, sort_order FROM event_faqs WHERE event_id = ? ORDER BY sort_order ASC`,
    [eventId],
  );

  let testimonials = [];
  try {
    const [rows] = await db.query(
      `SELECT media_type, media_url, sort_order
       FROM event_testimonials
       WHERE event_id = ?
       ORDER BY sort_order ASC`,
      [eventId],
    );
    testimonials = rows;
  } catch (_) {}

  let variants = [];
  try {
    const [rows] = await db.query(
      `SELECT event_type, title, slug, description, price_original, price_promo, logo_media_type, logo_media_url, sort_order
       FROM event_variants
       WHERE event_id = ?
       ORDER BY sort_order ASC`,
      [eventId],
    );
    variants = rows;
  } catch (_) {}

  const [sections] = await db.query(
    `SELECT id, title, subtitle FROM event_problem_sections WHERE event_id = ? LIMIT 1`,
    [eventId],
  );

  let pains = [];
  let problemTitle = null;
  let problemSubtitle = null;
  if (sections.length) {
    problemTitle = sections[0].title || null;
    problemSubtitle = sections[0].subtitle || null;
    const [p] = await db.query(
      `SELECT pain_title, pain_description, sort_order
       FROM event_pains
       WHERE problem_section_id = ?
       ORDER BY sort_order ASC`,
      [sections[0].id],
    );
    pains = p;
  }

  return {
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      event_type: event.event_type,
      price_original: event.price_original,
      price_promo: event.price_promo,
      start_date: event.start_date,
      end_date: event.end_date,
      admin_whatsapp: event.admin_whatsapp,
    },
    hero: {
      headline: event.headline || "",
      subheadline: event.subheadline || "",
      hero_media_type: event.hero_media_type || "",
      hero_media_url: event.hero_media_url || "",
      hero_as_background: !!event.hero_as_background,
    },
    benefits: benefits.map((b) => b.benefit_text),
    faqs: faqs.map((f) => ({ question: f.question, answer: f.answer })),
    testimonials: testimonials.map((t) => ({
      media_type: t.media_type,
      media_url: t.media_url,
      sort_order: t.sort_order,
    })),
    variants: variants.map((v) => ({
      event_type: v.event_type,
      title: v.title,
      slug: v.slug,
      description: v.description,
      price_original: v.price_original,
      price_promo: v.price_promo,
      logo_media_type: v.logo_media_type,
      logo_media_url: v.logo_media_url,
      sort_order: v.sort_order,
    })),
    problem: {
      title: problemTitle || "",
      subtitle: problemSubtitle || "",
      pains: pains.map((p) => ({
        title: p.pain_title || "",
        description: p.pain_description || "",
      })),
    },
  };
}

async function createLandingFromEvent(eventId, createdBy = null) {
  const data = await buildLandingData(eventId);
  if (!data) return null;

  const [versionRows] = await db.query(
    `SELECT COALESCE(MAX(version), 0) AS max_version
     FROM landing_pages WHERE event_id = ?`,
    [eventId],
  );
  const nextVersion = (versionRows[0]?.max_version || 0) + 1;

  const baseSlug = data.event.slug || generateSlug(data.event.title);
  const landingSlug = `${baseSlug}-lp-v${nextVersion}`;

  await db.query(
    `INSERT INTO landing_pages (event_id, slug, template, version, data_json, created_by)
     VALUES (?, ?, 'LPCUST', ?, ?, ?)`,
    [eventId, landingSlug, nextVersion, JSON.stringify(data), createdBy],
  );

  return landingSlug;
}

module.exports = {
  createLandingFromEvent,
  getLatestLandingPageSlug,
};
