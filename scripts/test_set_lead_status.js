const db = require("../config/database");
const jwt = require("jsonwebtoken");
const http = require("http");
const querystring = require("querystring");

async function run() {
  try {
    // find finance user
    const [users] = await db.query(
      "SELECT id, name FROM users WHERE id = 2 LIMIT 1",
    );
    const user = users[0];
    if (!user) {
      console.error("finance user not found");
      process.exit(1);
    }

    const token = jwt.sign(
      { user_id: user.id, email: user.email || null },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "1h" },
    );

    const post = (id, status) =>
      new Promise((resolve, reject) => {
        const postData = querystring.stringify({ lead_status: status });
        const options = {
          hostname: "localhost",
          port: process.env.PORT || 5000,
          path: `/finance/payment-verification/${id}/set-lead-status`,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(postData),
            Authorization: "Bearer " + token,
          },
        };
        const req = http.request(options, (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () =>
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: d,
            }),
          );
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
      });

    console.log("Setting DP...");
    const r1 = await post(27, "DP");
    console.log("DP response", r1.statusCode);
    const [rows1] = await db.query(
      "SELECT * FROM lead_statuses WHERE transaction_id = ?",
      [27],
    );
    console.log("lead_statuses after DP:", rows1);

    console.log("Setting LUNAS...");
    const r2 = await post(27, "LUNAS");
    console.log("LUNAS response", r2.statusCode);
    const [rows2] = await db.query(
      "SELECT * FROM lead_statuses WHERE transaction_id = ?",
      [27],
    );
    console.log("lead_statuses after LUNAS:", rows2);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
