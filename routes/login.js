// const express = require("express");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const router = express.Router();

// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ message: "User not found" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
//     res.status(200).json({
//       token,
//       user: { name: user.name, email: user.email },
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin"); // Firebase Admin SDK
const User = require("../models/User");

const router = express.Router();

// Initialize Firebase Admin SDK (Required for token verification)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require("../config/firebaseServiceAccount.json")), 
  });
}

router.post("/login", async (req, res) => {
  const { email, firebaseToken } = req.body;

  try {
    // 1️⃣ Verify Firebase Token
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    if (decodedToken.email !== email) {
      return res.status(401).json({ message: "Invalid Firebase token" });
    }

    // 2️⃣ Find User in MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      // Auto-create user if not exists (Optional)
      user = await User.create({ name: decodedToken.name, email });
    }

    // 3️⃣ Generate JWT Token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      token,
      user: { name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
