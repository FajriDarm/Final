const http = require("http");

http
  .get("http://localhost:5000/sales/verify-leads", (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      // Print a short excerpt around 'Komisi' column
      const idx = data.indexOf("Komisi (Total per Event)");
      if (idx !== -1) {
        console.log("Found header at index", idx);
        console.log(data.substr(idx, 500));
      } else {
        // fallback show first 800 chars
        console.log(data.substr(0, 800));
      }
    });
  })
  .on("error", (err) => console.error("fetch error", err));
