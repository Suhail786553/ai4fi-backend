const mongoose = require("mongoose");

const ModelSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  modelConfig: { type: Object, required: true },
  imageUrl: { type: [String], required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Model", ModelSchema);
