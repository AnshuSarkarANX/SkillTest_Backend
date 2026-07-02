const express = require("express");
const mongoose = require("mongoose");
const {WebSocketServer,WebSocket} = require("ws"); 
const https = require("http");

const fs = require("fs");
const cors = require("cors");
require("dotenv").config();


const app = express();
const server = https.createServer(app);



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
    res.status(200).json(allData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/status",(req,res)=>{
   res.status(200).json({status:"ok✅"})
})

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
app.use('/api/auth', authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/ai", require("./routes/aiRoutes.js"));
app.use("/api/results", require("./routes/resultRoutes"));
app.use("/api/user-key", require("./routes/userKeyRoutes"));

// WebSocket Server
const wss = new WebSocketServer({ server, path:"/interview" });



const PORT = process.env.PORT || 3000;


 app.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});

server.listen(8080, () => {
  console.log("WebSocket Server running on port 8080");
});

module.exports = { wss };