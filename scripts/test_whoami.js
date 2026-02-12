const http = require("http");
const jwt = require("jsonwebtoken");

function get(userId) {
  const token = jwt.sign(
    { user_id: userId },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "1h" },
  );
  const options = {
    hostname: "localhost",
    port: 5000,
    path: "/api/whoami",
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  };
  const req = http.request(options, (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => {
      console.log("user", userId, "status", res.statusCode, "body", d);
    });
  });
  req.on("error", (e) => console.error("err", e));
  req.end();
}

get(19); // finance
get(16); // affiliate
