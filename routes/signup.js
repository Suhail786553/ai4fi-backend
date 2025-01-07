const express = require("express");
const admin = require("firebase-admin");
const session = require("express-session");
const { sendOtp } = require("../utils/otpSender");
const router = express.Router();
const otpStore = {};

// Initialize Firebase Admin SDK
const serviceAccount = require("../Config/serviceAccountKey.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Configure session middleware
router.use(
  session({
    secret: process.env.SESSION_SECRET || "your-random-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Firebase Signup Route
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    res.status(201).json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName,
      },
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send("Server error");
  }
});

// Generate Custom Token for Login
router.post("/login", async (req, res) => {
  const { email } = req.body;

  try {
    // Find user by email
    const user = await admin.auth().getUserByEmail(email);

    // Generate custom token
    const customToken = await admin.auth().createCustomToken(user.uid);

    res.status(200).json({
      token: customToken,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(401).send("Authentication failed");
  }
});

// OTP Sending Route
router.post("/sendOtp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  try {
    await sendOtp(email, otp);
    otpStore[email] = { otp, expiresAt };
    res.json({ success: true, message: "OTP sent successfully." });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Error sending OTP." });
  }
});

// OTP Verification Route
router.post("/verifyOtp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  const storedOtpData = otpStore[email];
  if (!storedOtpData) {
    return res.status(400).json({ message: "OTP not found or expired." });
  }

  if (storedOtpData.expiresAt < Date.now()) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP has expired." });
  }

  if (storedOtpData.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP." });
  }

  delete otpStore[email];
  res.status(200).json({ message: "OTP verified successfully." });
});

module.exports = router;