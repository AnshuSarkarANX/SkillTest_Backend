const mongoose  = require("mongoose");

const interviewPromptSchema = new mongoose.Schema({
  system_prompt: {
    type: String,
  },
  score: { type: Number, default: 0 },
  weighting_used: {
    type: String,
    enum: ["exp", "fsr"],
    default: "exp",
  },
});
module.exports = mongoose.model("InterviewPrompts", interviewPromptSchema);