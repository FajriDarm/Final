const http = require("http");

http
  .get("http://localhost:5000/sales/verify-leads", (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      const matches = data.match(/Status DB:\s*[:\s]*([A-Z\s\-]+)/g) || [];
      console.log("Status DB matches:", matches.slice(0, 20));
    });
  })
  .on("error", (err) => console.error("fetch error", err));
