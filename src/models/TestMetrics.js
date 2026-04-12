const mongoose = require("mongoose");

const testMetricsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    testResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestResult",
      default: null,
    },
    skill: { type: String, required: true },
    level: { type: String, required: true },
    totalScore: { type: Number, required: true },
    totalPossible: { type: Number, required: true },
    overallPercentage: { type: Number, required: true },
    mcqEarned: { type: Number, default: 0 },
    mcqTotal: { type: Number, default: 0 },
    textEarned: { type: Number, default: 0 },
    textTotal: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TestMetrics", testMetricsSchema);
