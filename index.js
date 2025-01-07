const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
// const psprt=require("./Config/psprt");
// const paymentRoutes = require('./routes/PaymentRoutes');
const authRoutes = require("./routes/signup");//for signup
const loginRoute = require("./routes/login");


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// CORS options for development
const corsOptions = {
  origin: ["https://ai4fi.netlify.app/", "http://localhost:5173"], // Add localhost
  methods: "GET,POST",
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));


// Contact schema
const contactSchema = new mongoose.Schema({
  name: String,
  company: String, // Company name
  phone: String, // Contact phone number
  email: String,
  subject: String,
  message: String,
  date: { type: Date, default: Date.now },
});

const Contact = mongoose.model("Contact", contactSchema);

// POST route to save contact form submissions
app.post("/api/about", async (req, res) => {
  console.log("Received data:", req.body)
  try {
    const { name, company, phone, email, subject, message } = req.body;
    const newContact = new Contact({ name, company, phone, email, subject, message });
    await newContact.save();
    res.status(201).send("Contact saved successfully");
  } catch (error) {
    console.error("Error saving contact:", error);
    res.status(500).send("Server error");
  }
});

// GET route to fetch all form submissions for backup
app.get("/api/backup", async (req, res) => {
  try {
    const contacts = await Contact.find(); // Fetch all contact form submissions
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Server error");
  }
});
// app.use('/api', paymentRoutes);
app.use("/api/auth", authRoutes); // Separate auth route
app.use('/api/auth', loginRoute);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});