const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Import the test model
const Test = require("./models/Test");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

// Test route to insert data
app.post("/test", async (req, res) => {
  try {
    const testData = new Test({
      name: "John Doe",
      email: "john@example.com",
    });

    const savedData = await testData.save();
    res.json({
      message: "Data saved successfully",
      data: savedData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route to fetch all data
app.get("/test-all", async (req, res) => {
  try {
    const allData = await Test.find();
    res.json(allData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
