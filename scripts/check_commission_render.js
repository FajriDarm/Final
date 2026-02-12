const http = require("http");

http
  .get("http://localhost:5000/sales/verify-leads", (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      const matches = data.match(/Rp\s*[0-9\.]+,\d{2}/g) || [];
      console.log("Found money strings:", matches.slice(0, 20));
    });
  })
  .on("error", (err) => console.error("fetch error", err));
