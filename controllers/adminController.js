const db = require("../config/database");
const jwt = require("jsonwebtoken");
const landingPageService = require("../services/landingPageService");

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

function isValidHeroMediaUrl(url) {
  if (!url) return false;
  return /^https?:\/\//i.test(url) || url.startsWith("/");
}

function inferHeroMediaTypeFromUrl(url) {
  if (!url) return null;
  const lower = String(url).toLowerCase();
  if (
    /\.(mp4|webm|mov|m4v|avi)(\?|$)/.test(lower) ||
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("vimeo.com")
  ) {
    return "video";
  }
  return "image";
}

function sanitizeHeroMediaInput(heroMediaTypeRaw, heroMediaUrlRaw) {
  const heroMediaUrl = typeof heroMediaUrlRaw === "string" ? heroMediaUrlRaw.trim() : "";
  const heroMediaType = typeof heroMediaTypeRaw === "string" ? heroMediaTypeRaw.trim().toLowerCase() : "";

  if (!heroMediaUrl) {
    return { heroMediaType: null, heroMediaUrl: null };
  }

  if (!isValidHeroMediaUrl(heroMediaUrl)) {
    throw new Error("Invalid hero_media_url format");
  }

  let normalizedType = heroMediaType;
  if (!["image", "video"].includes(normalizedType)) {
    normalizedType = inferHeroMediaTypeFromUrl(heroMediaUrl);
  }

  return { heroMediaType: normalizedType, heroMediaUrl };
}

function normalizeMediaPayload(mediaTypeRaw, mediaUrlRaw) {
  return sanitizeHeroMediaInput(mediaTypeRaw, mediaUrlRaw);
}

const getActiveEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.id, e.title as name, e.description, e.price_original, e.price_promo as price_discount,
              e.start_date, e.end_date, e.status, e.slug, e.event_type,
              ehs.headline, ehs.subheadline, ehs.hero_media_type, ehs.hero_media_url, ehs.hero_as_background
       FROM events e
       LEFT JOIN event_hero_sections ehs ON ehs.event_id = e.id
       WHERE e.status = 'active'
       AND (e.end_date >= CURDATE() OR e.end_date IS NULL)
       ORDER BY e.created_at DESC`,
    );

    const eventIds = events.map(e => e.id);
    if (eventIds.length) {
      const [benefits] = await db.query(
        `SELECT * FROM event_benefits WHERE event_id IN (?) ORDER BY sort_order ASC`,
        [eventIds],
      );
      const benefitMap = {};
      benefits.forEach(b => {
        if (!benefitMap[b.event_id]) benefitMap[b.event_id] = [];
        benefitMap[b.event_id].push(b.benefit_text || b);
      });

      // faqs for active events
      const [faqs] = await db.query(
        `SELECT * FROM event_faqs WHERE event_id IN (?) ORDER BY sort_order ASC`,
        [eventIds],
      );
      const faqMap = {};
      faqs.forEach(f => {
        if (!faqMap[f.event_id]) faqMap[f.event_id] = [];
        faqMap[f.event_id].push({ question: f.question, answer: f.answer });
      });

      // package functionality has been removed; keep empty map for compatibility
      const pkgMap = {}; // packages are no longer stored separately

      const [sections] = await db.query(
        `SELECT * FROM event_problem_sections WHERE event_id IN (?)`,
        [eventIds],
      );
      const sectionIds = sections.map(s => s.id);
      const [pains] = sectionIds.length
        ? await db.query(
            `SELECT * FROM event_pains WHERE problem_section_id IN (?) ORDER BY sort_order ASC`,
            [sectionIds],
          )
        : [[],];
      const painMap = {};
      pains.forEach(p => {
        if (!painMap[p.problem_section_id]) painMap[p.problem_section_id] = [];
        painMap[p.problem_section_id].push(p);
      });

      const sectionMap = {};
      sections.forEach(s => {
        sectionMap[s.event_id] = s;
        s.pains = painMap[s.id] || [];
      });

      events.forEach(e => {
        e.benefits = benefitMap[e.id] || [];
        e.faqs = faqMap[e.id] || [];
        const sec = sectionMap[e.id];
        if (sec) {
          e.problem_title = sec.title;
          e.problem_subtitle = sec.subtitle;
          e.pains = sec.pains;
        }
      });
    }

    events.forEach(e => {
      delete e.payment_methods;
      delete e.bank_name;
      delete e.bank_account_name;
      delete e.bank_account_number;
      delete e.account_holder_name;
    });

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Get active events error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    // Total Users
    const [totalUsers] = await db.query("SELECT COUNT(*) as count FROM users");

    // Total Affiliates
    const [totalAffiliates] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE role_id = 4",
    );

    // Pending Affiliates
    const [pendingAffiliates] = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE affiliate_status = "pending"',
    );

    // Active Events
    const [activeEvents] = await db.query(
      'SELECT COUNT(*) as count FROM events WHERE status = "active"',
    );

    // Total Transactions
    const [totalTransactions] = await db.query(
      "SELECT COUNT(*) as count FROM transactions",
    );

    // Completed Transactions
    const [completedTransactions] = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE status = "completed"',
    );

    // Total Revenue (from completed transactions)
    const [totalRevenue] = await db.query(
      'SELECT COALESCE(SUM(total_amount), 0) as revenue FROM transactions WHERE status = "completed"',
    );

    // Revenue trend --- last 14 days (we'll split into this week / previous week)
    const [revenueRows] = await db.query(
      `SELECT DATE(created_at) as day, COALESCE(SUM(total_amount), 0) as revenue
       FROM transactions
       WHERE status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
       GROUP BY DATE(created_at)`,
    );

    // Build maps for quick lookup
    const revenueMap = {};
    revenueRows.forEach(r => {
      const key = (r.day instanceof Date) ? r.day.toISOString().slice(0, 10) : r.day;
      revenueMap[key] = Number(r.revenue);
    });

    const revenueThisWeek = [];
    const revenueLastWeek = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueThisWeek.push(revenueMap[key] || 0);
    }
    for (let i = 13; i >= 7; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueLastWeek.push(revenueMap[key] || 0);
    }

    // Traffic sources (heuristic using available tables over last 30 days)
    const [directCount] = await db.query(
      `SELECT COUNT(*) as cnt FROM transactions WHERE (affiliate_id IS NULL OR affiliate_id = 0) AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    );

    const [referralCount] = await db.query(
      `SELECT COUNT(*) as cnt FROM transactions WHERE (affiliate_id IS NOT NULL AND affiliate_id != 0) AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    );

    const [clicksSum] = await db.query(
      `SELECT COALESCE(SUM(clicks),0) as clicks FROM affiliate_links WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    );

    const [emailSignups] = await db.query(
      `SELECT COUNT(*) as cnt FROM customers WHERE email IS NOT NULL AND email <> '' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    );

    const trafficSources = {
      direct: Number(directCount[0].cnt) || 0,
      social: Number(clicksSum[0].clicks) || 0,
      email: Number(emailSignups[0].cnt) || 0,
      referral: Number(referralCount[0].cnt) || 0,
    };

    // Pending Payouts
    const [pendingPayouts] = await db.query(
      'SELECT COUNT(*) as count FROM payouts WHERE status = "pending"',
    );

    // Top affiliates by total approved/paid commissions (last 90 days)
    const [topAffiliatesRows] = await db.query(
      `SELECT u.id, u.name, COALESCE(SUM(c.amount),0) as total_commission
       FROM commissions c
       LEFT JOIN users u ON c.affiliate_id = u.id
       WHERE c.commission_status IN ('approved','paid')
         AND c.created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       GROUP BY u.id, u.name
       ORDER BY total_commission DESC
       LIMIT 3`,
    );

    const topAffiliates = topAffiliatesRows.map(r => ({
      id: r.id,
      name: r.name || '—',
      total: Number(r.total_commission || 0),
    }));

    // Popular events (by transactions in last 30 days)
    const [popularEventsRows] = await db.query(
      `SELECT e.id, e.title, COUNT(t.id) as tx_count
       FROM events e
       LEFT JOIN transactions t ON t.event_id = e.id AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY e.id, e.title
       ORDER BY tx_count DESC
       LIMIT 3`,
    );

    const popularEvents = popularEventsRows.map(r => ({
      id: r.id,
      title: r.title,
      count: Number(r.tx_count || 0),
    }));

    // System health (simple heuristics)
    // activeSessions := distinct users appearing in activity_logs in last 30 minutes
    const [activeSessionsRows] = await db.query(
      `SELECT COUNT(DISTINCT user_id_val) as cnt FROM (
         SELECT approved_by as user_id_val, created_at FROM activity_logs WHERE approved_by IS NOT NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
         UNION ALL
         SELECT target_user_id as user_id_val, created_at FROM activity_logs WHERE target_user_id IS NOT NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
       ) t`,
    );

    const systemHealth = {
      serverResponseMs: 98, // static estimate (ms)
      uptimePct: '99.9%',
      activeSessions: Number(activeSessionsRows[0]?.cnt || 0),
    };

    // Recent Transactions
    const [recentTransactions] = await db.query(
      `SELECT t.id, t.total_amount, t.status, t.payment_status, t.created_at,
              COALESCE(c.name, 'Unknown') as customer_name, u.name as affiliate_name
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN users u ON t.affiliate_id = u.id
       ORDER BY t.created_at DESC
       LIMIT 10`,
    );

    // Recent Activity Logs
    const [recentActivities] = await db.query(
      `SELECT al.*, 
              approver.name as approver_name,
              approver.email as approver_email,
              target.name as target_user_name,
              target.email as target_user_email
       FROM activity_logs al
       LEFT JOIN users approver ON al.approved_by = approver.id
       LEFT JOIN users target ON al.target_user_id = target.id
       ORDER BY al.created_at DESC
       LIMIT 10`,
    );

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers[0].count,
        totalAffiliates: totalAffiliates[0].count,
        pendingAffiliates: pendingAffiliates[0].count,
        activeEvents: activeEvents[0].count,
        totalTransactions: totalTransactions[0].count,
        completedTransactions: completedTransactions[0].count,
        totalRevenue: totalRevenue[0].revenue,
        pendingPayouts: pendingPayouts[0].count,
      },
      // added chart data
      revenueThisWeek,
      revenueLastWeek,
      trafficSources,
      recentTransactions,
      recentActivities,
      // new dashboard blocks
      topAffiliates,
      popularEvents,
      systemHealth,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.*, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`,
    );

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.name as created_by_name, ehs.headline, ehs.subheadline, ehs.hero_media_type, ehs.hero_media_url, ehs.hero_as_background
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       LEFT JOIN event_hero_sections ehs ON ehs.event_id = e.id
       ORDER BY e.created_at DESC`,
    );

    const eventIds = events.map(e => e.id);
    if (eventIds.length) {
      // benefits
      const [benefits] = await db.query(
        `SELECT * FROM event_benefits WHERE event_id IN (?) ORDER BY sort_order ASC`,
        [eventIds],
      );
      const benefitMap = {};
      benefits.forEach(b => {
        if (!benefitMap[b.event_id]) benefitMap[b.event_id] = [];
        benefitMap[b.event_id].push(b);
      });

      // faqs
      const [faqs] = await db.query(
        `SELECT * FROM event_faqs WHERE event_id IN (?) ORDER BY sort_order ASC`,
        [eventIds],
      );
      const faqMap = {};
      faqs.forEach(f => {
        if (!faqMap[f.event_id]) faqMap[f.event_id] = [];
        faqMap[f.event_id].push(f);
      });

      // testimonials
      let testimonials = [];
      try {
        const [rows] = await db.query(
          `SELECT event_id, media_type, media_url, sort_order
           FROM event_testimonials
           WHERE event_id IN (?)
           ORDER BY sort_order ASC`,
          [eventIds],
        );
        testimonials = rows;
      } catch (err) {
        console.warn("event_testimonials table not ready:", err.message);
      }
      const testimonialMap = {};
      testimonials.forEach((t) => {
        if (!testimonialMap[t.event_id]) testimonialMap[t.event_id] = [];
        testimonialMap[t.event_id].push({
          media_type: t.media_type,
          media_url: t.media_url,
          sort_order: t.sort_order,
        });
      });

      // event variants
      let variants = [];
      try {
        const [rows] = await db.query(
          `SELECT event_id, event_type, title, slug, description, price_original, price_promo,
                  logo_media_type, logo_media_url, sort_order
           FROM event_variants
           WHERE event_id IN (?)
           ORDER BY sort_order ASC`,
          [eventIds],
        );
        variants = rows;
      } catch (err) {
        console.warn("event_variants table not ready:", err.message);
      }
      const variantMap = {};
      variants.forEach((v) => {
        if (!variantMap[v.event_id]) variantMap[v.event_id] = [];
        variantMap[v.event_id].push(v);
      });

      // problem sections + pains
      const [sections] = await db.query(
        `SELECT * FROM event_problem_sections WHERE event_id IN (?)`,
        [eventIds],
      );
      const sectionIds = sections.map(s => s.id);
      const [pains] = sectionIds.length
        ? await db.query(
            `SELECT * FROM event_pains WHERE problem_section_id IN (?) ORDER BY sort_order ASC`,
            [sectionIds],
          )
        : [[],];
      const painMap = {};
      pains.forEach(p => {
        if (!painMap[p.problem_section_id]) painMap[p.problem_section_id] = [];
        painMap[p.problem_section_id].push(p);
      });

      const sectionMap = {};
      sections.forEach(s => {
        sectionMap[s.event_id] = s;
        s.pains = painMap[s.id] || [];
      });

      // attach to events
      events.forEach(e => {
        e.benefits = benefitMap[e.id] || [];
        e.faqs = faqMap[e.id] || [];
        e.testimonials = testimonialMap[e.id] || [];
        e.variants = variantMap[e.id] || [];
        const sec = sectionMap[e.id];
        if (sec) {
          e.problem_title = sec.title;
          e.problem_subtitle = sec.subtitle;
          e.pains = sec.pains;
        }
      });
    }

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const createEvent = async (req, res) => {
  try {
    // Basic validation
    const allowedTypes = ['gratis', 'berbayar'];
    const allowedStatus = ['draft', 'active', 'inactive'];

    if (!req.body.event_type || !allowedTypes.includes(req.body.event_type)) {
      return res.status(400).json({ success: false, message: 'Invalid event_type' });
    }

    if (req.body.status && !allowedStatus.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (!req.body.title || String(req.body.title).trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (req.body.event_type === 'berbayar') {
      if (!req.body.start_date || !req.body.end_date) {
        return res.status(400).json({ success: false, message: 'start_date and end_date are required for paid events' });
      }
      const po = parseFloat(req.body.price_original || 0);
      const pp = parseFloat(req.body.price_promo || 0);
      if (isNaN(po) || isNaN(pp)) {
        return res.status(400).json({ success: false, message: 'Invalid price values' });
      }
    }

    // sanitize whatsapp (digits only)
    if (req.body.admin_whatsapp && !/^[0-9+\-\s()]{3,20}$/.test(req.body.admin_whatsapp)) {
      return res.status(400).json({ success: false, message: 'Invalid admin_whatsapp format' });
    }

    const {
      title,
      description,
      price_original,
      price_promo,
      start_date,
      end_date,
      headline,
      subheadline,
      hero_media_type,
      hero_media_url,
      hero_as_background,
      benefits,
      problemTitle,
      problemSubtitle,
      pains,
      faqs,
      testimonials,
      variants,
    } = req.body;

    let normalizedHero = { heroMediaType: null, heroMediaUrl: null };
    try {
      normalizedHero = sanitizeHeroMediaInput(hero_media_type, hero_media_url);
    } catch (heroErr) {
      return res.status(400).json({ success: false, message: heroErr.message });
    }

    const userId = req.user?.id || 1;

    // Event type logic
    const eventType = req.body.event_type || "berbayar";
    const finalPriceOriginal =
      eventType === "gratis" ? 0 : req.body.price_original || 0;
    const finalPricePromo =
      eventType === "gratis" ? 0 : req.body.price_promo || 0;
    const ignoredPaymentMethods = null;
    const ignoredBankName = null;
    const ignoredBankAccountName = null;
    const ignoredBankAccountNumber = null;
    const ignoredAccountHolderName = null;

    const insertValues = [
      req.body.title,
      req.body.slug || generateSlug(req.body.title),
      req.body.description,
      eventType,
      finalPriceOriginal,
      finalPricePromo,
      ignoredPaymentMethods,
      ignoredBankName,
      ignoredBankAccountName,
      ignoredBankAccountNumber,
      ignoredAccountHolderName,
      req.body.admin_whatsapp || "",
      req.body.start_date,
      req.body.end_date,
      req.body.status || "draft",
      userId,
    ];

    console.debug("Creating event with values:", insertValues);

    const [result] = await db.query(
      `INSERT INTO events
       (title, slug, description, event_type, price_original, price_promo, payment_methods,
        bank_name, bank_account_name, bank_account_number, account_holder_name,
        admin_whatsapp, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertValues,
    );

    const eventId = result.insertId;

    // if request contains uploaded hero file reference (URL), prefer that over URL field
    // handled below when inserting hero section

    // insert related entities
    if (Array.isArray(benefits)) {
      for (let i = 0; i < benefits.length; i++) {
        await db.query(
          `INSERT INTO event_benefits (event_id, benefit_text, sort_order) VALUES (?, ?, ?)`,
          [eventId, benefits[i], i],
        );
      }
    }

    // faqs
    if (Array.isArray(faqs)) {
      for (let i = 0; i < faqs.length; i++) {
        const f = faqs[i];
        await db.query(
          `INSERT INTO event_faqs (event_id, question, answer, sort_order) VALUES (?, ?, ?, ?)`,
          [eventId, f.question || '', f.answer || '', i],
        );
      }
    }

    // testimonials
    if (Array.isArray(testimonials)) {
      try {
        for (let i = 0; i < testimonials.length; i++) {
          const t = testimonials[i] || {};
          let normalized = { heroMediaType: null, heroMediaUrl: null };
          try {
            normalized = normalizeMediaPayload(t.media_type, t.media_url);
          } catch (e) {
            continue;
          }
          if (!normalized.heroMediaUrl) continue;
          await db.query(
            `INSERT INTO event_testimonials (event_id, media_type, media_url, sort_order)
             VALUES (?, ?, ?, ?)`,
            [eventId, normalized.heroMediaType || "image", normalized.heroMediaUrl, i],
          );
        }
      } catch (err) {
        console.warn("Failed to insert testimonials:", err.message);
      }
    }

    // variants
    if (Array.isArray(variants)) {
      try {
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i] || {};
          if (!v.title || !String(v.title).trim()) continue;
          const eventTypeVar = v.event_type === "gratis" ? "gratis" : "berbayar";
          let logoNormalized = { heroMediaType: null, heroMediaUrl: null };
          try {
            logoNormalized = normalizeMediaPayload(v.logo_media_type, v.logo_media_url);
          } catch (e) {
            logoNormalized = { heroMediaType: null, heroMediaUrl: null };
          }
          await db.query(
            `INSERT INTO event_variants
             (event_id, event_type, title, slug, description, price_original, price_promo, logo_media_type, logo_media_url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              eventId,
              eventTypeVar,
              String(v.title).trim(),
              (v.slug && String(v.slug).trim()) || generateSlug(v.title),
              v.description || null,
              eventTypeVar === "gratis" ? 0 : (parseFloat(v.price_original || 0) || 0),
              eventTypeVar === "gratis" ? 0 : (parseFloat(v.price_promo || 0) || 0),
              logoNormalized.heroMediaType || null,
              logoNormalized.heroMediaUrl || null,
              i,
            ],
          );
        }
      } catch (err) {
        console.warn("Failed to insert variants:", err.message);
      }
    }

    let problemSectionId = null;
    if (problemTitle || problemSubtitle || (Array.isArray(pains) && pains.length)) {
      const [ps] = await db.query(
        `INSERT INTO event_problem_sections (event_id, title, subtitle) VALUES (?, ?, ?)`,
        [eventId, problemTitle || null, problemSubtitle || null],
      );
      problemSectionId = ps.insertId;
      if (Array.isArray(pains)) {
        for (let i = 0; i < pains.length; i++) {
          const p = pains[i];
          await db.query(
            `INSERT INTO event_pains (problem_section_id, pain_title, pain_description, sort_order) VALUES (?, ?, ?, ?)`,
            [problemSectionId, p.pain_title || null, p.pain_description || null, i],
          );
        }
      }
    }

    // insert hero section into event_hero_sections (separate table)
    try {
      if (headline || subheadline || normalizedHero.heroMediaType || normalizedHero.heroMediaUrl) {
        await db.query(
          `INSERT INTO event_hero_sections (event_id, headline, subheadline, hero_media_type, hero_media_url, hero_as_background) VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, headline || null, subheadline || null, normalizedHero.heroMediaType, normalizedHero.heroMediaUrl, hero_as_background ? 1 : 0],
        );
      }
    } catch (err) {
      console.warn('Failed to insert into event_hero_sections:', err.message);
    }

    // packages removed from model - pricing kept on events
    try {
      await landingPageService.createLandingFromEvent(eventId, userId);
    } catch (err) {
      console.warn("Failed to create landing page for event", eventId, err.message || err);
    }

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { id: eventId },
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      title,
      description,
      price_original,
      price_promo,
      start_date,
      end_date,
      status,
      headline,
      subheadline,
      hero_media_type,
      hero_media_url,
      hero_as_background,
      benefits,
      problemTitle,
      problemSubtitle,
      pains,
      faqs,
      testimonials,
      variants,
    } = req.body;

    let normalizedHero = { heroMediaType: null, heroMediaUrl: null };
    try {
      normalizedHero = sanitizeHeroMediaInput(hero_media_type, hero_media_url);
    } catch (heroErr) {
      return res.status(400).json({ success: false, message: heroErr.message });
    }

    // Basic validation for update
    const allowedTypes = ['gratis', 'berbayar'];
    const allowedStatus = ['draft', 'active', 'inactive'];
    if (req.body.event_type && !allowedTypes.includes(req.body.event_type)) {
      return res.status(400).json({ success: false, message: 'Invalid event_type' });
    }
    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (req.body.admin_whatsapp && !/^[0-9+\-\s()]{3,20}$/.test(req.body.admin_whatsapp)) {
      return res.status(400).json({ success: false, message: 'Invalid admin_whatsapp format' });
    }

    await db.query(
      `UPDATE events SET
       title = ?, description = ?, price_original = ?, price_promo = ?,
       payment_methods = ?, bank_name = ?, bank_account_name = ?,
       bank_account_number = ?, account_holder_name = ?, start_date = ?, end_date = ?, status = ?
       WHERE id = ?`,
      [
        title,
        description,
        price_original,
        price_promo,
        null,
        null,
        null,
        null,
        null,
        start_date,
        end_date,
        status,
        eventId,
      ],
    );

    // remove previous related entries
    // event_packages table removed; nothing to delete
    await db.query("DELETE FROM event_benefits WHERE event_id = ?", [eventId]);
    await db.query("DELETE FROM event_faqs WHERE event_id = ?", [eventId]);
    await db.query("DELETE FROM event_problem_sections WHERE event_id = ?", [eventId]);
    try {
      await db.query("DELETE FROM event_testimonials WHERE event_id = ?", [eventId]);
      await db.query("DELETE FROM event_variants WHERE event_id = ?", [eventId]);
    } catch (err) {
      console.warn("Failed to clear testimonials/variants:", err.message);
    }

    // reinsert relationships same as create
    if (Array.isArray(benefits)) {
      for (let i = 0; i < benefits.length; i++) {
        await db.query(
          `INSERT INTO event_benefits (event_id, benefit_text, sort_order) VALUES (?, ?, ?)`,
          [eventId, benefits[i], i],
        );
      }
    }

    let problemSectionId = null;
    if (problemTitle || problemSubtitle || (Array.isArray(pains) && pains.length)) {
      const [ps] = await db.query(
        `INSERT INTO event_problem_sections (event_id, title, subtitle) VALUES (?, ?, ?)`,
        [eventId, problemTitle || null, problemSubtitle || null],
      );
      problemSectionId = ps.insertId;
      if (Array.isArray(pains)) {
        for (let i = 0; i < pains.length; i++) {
          const p = pains[i];
          await db.query(
            `INSERT INTO event_pains (problem_section_id, pain_title, pain_description, sort_order) VALUES (?, ?, ?, ?)`,
            [problemSectionId, p.pain_title || null, p.pain_description || null, i],
          );
        }
      }
    }

    // packages removed from model - pricing kept on events

    // faqs reinsertion
    if (Array.isArray(faqs)) {
      for (let i = 0; i < faqs.length; i++) {
        const f = faqs[i];
        await db.query(
          `INSERT INTO event_faqs (event_id, question, answer, sort_order) VALUES (?, ?, ?, ?)`,
          [eventId, f.question || '', f.answer || '', i],
        );
      }
    }

    // testimonials reinsertion
    if (Array.isArray(testimonials)) {
      try {
        for (let i = 0; i < testimonials.length; i++) {
          const t = testimonials[i] || {};
          let normalized = { heroMediaType: null, heroMediaUrl: null };
          try {
            normalized = normalizeMediaPayload(t.media_type, t.media_url);
          } catch (e) {
            continue;
          }
          if (!normalized.heroMediaUrl) continue;
          await db.query(
            `INSERT INTO event_testimonials (event_id, media_type, media_url, sort_order)
             VALUES (?, ?, ?, ?)`,
            [eventId, normalized.heroMediaType || "image", normalized.heroMediaUrl, i],
          );
        }
      } catch (err) {
        console.warn("Failed to update testimonials:", err.message);
      }
    }

    // variants reinsertion
    if (Array.isArray(variants)) {
      try {
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i] || {};
          if (!v.title || !String(v.title).trim()) continue;
          const eventTypeVar = v.event_type === "gratis" ? "gratis" : "berbayar";
          let logoNormalized = { heroMediaType: null, heroMediaUrl: null };
          try {
            logoNormalized = normalizeMediaPayload(v.logo_media_type, v.logo_media_url);
          } catch (e) {
            logoNormalized = { heroMediaType: null, heroMediaUrl: null };
          }
          await db.query(
            `INSERT INTO event_variants
             (event_id, event_type, title, slug, description, price_original, price_promo, logo_media_type, logo_media_url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              eventId,
              eventTypeVar,
              String(v.title).trim(),
              (v.slug && String(v.slug).trim()) || generateSlug(v.title),
              v.description || null,
              eventTypeVar === "gratis" ? 0 : (parseFloat(v.price_original || 0) || 0),
              eventTypeVar === "gratis" ? 0 : (parseFloat(v.price_promo || 0) || 0),
              logoNormalized.heroMediaType || null,
              logoNormalized.heroMediaUrl || null,
              i,
            ],
          );
        }
      } catch (err) {
        console.warn("Failed to update variants:", err.message);
      }
    }

    // handle hero section: remove existing then insert if provided
    try {
      await db.query(`DELETE FROM event_hero_sections WHERE event_id = ?`, [eventId]);
      if (headline || subheadline || normalizedHero.heroMediaType || normalizedHero.heroMediaUrl) {
        await db.query(
          `INSERT INTO event_hero_sections (event_id, headline, subheadline, hero_media_type, hero_media_url, hero_as_background) VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, headline || null, subheadline || null, normalizedHero.heroMediaType, normalizedHero.heroMediaUrl, hero_as_background ? 1 : 0],
        );
      }
    } catch (err) {
      console.warn('Failed to update event_hero_sections for event', eventId, err.message);
    }

    try {
      await landingPageService.createLandingFromEvent(eventId, req.user?.id || null);
    } catch (err) {
      console.warn("Failed to create landing page for event", eventId, err.message || err);
    }

    res.json({
      success: true,
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// returns a single event with related benefits/problem/pains
const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const [rows] = await db.query(
      `SELECT e.*, ehs.headline, ehs.subheadline, ehs.hero_media_type, ehs.hero_media_url, ehs.hero_as_background
       FROM events e
       LEFT JOIN event_hero_sections ehs ON ehs.event_id = e.id
       WHERE e.id = ?`,
      [eventId],
    );
    if (rows.length === 0) return res.status(404).json({ success:false, message:'Not found' });
    const event = rows[0];

    const [benefits] = await db.query(`SELECT * FROM event_benefits WHERE event_id = ? ORDER BY sort_order ASC`, [eventId]);
    event.benefits = benefits.map(b=>b.benefit_text);

    const [faqs] = await db.query(`SELECT * FROM event_faqs WHERE event_id = ? ORDER BY sort_order ASC`, [eventId]);
    event.faqs = faqs.map(f=>({ question: f.question, answer: f.answer }));

    try {
      const [testimonials] = await db.query(
        `SELECT media_type, media_url, sort_order
         FROM event_testimonials
         WHERE event_id = ?
         ORDER BY sort_order ASC`,
        [eventId],
      );
      event.testimonials = testimonials;
    } catch (err) {
      event.testimonials = [];
    }

    try {
      const [variants] = await db.query(
        `SELECT event_type, title, slug, description, price_original, price_promo,
                logo_media_type, logo_media_url, sort_order
         FROM event_variants
         WHERE event_id = ?
         ORDER BY sort_order ASC`,
        [eventId],
      );
      event.variants = variants;
    } catch (err) {
      event.variants = [];
    }

    // packages removed; event.price_* contains cost information

    const [sections] = await db.query(`SELECT * FROM event_problem_sections WHERE event_id = ?`, [eventId]);
    if (sections.length) {
      event.problem_title = sections[0].title;
      event.problem_subtitle = sections[0].subtitle;
      const [pains] = await db.query(
        `SELECT * FROM event_pains WHERE problem_section_id = ? ORDER BY sort_order ASC`,
        [sections[0].id],
      );
      event.pains = pains;
    }

    delete event.payment_methods;
    delete event.bank_name;
    delete event.bank_account_name;
    delete event.bank_account_number;
    delete event.account_holder_name;

    res.json({ success:true, data:event });
  } catch(err) {
    console.error('Get event by id error:', err);
    res.status(500).json({ success:false, message:'Internal server error' });
  }
};

// global packages endpoint removed – not needed in single‑event pricing model

const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    await db.query("DELETE FROM events WHERE id = ?", [eventId]);

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getPendingAffiliates = async (req, res) => {
  try {
    const [affiliates] = await db.query(
      'SELECT id, name, email, affiliate_status, created_at FROM users WHERE affiliate_status = "pending"',
    );

    res.json({
      success: true,
      data: affiliates,
    });
  } catch (error) {
    console.error("Get pending affiliates error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const approveAffiliate = async (req, res) => {
  try {
    const { userId } = req.params;
    const approverId = req.user?.id || 1; // Get approver ID from authenticated user

    await db.query(
      'UPDATE users SET affiliate_status = "approved" WHERE id = ?',
      [userId],
    );

    // Log activity with detailed info
    await db.query(
      `INSERT INTO activity_logs (approved_by, target_user_id, action, target_type, target_id, old_status, new_status, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        approverId,
        userId,
        "affiliate_approved",
        "affiliate",
        userId,
        "pending",
        "approved",
        "Affiliate approved by admin",
      ],
    );

    res.json({
      success: true,
      message: "Affiliate approved successfully",
    });
  } catch (error) {
    console.error("Approve affiliate error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const rejectAffiliate = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const rejecterId = req.user?.id || 1; // Get rejector ID from authenticated user

    await db.query(
      'UPDATE users SET affiliate_status = "rejected" WHERE id = ?',
      [userId],
    );

    // Log activity with detailed info
    await db.query(
      `INSERT INTO activity_logs (approved_by, target_user_id, action, target_type, target_id, old_status, new_status, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rejecterId,
        userId,
        "affiliate_rejected",
        "affiliate",
        userId,
        "pending",
        "rejected",
        `Affiliate rejected. Reason: ${reason || "Not specified"}`,
      ],
    );

    res.json({
      success: true,
      message: "Affiliate rejected successfully",
    });
  } catch (error) {
    console.error("Reject affiliate error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Generate JWT token for a specific user (admin only)
const generateTokenForUser = async (req, res) => {
  try {
    // Only super_admin allowed
    if (!req.user || String(req.user.role) !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { userId, email, expiresIn = "24h" } = req.body;
    if (!userId && !email) {
      return res
        .status(400)
        .json({ success: false, message: "Specify userId or email" });
    }

    const where = userId ? "u.id = ?" : "u.email = ?";
    const param = userId || email;

    const [users] = await db.query(
      `SELECT u.id, u.email, u.name, COALESCE(r.name, 'user') as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ${where}`,
      [param],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = users[0];

    // Simple validation for expiresIn (allow formats like 24h, 7d, 1h)
    if (!/^[0-9]+[smhd]$/.test(expiresIn) && expiresIn !== "24h") {
      // We'll still allow common strings but warn
      console.warn("Unusual expiresIn format:", expiresIn);
    }

    const token = jwt.sign(
      { user_id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn },
    );

    res.json({ success: true, token, expiresIn });
  } catch (error) {
    console.error("Generate token error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getActivityLogs = async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT al.*,
              approver.name as approver_name,
              approver.email as approver_email,
              target.name as target_user_name,
              target.email as target_user_email
       FROM activity_logs al
       LEFT JOIN users approver ON al.approved_by = approver.id
       LEFT JOIN users target ON al.target_user_id = target.id
       ORDER BY al.created_at DESC
       LIMIT 100`,
    );

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Get activity logs error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============= WITHDRAWAL APPROVAL FUNCTIONS =============

// Get withdrawal approvals page
const getWithdrawalApprovalsPage = async (req, res) => {
  try {
    res.render("admin/withdrawal_approvals");
  } catch (error) {
    console.error("Get withdrawal approvals page error:", error);
    res
      .status(500)
      .render("error", { message: "Failed to load withdrawal approvals" });
  }
};

// Get pending withdrawals for approval
const getPendingWithdrawalsForApproval = async (req, res) => {
  try {
    const status = req.query.status || "pending";

    // Query untuk get withdrawals berdasarkan status
    const [withdrawals] = await db.query(
      `SELECT p.id, p.affiliate_id, u.name as affiliate_name, u.email as affiliate_email,
              p.total_amount, p.status, p.created_at, COUNT(pd.commission_id) as commission_count
       FROM payouts p
       JOIN users u ON p.affiliate_id = u.id
       LEFT JOIN payout_details pd ON p.id = pd.payout_id
       WHERE p.status = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [status],
    );

    res.json({
      success: true,
      data: withdrawals,
    });
  } catch (error) {
    console.error("Get pending withdrawals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load withdrawals",
      error: error.message,
    });
  }
};

// Get withdrawal detail for approval
const getWithdrawalDetailForApproval = async (req, res) => {
  try {
    const payoutId = req.params.id;

    // Get payout info dengan bank details dari users
    const [payouts] = await db.query(
      `SELECT p.*, 
              u.name as affiliate_name, 
              u.email as affiliate_email,
              u.bank_name,
              u.bank_account_number,
              u.bank_account_name
       FROM payouts p
       JOIN users u ON p.affiliate_id = u.id
       WHERE p.id = ?`,
      [payoutId],
    );

    if (payouts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    // Get linked commissions (include event title as description fallback)
    const [commissions] = await db.query(
      `SELECT pd.commission_id as id,
              c.amount,
              c.commission_status,
              c.created_at,
              COALESCE(e.title, CONCAT('Transaction #', t.id)) as description
       FROM payout_details pd
       JOIN commissions c ON pd.commission_id = c.id
       LEFT JOIN transactions t ON c.transaction_id = t.id
       LEFT JOIN events e ON t.event_id = e.id
       WHERE pd.payout_id = ?`,
      [payoutId],
    );

    res.json({
      success: true,
      data: {
        ...payout,
        commission_count: commissions.length,
        commissions: commissions,
      },
    });
  } catch (error) {
    console.error("Get withdrawal detail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load withdrawal detail",
      error: error.message,
    });
  }
};

// Approve withdrawal
const approveWithdrawal = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payoutId = req.params.id;
    const adminId = req.user.id;
    const note = req.body.note || "";

    // Start transaction
    await connection.beginTransaction();

    // Get payout
    const [payouts] = await connection.query(
      "SELECT * FROM payouts WHERE id = ?",
      [payoutId],
    );

    if (payouts.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    if (payout.status !== "pending") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending withdrawals can be approved",
      });
    }

    // Update payout status to approved dengan admin note
    await connection.query(
      `UPDATE payouts SET status = 'approved', admin_approved_by = ?, admin_approved_at = NOW(), admin_note = ? 
       WHERE id = ?`,
      [adminId, note || null, payoutId],
    );

    // Update linked commissions status to 'pending' (waiting for payment)
    await connection.query(
      `UPDATE commissions SET commission_status = 'pending' 
       WHERE id IN (
         SELECT commission_id FROM payout_details WHERE payout_id = ?
       )`,
      [payoutId],
    );

    // Log activity (use new activity_logs schema)
    await connection.query(
      `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        adminId,
        "APPROVE_WITHDRAWAL",
        "payout",
        payoutId,
        "approved",
        `Approved withdrawal #${payoutId} for Rp ${payout.total_amount}. Note: ${note}`,
      ],
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Withdrawal approved successfully",
      data: { payout_id: payoutId, status: "approved" },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Approve withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve withdrawal",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// Reject withdrawal
const rejectWithdrawal = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payoutId = req.params.id;
    const adminId = req.user.id;
    const reason = req.body.reason || "";

    // Start transaction
    await connection.beginTransaction();

    // Get payout
    const [payouts] = await connection.query(
      "SELECT * FROM payouts WHERE id = ?",
      [payoutId],
    );

    if (payouts.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    if (payout.status !== "pending") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending withdrawals can be rejected",
      });
    }

    // Update payout status to rejected
    await connection.query(
      `UPDATE payouts SET status = 'rejected', admin_approved_by = ?, admin_approved_at = NOW()
       WHERE id = ?`,
      [adminId, payoutId],
    );

    // Revert linked commissions back to 'ready_for_withdraw'
    await connection.query(
      `UPDATE commissions SET commission_status = 'ready_for_withdraw' 
       WHERE id IN (
         SELECT commission_id FROM payout_details WHERE payout_id = ?
       )`,
      [payoutId],
    );

    // Log activity (use new activity_logs schema)
    await connection.query(
      `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        adminId,
        "REJECT_WITHDRAWAL",
        "payout",
        payoutId,
        "rejected",
        `Rejected withdrawal #${payoutId} for Rp ${payout.total_amount}. Reason: ${reason}`,
      ],
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Withdrawal rejected successfully",
      data: { payout_id: payoutId, status: "rejected" },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Reject withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject withdrawal",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// ============= PAGE RENDER METHODS (for UI) =============

// Get users page with data
const getUsersPage = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.*, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`,
    );

    res.render("admin/users", {
      users: users,
      title: "User Management",
    });
  } catch (error) {
    console.error("Get users page error:", error);
    res.status(500).render("error", { message: "Failed to load users" });
  }
};

// Get events page with data
const getEventsPage = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.name as created_by_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       ORDER BY e.created_at DESC`,
    );

    res.render("admin/events", {
      events: events,
      title: "Event Management",
    });
  } catch (error) {
    console.error("Get events page error:", error);
    res.status(500).render("error", { message: "Failed to load events" });
  }
};

// Get affiliates page with data
const getAffiliatesPage = async (req, res) => {
  try {
    const [affiliates] = await db.query(
      'SELECT id, name, email, affiliate_status, created_at FROM users WHERE affiliate_status = "pending"',
    );

    res.render("admin/affiliates", {
      affiliates: affiliates,
      title: "Affiliate Management",
    });
  } catch (error) {
    console.error("Get affiliates page error:", error);
    res.status(500).render("error", { message: "Failed to load affiliates" });
  }
};

// Get activity logs page with data
const getActivityLogsPage = async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT al.*,
              approver.name as approver_name,
              approver.email as approver_email,
              target.name as target_user_name,
              target.email as target_user_email
       FROM activity_logs al
       LEFT JOIN users approver ON al.approved_by = approver.id
       LEFT JOIN users target ON al.target_user_id = target.id
       ORDER BY al.created_at DESC
       LIMIT 100`,
    );

    res.render("admin/activity-logs", {
      logs: logs,
      title: "Activity Logs",
    });
  } catch (error) {
    console.error("Get activity logs page error:", error);
    res
      .status(500)
      .render("error", { message: "Failed to load activity logs" });
  }
};

// Update User
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role_id, status } = req.body;

    // Build dynamic UPDATE query - only update fields that are provided
    let updateFields = [];
    let updateValues = [];

    if (name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }
    if (email) {
      updateFields.push("email = ?");
      updateValues.push(email);
    }
    if (role_id) {
      updateFields.push("role_id = ?");
      updateValues.push(role_id);
    }
    if (status) {
      updateFields.push("status = ?");
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    updateValues.push(userId);

    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;

    await db.query(query, updateValues);

    res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

module.exports = {
  getActiveEvents,
  getDashboardStats,
  getUsers,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getPendingAffiliates,
  approveAffiliate,
  rejectAffiliate,
  generateTokenForUser,
  uploadHero,
  getActivityLogs,
  getWithdrawalApprovalsPage,
  getEventById,
  getPendingWithdrawalsForApproval,
  getWithdrawalDetailForApproval,
  approveWithdrawal,
  rejectWithdrawal,
  updateUser,
  // Page render methods
  getUsersPage,
  getEventsPage,
  getAffiliatesPage,
  getActivityLogsPage,
};

// upload handler for hero media
async function uploadHero(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    // return URL path relative to public
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (err) {
    console.error('Upload hero error:', err);
    res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
  }
}
