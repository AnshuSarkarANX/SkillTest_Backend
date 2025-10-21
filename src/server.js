const express = require("express");
const mongoose = require("mongoose");

const fs = require("fs");
const cors = require("cors");
require("dotenv").config();


const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);



// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.log("MongoDB Connection Error:", err));


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
const userRoutes = require('./routes/userRoutes');
app.use('/api/auth', authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/ai", require("./routes/aiRoutes.js"));

const PORT = process.env.PORT || 3000;


 app.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});
