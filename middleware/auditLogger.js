const db = require("../config/database");

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getTargetId(req) {
  if (req.params && req.params.id) return req.params.id;
  if (req.params && req.params.eventId) return req.params.eventId;
  if (req.params && req.params.userId) return req.params.userId;
  if (req.params && req.params.payoutId) return req.params.payoutId;
  if (req.body && req.body.id) return req.body.id;
  return null;
}

module.exports = function auditLogger(req, res, next) {
  const method = (req.method || "").toUpperCase();
  if (!MUTATION_METHODS.has(method)) return next();

  const path = req.originalUrl || req.path || "";
  // Skip auth login/logout tracking
  if (
    path === "/api/auth/login" ||
    path === "/api/auth/logout" ||
    path === "/logout"
  ) {
    return next();
  }

  res.on("finish", async () => {
    if (res.locals && res.locals.auditLogged) return;

    const actorId = req.user?.id || null;
    const action = `request_${method.toLowerCase()}`;
    const targetId = getTargetId(req);
    const targetType = "route";
    const status = res.statusCode;

    const description = `Request ${method} ${path} (status ${status})`;

    try {
      await db.query(
        `INSERT INTO activity_logs (approved_by, action, target_type, target_id, description, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [actorId, action, targetType, targetId, description],
      );
    } catch (e) {
      console.warn("Audit log insert failed:", e && (e.message || e));
    }
  });

  next();
};
