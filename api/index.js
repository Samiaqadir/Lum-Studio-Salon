const { createSalonServer } = require("../server");

const salonApp = createSalonServer();

module.exports = async (req, res) => {
  try {
    await salonApp.requestHandler(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Internal server error." }));
    }
  }
};
