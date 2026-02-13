const nodemailer = require("nodemailer");

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "SkillTest - Your OTP Code",
    html: `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Your OTP code is: <strong style="color: #FF6D1F; font-size: 18px;">${otp}</strong></p>
      <p style="color: #666;">This code will expire in 10 minutes.</p>
    </div>
  `,
  };


  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOTPEmail };
