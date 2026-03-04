const db = require("../config/database");
const jwt = require("jsonwebtoken");
const http = require("http");
const querystring = require("querystring");

function authHeadersFor(userId, email) {
  const token = jwt.sign(
    { user_id: userId, email: email || null },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "1h" },
  );
  return { Authorization: "Bearer " + token };
}

function httpPost(path, data, headers) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(data);
    const options = {
      hostname: "localhost",
      port: process.env.PORT || 5000,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        ...(headers || {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

(async () => {
  let pickedTxnId = null;
  let previousStatus = null;

  try {
    const [salesUsers] = await db.query(
      `SELECT u.id, u.email
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'sales'
       ORDER BY u.id ASC
       LIMIT 1`,
    );

    if (!salesUsers.length) throw new Error("sales user not found");
    const salesUser = salesUsers[0];

    const [txRows] = await db.query(
      `SELECT t.id, ls.status AS lead_status
       FROM transactions t
       LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id
       WHERE t.status IN ('pending', 'stage_2_approved')
       ORDER BY t.created_at DESC
       LIMIT 1`,
    );

    if (!txRows.length) throw new Error("no candidate transaction found");

    pickedTxnId = txRows[0].id;
    previousStatus = txRows[0].lead_status || null;

    console.log("using txn", pickedTxnId, "prev status", previousStatus);

    const headers = authHeadersFor(salesUser.id, salesUser.email);
    const updateRes = await httpPost(
      "/sales/update-lead-status",
      { id: pickedTxnId, lead_status: "REJECTED" },
      headers,
    );

    if (updateRes.status < 200 || updateRes.status >= 300) {
      throw new Error(`update-lead-status failed with status ${updateRes.status}`);
    }

    const [savedRows] = await db.query(
      "SELECT status FROM lead_statuses WHERE transaction_id = ? LIMIT 1",
      [pickedTxnId],
    );

    const saved = savedRows[0]?.status || null;
    console.log("saved status", saved);
    if (saved !== "REJECTED") {
      throw new Error(`expected REJECTED after update, got ${saved}`);
    }

    const [historyRows] = await db.query(
      `SELECT ls.transaction_id AS id
       FROM lead_statuses ls
       WHERE ls.status IN ('SEDANG BERANGKAT','REJECTED')
         AND ls.updated_at >= (NOW() - INTERVAL 7 DAY)
         AND ls.transaction_id = ?
       LIMIT 1`,
      [pickedTxnId],
    );

    if (!historyRows.length) {
      throw new Error("transaction not found in 7-day history set");
    }

    console.log("History flow ok");
  } catch (err) {
    console.error("History flow failed", err.message || err);
    process.exitCode = 1;
  } finally {
    if (pickedTxnId !== null) {
      try {
        if (previousStatus) {
          await db.query(
            `INSERT INTO lead_statuses (transaction_id, status, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`,
            [pickedTxnId, previousStatus],
          );
        }
      } catch (restoreErr) {
        console.warn("restore warning", restoreErr.message || restoreErr);
      }
    }
    process.exit(process.exitCode || 0);
  }
})();
