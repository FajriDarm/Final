// Simple server-sent events broadcaster for lead updates
const clients = new Set();

function addClient(res) {
  clients.add(res);
}

function removeClient(res) {
  clients.delete(res);
}

function broadcast(event, payload) {
  const data = JSON.stringify(payload || {});
  for (const res of clients) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      // ignore write errors
    }
  }
}

module.exports = {
  addClient,
  removeClient,
  broadcast,
};
