// routes/userKeyRoutes.js
const { storeUserApiKey, removeUserApiKey } = require("../utils/geminiClient");

router.post("/set-api-key", authMiddleware, (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

  storeUserApiKey(req.user.id, apiKey);
  res.json({ success: true, message: "API key stored securely" });
});

router.delete("/remove-api-key", authMiddleware, (req, res) => {
  removeUserApiKey(req.user.id);
  res.json({ success: true });
});
