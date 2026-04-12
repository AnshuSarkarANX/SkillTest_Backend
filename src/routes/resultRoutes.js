const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const resultController = require("../controllers/resultController");

router.post("/save", authMiddleware, resultController.saveResult);
router.get("/history", authMiddleware, resultController.getHistory);
router.get("/:testResultId", authMiddleware, resultController.getResult);

module.exports = router;
