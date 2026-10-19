const { createSalonServer } = require("../server");

// Re-use salon server instance across warm serverless invocations
let serverInstance = null;

function getServer() {
  if (!serverInstance) {
    serverInstance = createSalonServer();
  }
  return serverInstance;
}

module.exports = (req, res) => {
  const server = getServer();
  server.emit("request", req, res);
};
