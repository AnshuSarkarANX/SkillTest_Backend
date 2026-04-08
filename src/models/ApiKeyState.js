const mongoose = require("mongoose");

const apiKeyStateSchema = new mongoose.Schema({
  _id: { type: String, default: "singleton" },
  stickyIndex: { type: Number, default: 0 },
  stickySetAt: { type: Date, default: null },
});

module.exports = mongoose.model("ApiKeyState", apiKeyStateSchema);
