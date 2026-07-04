const dotenv = require("dotenv");
dotenv.config();

const DEEPGRAM_URL = "wss://agent.deepgram.com/agent";
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY; //

module.exports = function setupSocket(wss) {
  wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.send("Welcome!");

    ws.on("message", (message) => {
      const text = message.toString();
      console.log("Received message:", text);

      ws.send(`You sent: ${text}`);
    });
  });
};