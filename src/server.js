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
const setupSocket = require("./socket");

// WebSocket Server


const wss = new WebSocketServer({
  server,
  path: "/interview",
});
 setupSocket(wss);






const PORT = process.env.PORT || 3000;


 server.listen(PORT, () => {
  console.log(` Server  & WebSocket running on port ${PORT}`);
});


module.exports = { wss };