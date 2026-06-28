const mongoose = require("mongoose");

const experienceItemSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },

  timePeriod: {
    type: String,
    required: true,
  },
  description: {
    type: [String],
    required: true,
  },
});
module.exports = experienceItemSchema;
