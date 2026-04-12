const mongoose = require("mongoose");

const userApiKeySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  encryptedKey: String,
  iv: String,
  authTag: String,
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserApiKey", userApiKeySchema);
