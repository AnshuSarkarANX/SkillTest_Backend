const mongoose = require("mongoose");


const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      sparse: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    FTL: {
      type: Boolean, // Use "Boolean" with uppercase B
      required: true,
      default: true,
    },
    fullName: {
      type: String,
      required: false,
      trim: true,
    },
    gender: {
      type: String,
      // You can add enum: ["male", "female", "other"] for restriction if needed
    },
    name: {
      type: String,
      trim: true,
    },
    dob: {
      type: Date,
    },
    qualification: {
      type: String,
      // Optionally use enum for allowed qualifications
    },
    specialization: {
      type: String,
      trim: true,
    },
    softSkills: {
      type: [String],
      default: [],
    },
    techSkills: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
