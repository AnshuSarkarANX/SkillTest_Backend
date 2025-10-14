const express = require("express")
const router = express.Router()
const upload = require("../config/multer.js")
const aiController = require("../controllers/AiController.js")

router.post("/generate-skills", aiController.generateContent);
router.post("/parse-cv", upload.single("cv"), aiController.parseCVController);

module.exports = router