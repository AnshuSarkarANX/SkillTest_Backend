const express = require("express")
const router = express.Router()
const upload = require("../config/multer.js")
const aiController = require("../controllers/AiController.js");
const authMiddleware = require("../middleware/authMiddleware.js");

router.post("/generate-skills",authMiddleware, aiController.generateContent);
router.post("/parse-cv", upload.single("cv"), aiController.parseCVController);
router.get(
  "/generate-questions",authMiddleware,
  aiController.generateCompleteTestWithProgress
);
router.post("/evaluate-text-answers", aiController.evaluateTextAnswers);

module.exports = router