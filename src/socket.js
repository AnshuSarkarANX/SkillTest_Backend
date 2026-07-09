const InterviewPrompts = require("./models/InterviewPrompts");
const { DeepgramClient } = require("@deepgram/sdk");
const dotenv = require("dotenv");
const { createWavHeader } = require("./utils/wavHeader");
dotenv.config();

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

module.exports = function setupSocket(wss) {
  wss.on("connection", (ws) => {
    console.log("Client connected");
    let dgConnection = null;
    let settingsApplied = false;
    let audioBuffer = Buffer.alloc(0);

    ws.on("message", async (message, isBinary) => {
      // Binary = mic audio → forward straight to Deepgram
      if (isBinary) {
        if (dgConnection && settingsApplied) {
          dgConnection.sendMedia(message);
        }
        return;
      }
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch {
        return; // not valid JSON, ignore
      }

      if (parsedMessage.type === "sessionId") {
        const sessionId = parsedMessage.sessionId;
        console.log("Received sessionId:", sessionId);
        const promptDoc = await InterviewPrompts.findById(sessionId);
        const systemPrompt =
          promptDoc?.system_prompt || "You are a friendly AI assistant.";

        dgConnection = await deepgram.agent.v1.connect();
        dgConnection.on("open", () => {
          console.log("Deepgram connection opened");
        });
        let keepAliveInterval = null;
        function clearKeepAlive() {
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
        }
        dgConnection.on("message", async (data) => {
          if (data.type === "Welcome") {
            console.log("Welcome from Deepgram, sending Settings...");
            dgConnection.sendSettings({
              type: "Settings",
              audio: {
                input: { encoding: "linear16", sample_rate: 24000 },
                output: {
                  encoding: "linear16",
                  sample_rate: 16000,
                  container: "none",
                },
              },
              agent: {
                language: "en",
                listen: { provider: { type: "deepgram", model: "nova-3" } },
                think: {
                  provider: { type: "open_ai", model: "gpt-4o-mini" },
                  prompt: systemPrompt,
                },
                speak: {
                  provider: { type: "deepgram", model: "aura-2-thalia-en" },
                },

                greeting: "Hi, let's get started with your interview.",
              },
            });
            keepAliveInterval = setInterval(() => {
              if (dgConnection?.isOpen?.() ?? true) {
                dgConnection.sendKeepAlive({ type: "KeepAlive" });
              } else {
                clearKeepAlive();
              }
            }, 8000);
          }
          if (data.type === "Error" || data.type === "Warning") {
            console.error(
              "🔴 Deepgram",
              data.type,
              "-",
              data.code,
              "-",
              data.description,
            );
          }
          if (data.type === "SettingsApplied") {
            console.log("Deepgram agent configured, ready to stream audio");
            settingsApplied = true;
          }
          if (data.type === "ConversationText") {
            // log transcript
            console.log(data);
            ws.send(JSON.stringify({ type: "transcript", data }));
          }

          if (data.type === "UserStartedSpeaking") {
            audioBuffer = Buffer.alloc(0); // barge-in: clear queued agent audio
          }
          if (typeof Blob !== "undefined" && data instanceof Blob) {
            const chunk = Buffer.from(await data.arrayBuffer());
            const wavHeader = createWavHeader(chunk.length, 16000);
            const wavChunk = Buffer.concat([wavHeader, chunk]);
            ws.send(wavChunk); // send straight through to browser for playback
          }
        });

        dgConnection.on(
          "error",
          (err) => console.error("Deepgram error:", err),
          clearKeepAlive(),
        );
        dgConnection.on(
          "close",
          () => console.log("Deepgram connection closed"),
          clearKeepAlive(),
        );
        dgConnection.connect(); // <-- actually opens the socket
        await dgConnection.waitForOpen();
      }
    });
    ws.on("close", () => {
      dgConnection?.close();
      console.log("Client disconnected");
    });
  });
};
