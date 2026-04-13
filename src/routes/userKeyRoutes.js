// routes/userKeyRoutes.js
const {
  storeUserApiKey,
  removeUserApiKey,
  getUserApiKey,
} = require("../utils/geminiClient");

router.get("/get-api-key", authMiddleware, async (req, res) => {
  try {
    const key = await getUserApiKey(req.user.id);
    if (!key) return res.status(404).json({ error: "No API key found" });
    res.json({ success: true, key });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve API key" });
  }
});

router.post("/set-api-key", authMiddleware, async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

  try {
    await storeUserApiKey(req.user.id, apiKey);
    res.json({ success: true, message: "API key stored securely" });
  } catch (err) {
    res.status(500).json({ error: "Failed to store API key" });
  }
});

router.delete("/remove-api-key", authMiddleware, async (req, res) => {
  try {
    await removeUserApiKey(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove API key" });
  }
});
