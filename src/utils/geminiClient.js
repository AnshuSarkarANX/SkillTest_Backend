const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require("crypto");

// ─── OWN API KEYS CONFIG ───────────────────────────────────────────────────
const OWN_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean);

const STICKY_DURATION_MS = 10 * 60 * 60 * 1000; // 10 hours

// In-memory state — persists for the lifetime of the Node process
const keyState = {
  stickyIndex: 0, // which key is currently "preferred"
  stickySetAt: null, // when it was last set
  failedKeys: new Set(), // keys that errored in this cycle
};
const UserApiKey = require("../models/UserApiKey");

const ApiKeyState = require("../models/ApiKeyState");

async function getActiveOwnKey() {
  let state = await ApiKeyState.findById("singleton");
  if (!state) {
    state = await ApiKeyState.create({ _id: "singleton" });
  }

  const now = Date.now();
  // Reset if sticky expired
  if (
    state.stickySetAt &&
    now - new Date(state.stickySetAt).getTime() > STICKY_DURATION_MS
  ) {
    state.stickyIndex = 0;
    state.stickySetAt = null;
    await state.save();
  }

  return { key: OWN_KEYS[state.stickyIndex], index: state.stickyIndex };
}

async function promoteNextKey(failedIndex) {
  let state = await ApiKeyState.findById("singleton");
  for (let i = 0; i < OWN_KEYS.length; i++) {
    if (i !== failedIndex) {
      state.stickyIndex = i;
      state.stickySetAt = new Date();
      await state.save();
      return true;
    }
  }
  return false;
}

// ─── USER KEY ENCRYPTION ───────────────────────────────────────────────────
// Store user keys encrypted in memory, keyed by userId
// Uses AES-256-GCM with a server-side encryption key from env
const userKeyStore = new Map(); // userId → { encryptedKey, iv, authTag }

const ENCRYPTION_KEY = Buffer.from(
  process.env.USER_KEY_ENCRYPTION_SECRET ||
    crypto.randomBytes(32).toString("hex"),
  "hex",
).slice(0, 32);

function encryptKey(plainText) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedKey: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decryptKey({ encryptedKey, iv, authTag }) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    ENCRYPTION_KEY,
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// Call this when the user provides their key (e.g. from a settings endpoint)


async function storeUserApiKey(userId, apiKey) {
  const encrypted = encryptKey(apiKey); // same AES-256-GCM function from before
  await UserApiKey.findOneAndUpdate(
    { userId },
    { ...encrypted, updatedAt: new Date() },
    { upsert: true },
  );
}

async function getUserApiKey(userId) {
  const stored = await UserApiKey.findOne({ userId });
  if (!stored) return null;
  return decryptKey(stored);
}

async function removeUserApiKey(userId) {
  await UserApiKey.deleteOne({ userId });
}

// ─── CORE CALL FUNCTION ────────────────────────────────────────────────────
/**
 * @param {string} prompt - The prompt to send
 * @param {object} options
 * @param {string} [options.userId]     - If provided, uses the user's own key
 * @param {string} [options.model]      - Defaults to "gemini-2.5-flash"
 */
async function callGemini(prompt,userId = null) {
   const model = "gemini-2.5-flash" 

  // ── MODE 1: User's own API key ──
  if (userId) {
    const userKey = getUserApiKey(userId);
    if (!userKey) {
      throw new Error(
        "No API key found for this user. Please provide your Gemini API key.",
      );
    }
    const genAI = new GoogleGenerativeAI(userKey);
    const geminiModel = genAI.getGenerativeModel({ model });
    try {
      const result = await geminiModel.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      // Don't retry with other keys — it's their key, their problem
      throw new Error(`Your API key failed: ${error.message}`);
    }
  }

  // ── MODE 2: Own keys with failover ──
  let lastError;

  for (let attempt = 0; attempt < OWN_KEYS.length; attempt++) {
    const { key, index } = getActiveOwnKey();

    if (!key) {
      throw new Error("No Gemini API keys configured on the server.");
    }

    try {
      const genAI = new GoogleGenerativeAI(key);
      const geminiModel = genAI.getGenerativeModel({ model });
      const result = await geminiModel.generateContent(prompt);

      // ✅ Success — lock this key as sticky if not already set
      if (!keyState.stickySetAt) {
        keyState.stickyIndex = index;
        keyState.stickySetAt = Date.now();
        console.log(`[GeminiClient] Sticky key set to index ${index}`);
      }

      return result.response.text().trim();
    } catch (error) {
      lastError = error;
      console.warn(
        `[GeminiClient] Key index ${index} failed: ${error.message}`,
      );
      markKeyFailed(index);

      const hasNext = promoteNextKey(index);
      if (!hasNext) {
        console.error("[GeminiClient] All API keys exhausted.");
        break;
      }
    }
  }

  throw new Error(
    `All Gemini API keys failed. Last error: ${lastError?.message}`,
  );
}

module.exports = {
  callGemini,
  storeUserApiKey,
  getUserApiKey,
  removeUserApiKey,
};
