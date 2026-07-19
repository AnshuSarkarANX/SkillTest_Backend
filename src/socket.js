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
   let endingInterview = false;
   let deliberateClose = false; // true only when WE intentionally close Deepgram
   let settingsApplied = false;
   let audioBuffer = Buffer.alloc(0);
   let keepAliveInterval = null;
   let dgReconnectAttempts = 0;
   let audioBufferQueue = [];
   let currentSessionId = null;
   let currentSystemPrompt = null;

    function clearKeepAlive() {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }
   async function connectToDeepgram(sessionId, systemPrompt,agentConvo = []) { 
    connection = await deepgram.agent.v1.connect();
    connection.on("open", () => {
      console.log("Deepgram connection opened");
      dgReady = true;
      dgReconnectAttempts = 0;
    });

    connection.on("message", async (data) => {
          if (data.type === "Welcome") {
            console.log("Welcome from Deepgram, sending Settings...");
            connection.sendSettings({
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
              if (dgReady) {
                connection.sendKeepAlive({ type: "KeepAlive" });
              } else {
                clearKeepAlive();
              }
            }, 8000);
          }
          if (data.type === "Error" || data.type === "Warning") {
            console.log(
              "🔴 Deepgram",
              data.type,
              "-",
              data.code,
              "-",
              data.description,
            );
            clearKeepAlive();
          }
          if (data.type === "SettingsApplied") {
            console.log("Deepgram agent configured, ready to stream audio");
            settingsApplied = true;
            while (audioBufferQueue.length > 0) {
              connection.sendMedia(audioBufferQueue.shift());
            }
            if(agentConvo.length > 0){
              connection.sendUpdatePrompt({type: "UpdatePrompt", prompt: `${agentConvo.join("\n")}`});
              console.log("conversation prev-", agentConvo.join("\n"));
            }
             
          }
          if (data.type === "PromptUpdated") {
            console.log(
              "Prompt updated successfully — new prompt is now active.",
            );
          }
          if (data.type === "ConversationText") {
            // log transcript
            console.log(data);
            ws.send(JSON.stringify({ type: "transcript", data }));
          }
          if (data.type === "InjectionRefused") {
            console.warn("Injection refused, retrying...");
            // Optionally retry after a short delay
            setTimeout(() => {
              connection?.sendInjectAgentMessage({
                type: "InjectAgentMessage",
                message: "Closing the interview now",
                behavior: "queue",
              });
            }, 500);
          }

          if (data.type === "AgentAudioDone" && endingInterview) {
            ws.send(JSON.stringify({ type: "closeSocket" }));
            // connection.close();
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


        connection.on("close", () => {
          console.log("Deepgram connection closed"); 
          dgReady = false;
          settingsApplied = false;
          clearKeepAlive();
           if (!deliberateClose && ws.readyState === ws.OPEN) {
             attemptDeepgramReconnect();
           }

        });

        connection.on("error", (err) => {
          console.error("Deepgram error:", err);
        });
        connection.connect(); // <-- actually opens the socket
        await connection.waitForOpen();

        return connection;
   }

    function attemptDeepgramReconnect() {
if (dgReconnectAttempts >= 5) {
  console.error("Max Deepgram reconnect attempts reached");
  ws.send(
    JSON.stringify({
      type: "fatal_error",
      message: "Could not reconnect to voice agent",
    }),
  );
  return;

  
}

const delay = Math.min(10000, 1000 * 2 ** dgReconnectAttempts);
dgReconnectAttempts += 1;
console.log(
  `Reconnecting to Deepgram in ${delay}ms (attempt ${dgReconnectAttempts})`,
);
 setTimeout(async () => {
   try {
     dgConnection = await connectToDeepgram(
       currentSessionId,
       currentSystemPrompt,
     );
   } catch (err) {
     console.error("Reconnect attempt failed:", err);
     attemptDeepgramReconnect(); // try again
   }
 }, delay);

    }
    ws.on("message", async (message, isBinary) => {
      // Binary = mic audio → forward straight to Deepgram
      if (isBinary) {
        if (dgConnection && settingsApplied) {
          dgConnection.sendMedia(message);
        } else {
          audioBufferQueue.push(message); // buffer until reconnected
          if (audioBufferQueue.length > 200) audioBufferQueue.shift(); // cap memory
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
        
        const promptDoc = await InterviewPrompts.findById(sessionId);
        const systemPrompt =
          promptDoc?.system_prompt || "You are a friendly AI assistant.";
          currentSessionId = sessionId;
          currentSystemPrompt = systemPrompt;
         let agentConvo = parsedMessage?.conversations

        dgConnection = await connectToDeepgram(
          sessionId,
          systemPrompt,
          agentConvo,
        );
      }
      if (parsedMessage.type === "END_INTERVIEW") {
        endingInterview = true;
        dgConnection?.sendInjectAgentMessage({
          type: "InjectAgentMessage",
          message: "Closing the interview now",
          behavior: "queue",
        });
      }
    });
    ws.on("close", () => {
      deliberateClose = true; 
      clearKeepAlive();
      dgConnection?.close();
      console.log("Client disconnected");
    });
  });
};
