const db = require("../config/database");
const jwt = require("jsonwebtoken");
const http = require("http");
const querystring = require("querystring");

async function run() {
  try {
    const token = jwt.sign(
      { user_id: 2, email: "finance@example.com" },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "1h" },
    );

    const post = (id, status) =>
      new Promise((resolve, reject) => {
        const postData = querystring.stringify({ id: id, lead_status: status });
        const options = {
          hostname: "localhost",
          port: process.env.PORT || 5000,
          path: `/sales/update-lead-status`,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(postData),
            Cookie: "token=" + encodeURIComponent(token),
          },
        };
        const req = http.request(options, (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () =>
            resolve({
              statusCode: res.statusCode,
              body: d,
            }),
          );
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
      });

    console.log("Checking current commissions for affiliate 16...");
    const [commsBefore] = await db.query(
      "SELECT SUM(amount) as total FROM commissions WHERE affiliate_id = 16",
    );
    console.log("Total commissions before:", commsBefore[0]?.total || 0);

    console.log("Setting SEDANG BERANGKAT for transaction 29...");
    const r = await post(29, "SEDANG BERANGKAT");
    console.log("SEDANG BERANGKAT response", r.statusCode, r.body);

    console.log("Checking commissions after...");
    const [commsAfter] = await db.query(
      "SELECT SUM(amount) as total FROM commissions WHERE affiliate_id = 16",
    );
    console.log("Total commissions after:", commsAfter[0]?.total || 0);

    const [newComms] = await db.query(
      "SELECT * FROM commissions WHERE transaction_id = 29",
    );
    console.log("New commissions for transaction 29:", newComms);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
