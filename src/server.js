const express = require("express");
const mongoose = require("mongoose");
const https = require("https");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://gmqxl3nc-5173.inc1.devtunnels.ms",
    ],
    credentials: true,
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

const PORT = process.env.PORT || 3000;
const serverOptions = {
  key: fs.readFileSync("./server.key"),
  cert: fs.readFileSync("./server.cert"),
};

https.createServer(serverOptions, app).listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});
