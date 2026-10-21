const { createSalonServer } = require("../server");

const salonApp = createSalonServer();

module.exports = (req, res) => {
  return salonApp.requestHandler(req, res);
};
