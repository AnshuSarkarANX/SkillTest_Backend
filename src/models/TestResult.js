const mongoose = require("mongoose");

const testResultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fullResult: { type: mongoose.Schema.Types.Mixed, required: true }, // entire testResult object
  },
  { timestamps: true },
);

// ✅ TTL — auto-delete after 7 days
testResultSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
);

module.exports = mongoose.model("TestResult", testResultSchema);
