const http = require("http");
const jwt = require("jsonwebtoken");
(async () => {
  try {
    const token = jwt.sign(
      { user_id: 19 },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "1h" },
    );
    const postData = "lead_status=DP";
    const options = {
      hostname: "localhost",
      port: 5000,
      path: "/finance/payment-verification/27/set-lead-status",
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
      res.on("end", () => {
        console.log("status", res.statusCode);
        console.log("headers", res.headers);
        console.log("body", d);
      });
    });
    req.on("error", (e) => {
      console.error("request error", e);
    });
    req.write(postData);
    req.end();
  } catch (e) {
    console.error(e);
  }
})();
