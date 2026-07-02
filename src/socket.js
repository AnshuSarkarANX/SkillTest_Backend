const  dotenv = require("dotenv");
dotenv.config();
const wss = require("./server");
const DEEPGRAM_URL = "wss://agent.deepgram.com/agent";
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY; //
