const db = require("../config/database");
const jwt = require("jsonwebtoken");
const http = require("http");
const querystring = require("querystring");

function authHeadersFor(userId) {
  const token = jwt.sign(
    { user_id: userId },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "1h" },
  );
  return { Authorization: "Bearer " + token };
}

async function httpPost(path, data, headers) {
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
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

(async () => {
  try {
    // choose a transaction
    const [trx] = await db.query(
      "SELECT id FROM transactions WHERE status = ? LIMIT 1",
      ["pending"],
    );
    if (!trx || trx.length === 0) throw new Error("no transaction found");
    const id = trx[0].id;
    console.log("using txn", id);

    // 1) set lead_status = HOT as sales (simulate)
    await db.query(
      "INSERT INTO lead_statuses (transaction_id, status, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()",
      [id, "HOT"],
    );
    console.log("set to HOT");

    // 2) as finance, check API shows HOT
    const headers = authHeadersFor(19); // finance user id
    const res1 = await new Promise((resolve, reject) => {
      http
        .get(
          {
            hostname: "localhost",
            port: process.env.PORT || 5000,
            path: "/finance/payment-verification/api",
            headers,
          },
          (r) => {
            let d = "";
            r.on("data", (c) => (d += c));
            r.on("end", () => resolve({ status: r.statusCode, body: d }));
          },
        )
        .on("error", reject);
    });
    console.log("api list status", res1.status);
    const jp = JSON.parse(res1.body);
    const foundHot = (jp.pendingPayments || []).some(
      (p) => p.id === id && (p.lead_status || "").toUpperCase() === "HOT",
    );
    console.log("foundHot in API?", foundHot);

    if (!foundHot) throw new Error("HOT not visible to finance");

    // 3) as finance, set LUNAS
    const res2 = await httpPost(
      `/finance/payment-verification/${id}/set-lead-status`,
      { lead_status: "LUNAS" },
      headers,
    );
    console.log("set LUNAS", res2.status);

    // 4) verify transactions table advanced
    const [after] = await db.query(
      "SELECT id, status, payment_status FROM transactions WHERE id = ?",
      [id],
    );
    console.log("after txn", after[0]);

    if (after[0].status !== "stage_2_approved")
      throw new Error("txn not advanced");

    // 5) Sales page should show stage_2_approved (call controller query directly)
    const [rows] = await db.query(
      `SELECT t.id, t.status FROM transactions t WHERE t.id = ? LIMIT 1`,
      [id],
    );
    console.log("sales view sees status", rows[0]);

    console.log("E2E flow ok");
  } catch (e) {
    console.error("E2E error", e);
    process.exit(1);
  }
  process.exit(0);
})();
