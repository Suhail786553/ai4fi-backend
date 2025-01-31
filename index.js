const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const fs = require("fs");
const FormData = require("form-data");
const fetch = require("node-fetch");

const authRoutes = require("./routes/signup"); // For signup
const loginRoute = require("./routes/login");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // Set a longer timeout
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err.message || err);
    process.exit(1); // Exit process if DB connection fails
  });

// CORS options for development
const corsOptions = {
  origin: ["https://ai4fi.netlify.app/", "http://localhost:5173"], // Add localhost
  methods: "GET,POST",
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Contact schema
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String },
  phone: { type: String },
  email: { type: String, required: true },
  subject: { type: String },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const Contact = mongoose.model("Contact", contactSchema);

// Contact form routes
app.post("/api/about", async (req, res) => {
  try {
    const { name, company, phone, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).send("Missing required fields");
    }
    const newContact = new Contact({ name, company, phone, email, subject, message });
    await newContact.save();
    res.status(201).send("Contact saved successfully");
  } catch (error) {
    console.error("Error in /api/about route:", error.message || error);
    res.status(500).send("Server error");
  }
});

app.get("/api/backup", async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Server error");
  }
});

// Proxy routes
app.post("/proxy/generate-model", async (req, res) => {
  try {
    const response = await fetch("http://52.66.24.190/generate-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Error proxying request:", error);
    res.status(500).send("Internal Server Error");
  }
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post(
  "/proxy/virtual-try-on",
  upload.fields([
    { name: "model_image", maxCount: 10 },
    { name: "garment_image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!req.files || !req.files.model_image || !req.files.garment_image) {
        return res.status(400).json({ message: "Files are missing" });
      }

      const formData = new FormData();
      req.files["model_image"].forEach((file) => {
        formData.append("model_images", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      });
      formData.append("garment_image", req.files["garment_image"][0].buffer, {
        filename: req.files["garment_image"][0].originalname,
        contentType: req.files["garment_image"][0].mimetype,
      });
      formData.append("category", req.body.category);

      const response = await fetch("http://52.66.24.190:8000/virtual-try-on/", {
        method: "POST",
        body: formData,
        headers: { ...formData.getHeaders() },
      });

      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl) {
          const redirectResponse = await fetch(redirectUrl, {
            method: "POST",
            body: formData,
            headers: formData.getHeaders(),
          });
          const redirectData = await redirectResponse.json();
          res.status(redirectResponse.status).json(redirectData);
        } else {
          res.status(500).json({ message: "Redirect location missing" });
        }
      } else {
        const data = await response.json();
        return res.status(response.status).json(data);
      }
    } catch (error) {
      console.error("Error proxying request:", error);
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  }
);

// Auth routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", loginRoute);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
