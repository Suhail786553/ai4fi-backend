const nodemailer = require("nodemailer");

// Create a transporter using Gmail with App Passwords
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address (set in .env)
    pass: process.env.EMAIL_APP_PASSWORD, // Your Gmail App Password (set in .env)
  },
});

/**
 * Send an OTP to the specified email address
 * @param {string} email - Recipient email address
 * @param {string} otp - OTP to send
 * @returns {Promise<boolean>} - Returns true if email is sent successfully
 */
const sendOtp = async (email, otp) => {
  try {
    if (!email) {
      throw new Error("Recipient email address is missing.");
    }

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender email
      to: email, // Recipient email
      subject: "Your OTP Code",
      html: `
        <h1>Your OTP Code</h1>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code is valid for 5 minutes.</p>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending OTP:", error.message);
    throw new Error("Failed to send OTP. Please try again.");
  }
};

module.exports = { sendOtp };