const User = require("../models/User");
const OTP = require("../models/OTP");
const { generateOTP } = require("../utils/otpGenerator");
const { sendOTPEmail } = require("../utils/emailService");

// Request OTP
exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Generate OTP
    const otp = generateOTP();
    console.log(`Generated OTP for ${email}`);

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });

    // Save new OTP
   const savedOTP = await OTP.create({ email, otp });
   console.log("Saved OTP to database:", savedOTP);

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp);

    if (!emailResult.success) {
      return res.status(500).json({ error: "Failed to send OTP" });
    }

    res.json({
      message: "OTP sent successfully",
      email,
    });
  } catch (error) {
    console.error("Request OTP error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    
  try {
    const { email, otp } = req.body;
    console.log("Verifying - Email:", email);

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    // Find OTP
    const otpRecord = await OTP.findOne({ email, otp });
    // console.log("Found OTP record:", otpRecord);

    if (!otpRecord) {
        const allOTPs = await OTP.find({ email });
        // console.log("All OTPs for this email:", allOTPs);
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ email, isVerified: true });
    } else {
      user.isVerified = true;
      await user.save();
    }

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({
      message: "OTP verified successfully",
      user
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: error.message });
  }
};
