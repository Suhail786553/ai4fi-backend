const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');
const Model = require("./models/Model");
const router = express.Router();

const authRoutes = require("./routes/signup"); // For signup
const loginRoute = require("./routes/login");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

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
    const contacts = await Contact.find(); // Fetch all contact form submissions
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Server error");
  }
});

// Proxy routes
app.post('/proxy/generate-model', async (req, res) => {
  try {
    const response = await fetch('http://52.66.24.190/generate-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).send('Internal Server Error');
  }
});
// routes for virtual-try-on
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

app.post('/proxy/virtual-try-on', upload.fields([
  { name: 'model_image', maxCount: 10 },
  { name: 'garment_image', maxCount: 1 },
]), async (req, res) => {
  try {
    // Ensure files are uploaded
    if (!req.files || !req.files.model_image || !req.files.garment_image) {
      return res.status(400).json({ message: 'Files are missing' });
    }

    const formData = new FormData();

    // Append model images
    req.files['model_image'].forEach((file) => {
      formData.append('model_image', fs.createReadStream(file.path));  // Ensure the file path is used correctly
    });
    console.log(req.files);
    console.log(req.body);
    // Append garment image
    formData.append('garment_image', fs.createReadStream(req.files['garment_image'][0].path));


    // Append category
    formData.append('category', req.body.category || '');  // Ensure category is set

    const response = await fetch('http://52.66.24.190:8000/virtual-try-on', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),  // Get the correct headers from FormData
      redirect: 'manual', // Prevent automatic redirects
    });

    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('Location');
      if (redirectUrl) {
        const redirectResponse = await fetch(redirectUrl, {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders(),
        });
        const redirectData = await redirectResponse.json();
        res.status(redirectResponse.status).json(redirectData);
      } else {
        res.status(500).json({ message: 'Redirect location missing' });
      }
    } else {
      const data = await response.json();
      res.status(response.status).json(data);
    }

    // Cleanup uploaded files
    [...req.files['model_image'], req.files['garment_image'][0]].forEach((file) => {
      fs.unlink(file.path, (err) => {
        if (err) console.error(`Error deleting file: ${file.path}`, err);
      });
    });

  } catch (error) {
    console.error('Error proxying request:', error);

    // Cleanup files on error
    if (req.files) {
      [...(req.files['model_image'] || []), ...(req.files['garment_image'] || [])].forEach((file) => {
        fs.unlink(file.path, (err) => {
          if (err) console.error(`Error deleting file: ${file.path}`, err);
        });
      });
    }

    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});
// save models
app.post("/api/save-model", async (req, res) => {
  try {
    console.log("Incoming Request Data:", req.body);
    const { userId, modelConfig, imageUrl } = req.body;

    if (!userId || !modelConfig || !imageUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Save model to MongoDB (example)
    const newModel = new Model({
      userId,
      modelConfig,
      imageUrl,
      createdAt: new Date(),
    });

    await newModel.save();
    res.status(201).json({ message: "Model saved successfully!" });
  } catch (error) {
    console.error("Error saving model:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/get-models", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const models = await Model.find({ userId });

    res.status(200).json(models);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Auth routes
app.use("/api/auth", authRoutes); // Separate auth route
app.use('/api/auth', loginRoute);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
