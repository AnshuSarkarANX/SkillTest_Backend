const TestMetrics = require("../models/TestMetrics");
const TestResult = require("../models/TestResult");

exports.saveResult = async (req, res) => {
  try {
    const userId = req.user.userId;
    const testResult = req.body;

    // Save full result with TTL
    const savedResult = await TestResult.create({
      userId,
      fullResult: testResult,
    });

    // Save permanent metrics
    const metrics = await TestMetrics.create({
      userId,
      testResultId: savedResult._id,
      skill: testResult.skill,
      level: testResult.level,
      totalScore: testResult.total_score,
      totalPossible: testResult.total_possible,
      overallPercentage: testResult.overall_percentage,
      mcqEarned: testResult.mcq_results?.total_earned ?? 0,
      mcqTotal: testResult.mcq_results?.total_possible ?? 0,
      textEarned:
        testResult.text_results?.evaluation_summary?.total_text_score ?? 0,
      textTotal:
        testResult.text_results?.evaluation_summary?.total_max_score ?? 0,
    });

    res.json({
      success: true,
      metricsId: metrics._id,
      testResultId: savedResult._id,
    });
  } catch (error) {
    console.error("Save result error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getResult = async (req, res) => {
  try {
    const { testResultId } = req.params;
    const userId = req.user.userId;

    const result = await TestResult.findOne({
      _id: testResultId,
      userId, // ensure user can only access their own results
    });

    if (!result) {
      return res.status(404).json({ error: "Result not found or has expired" });
    }

    res.json({ success: true, result: result.fullResult });
  } catch (error) {
    console.error("Get result error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    const metrics = await TestMetrics.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Check which full results still exist
    const resultIds = metrics
      .filter((m) => m.testResultId)
      .map((m) => m.testResultId);

    const existingResults = await TestResult.find(
      { _id: { $in: resultIds } },
      { _id: 1 },
    ).lean();

    const existingSet = new Set(existingResults.map((r) => r._id.toString()));

    const history = metrics.map((m) => ({
      ...m,
      hasDetailedResult: m.testResultId
        ? existingSet.has(m.testResultId.toString())
        : false,
    }));

    res.json({ success: true, history });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: error.message });
  }
};
