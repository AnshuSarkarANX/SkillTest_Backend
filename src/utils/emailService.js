const { BrevoClient } = require("@getbrevo/brevo");

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

async function sendOTPEmail(email, otp) {
  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: {
        name: "SkillTest",
        email: process.env.SENDER_EMAIL,
      },
      to: [{ email }],
      subject: "SkillTest - Your OTP Code",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Your OTP code is: <strong style="color: #FF6D1F; font-size: 18px;">${otp}</strong></p>
          <p style="color: #666;">This code will expire in 10 minutes.</p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOTPEmail };
