const { GoogleGenerativeAI } = require("@google/generative-ai"); // Fixed: Wrong package name
const fs = require("fs");
const { existsSync, mkdirSync } = require("fs");

if (!existsSync("uploads")) {
  mkdirSync("uploads");
}

// Initialize with correct package
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateContent = async (req, res) => {
  const { specialization, qualification } = req.body;

  if (!specialization || !qualification) {
    return res.status(400).json({ error: "Specialization and qualification are required" });
  }

  const prompt = `Based on specialization in ${specialization} and highest qualification being ${qualification}, generate a JSON object with two arrays: softSkills and techSkills.

CRITICAL: Return ONLY raw JSON without markdown code blocks, backticks, or any other text. The response must start with { and end with }.

Example format:{"softSkills":["skill1","skill2"],"techSkills":["skill1","skill2"]}`;

  try {
    // Fixed: Correct API usage
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    const parsedData = JSON.parse(text);

    res.json({
      success: true,
      softSkills: parsedData.softSkills,
      techSkills: parsedData.techSkills,
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.parseCVController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded",
      });
    }

    // Read the PDF file
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64File = fileBuffer.toString("base64");

    // Delete uploaded file
    fs.unlinkSync(req.file.path);

    // Initialize Gemini model - Fixed
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Analyze this CV/resume PDF and extract the following information. Return ONLY a valid JSON object without any markdown formatting, code blocks, or additional text.

Extract:
- gender: Infer from name or pronouns (male/female/other)
- fullName: Complete name
- dob: Date of birth in YYYY-MM-DD format or null
- qualification: One of: "high_school", "college", "bachelors", "masters", "phd"
- specialization: Field of study
- softSkills: Array of soft skills
- techSkills: Array of technical skills

Return ONLY this JSON structure:
{
  "gender": "string",
  "fullName": "string",
  "dob": "YYYY-MM-DD or null",
  "qualification": "string",
  "specialization": "string",
  "softSkills": ["skill1", "skill2"],
  "techSkills": ["skill1", "skill2"]
}

IMPORTANT: Response must be valid JSON starting with { and ending with }.`;

    // Generate content with PDF - Fixed
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64File,
          mimeType: "application/pdf",
        },
      },
    ]);

    const response = await result.response;
    let text = response.text().trim();
    console.log("Raw response:", text); // Debug log

    if (text.includes("```")) {
      const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        text = jsonMatch[1].trim();
      }
    }

    console.log("Cleaned response:", text); // Debug log

    const parsedCV = JSON.parse(text);

    if (!parsedCV.fullName) {
      return res.status(400).json({
        success: false,
        error: "Could not extract name from CV",
      });
    }

    res.json({
      success: true,
      data: parsedCV,
    });
  } catch (error) {
    console.error("CV Parsing Error:", error);

    // Clean up file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to parse CV",
    });
  }
};

exports.generateCompleteTestWithProgress = async (req, res) => {
  const { specialization, qualification, skill, level } = req.query;

  if (!skill || !level) {
    return res.status(400).json({ error: "Skill and level are required" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering

  // Helper function to send progress updates
  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const totalQuestionsByLevel = {
    Beginner: 10,
    Intermediate: 15,
    Advanced: 20,
    Expert: 30,
    Specialist: 40,
  };

  const totalQuestions = totalQuestionsByLevel[level];
  const questionsPerBatch = 20;
  const totalBatches = Math.ceil(totalQuestions / questionsPerBatch);

  try {
    let allQuestions = [];
    let allBatchMetadata = [];

    // Send initial status
    sendProgress({
      type: "started",
      message: "Starting test generation...",
      totalBatches,
      totalQuestions,
    });

    // Internal loop to generate all batches
    for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
      const questionsGenerated = allBatchMetadata.reduce(
        (sum, b) => sum + (b.questions_count || 0),
        0
      );
      const questionsToGenerate = Math.min(
        questionsPerBatch,
        totalQuestions - questionsGenerated
      );

      // Send batch start progress
      sendProgress({
        type: "batch_start",
        batch: batchNum,
        totalBatches,
        message: `Generating batch ${batchNum} of ${totalBatches}...`,
        questionsInBatch: questionsToGenerate,
        progress: Math.round(((batchNum - 1) / totalBatches) * 100),
      });

      // Build cumulative context from ALL previous batches
      let cumulativeContext = "";
      if (allBatchMetadata.length > 0) {
        const allPreviousQuestions = allBatchMetadata.flatMap(
          (batch) => batch.questions_summary || []
        );

        const cumulativeStats = allBatchMetadata.reduce(
          (acc, batch) => ({
            easy: acc.easy + (batch.difficulty_counts?.easy || 0),
            medium: acc.medium + (batch.difficulty_counts?.medium || 0),
            hard: acc.hard + (batch.difficulty_counts?.hard || 0),
            mcq: acc.mcq + (batch.type_counts?.mcq || 0),
            text: acc.text + (batch.type_counts?.text || 0),
            total_marks: acc.total_marks + (batch.total_marks || 0),
            total_questions: acc.total_questions + (batch.questions_count || 0),
          }),
          {
            easy: 0,
            medium: 0,
            hard: 0,
            mcq: 0,
            text: 0,
            total_marks: 0,
            total_questions: 0,
          }
        );

        cumulativeContext = `
CRITICAL: DO NOT REPEAT ANY OF THE FOLLOWING ${
          allPreviousQuestions.length
        } QUESTIONS ALREADY GENERATED:
${allPreviousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

CUMULATIVE STATISTICS FROM ${allBatchMetadata.length} PREVIOUS BATCH(ES):
- Total questions generated so far: ${cumulativeStats.total_questions}
- Easy questions: ${cumulativeStats.easy}
- Medium questions: ${cumulativeStats.medium}
- Hard questions: ${cumulativeStats.hard}
- MCQ questions: ${cumulativeStats.mcq}
- Text questions: ${cumulativeStats.text}
- Total marks so far: ${cumulativeStats.total_marks}

You must create COMPLETELY DIFFERENT questions covering OTHER aspects of ${skill}. 
Ensure maximum variety in topics, scenarios, and problem types.
DO NOT create similar variations of previous questions.
`;
  }
      const prompt = `
specialization: ${specialization ? specialization : ""},
qualification: ${qualification ? qualification : ""},
skill: ${skill},
level: ${level},

${cumulativeContext}

CRITICAL: Return ONLY raw JSON without markdown code blocks, backticks, or any other text. The response must start with { and end with }.

Generate EXACTLY ${questionsToGenerate} NEW questions for Batch ${batchNum}.

Question Distribution Guidelines:
- Beginner: 10 total (2 text, 8 mcq)
- Intermediate: 15 total (3 text, 12 mcq)
- Advanced: 20 total (4 text, 16 mcq)
- Expert: 30 total (6 text, 24 mcq) - Split across 2 batches
- Specialist: 40 total (8 text, 32 mcq) - Split across 2 batches

Difficulty Distribution by Level:
- Beginner: 8 easy mcq, 2 medium text
- Intermediate: 12 medium mcq, 3 medium text
- Advanced: 10 medium mcq, 6 hard mcq, 2 medium text, 2 hard text
- Expert: 10 medium mcq, 14 hard mcq, 3 medium text, 3 hard text
- Specialist: 12 medium mcq, 20 hard mcq, 3 medium text, 5 hard text

Points System:
- MCQ easy: 1 point
- MCQ medium: 1 point
- MCQ hard: 2 points
- Text medium: 5 points
- Text hard: 10 points

TEXT QUESTION WORD COUNT LIMITS (for expected answers):
- Easy text: 100-200 words maximum
- Medium text: 250-400 words maximum
- Hard text: 500-700 words maximum

CRITICAL TEXT QUESTION GUIDELINES:
1. DO NOT create questions requiring code snippets, large code blocks, or programming solutions as answers
2. Focus on conceptual explanations, theoretical understanding, problem-solving approaches, and real-world scenarios
3. Questions must test understanding through written explanations, not code implementation
4. Suitable text question types:
   - Explain a concept or methodology in your own words
   - Describe the pros and cons of an approach
   - Analyze a real-world scenario and suggest solutions
   - Compare and contrast different techniques or methodologies
   - Explain how you would approach a specific problem (strategy, not code)
   - Describe best practices and justify your reasoning
   - Evaluate a given situation and provide recommendations
5. AVOID text questions that ask to:
   - Write complete code solutions
   - Provide code examples or implementations
   - Debug or fix code blocks
   - Create functions or classes
6. Ensure variety in question types and topics - avoid repetition with previous batches

MCQ MUST INCLUDE CORRECT ANSWER:
- Each MCQ must have "correct_answer" field containing the option_id of the correct answer
- This allows local calculation of MCQ scores without API calls

Return format:
{
  "questions": [
    {
      "question_details": {
        "question_sn": ${questionsGenerated + 1},
        "question": "What is the primary benefit of using indexes in databases?",
        "type": "mcq",
        "options": [
          { "option": "Faster query performance", "option_id": 1 },
          { "option": "Reduced storage space", "option_id": 2 },
          { "option": "Better security", "option_id": 3 },
          { "option": "Automatic backups", "option_id": 4 }
        ],
        "correct_answer": 1,
        "difficulty": "easy",
        "points": 1
      }
    },
    {
      "question_details": {
        "question_sn": ${questionsGenerated + 2},
        "question": "Explain the key considerations when designing a scalable system architecture. Discuss at least three important factors and justify why they matter in real-world applications.",
        "type": "text",
        "difficulty": "hard",
        "points": 10,
        "max_words": 700,
        "evaluation_rubric": {
          "criteria": [
            { "criterion": "Identifies at least 3 key scalability factors", "weight": 30 },
            { "criterion": "Provides clear justification for each factor", "weight": 30 },
            { "criterion": "Includes real-world application examples", "weight": 25 },
            { "criterion": "Technical accuracy and depth of understanding", "weight": 15 }
          ]
        }
      }
    }
  ],
  "batch_metadata": {
    "questions_summary": ["Question 1 text only", "Question 2 text only", ...],
    "questions_count": ${questionsToGenerate},
    "difficulty_counts": { "easy": <count>, "medium": <count>, "hard": <count> },
    "type_counts": { "mcq": <count>, "text": <count> },
    "total_marks": <sum of points in this batch>
  }
}`;

      // Call Gemini API for this batch
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      const response = await result.response;

      let text = response.text().trim();

      // COMPLETE REGEX - Remove ALL markdown code block variations
      // Remove ```
      text = text.replace(/^```json\s*/i, "");
      // Remove ```
      text = text.replace(/^```javascript\s*/i, "");
      // Remove generic ```
      text = text.replace(/^```\s*/, "");
      // Remove ```
      text = text.replace(/\s*```\s*$/g, "");
      // Remove any remaining backticks at start or end
      text = text.replace(/^`+|`+$/g, "");
      // Trim whitespace
      text = text.trim();

      console.log("Cleaned text length:", text.length);
      console.log("First 100 chars:", text.substring(0, 100));

      let batchData;
      try {
        batchData = JSON.parse(text);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Failed text:", text);
        throw new Error(`Failed to parse JSON: ${parseError.message}`);
      }

      // Add this batch's questions to the complete set
      allQuestions = [...allQuestions, ...batchData.questions];

      // Add this batch's metadata to cumulative array for next iteration
      allBatchMetadata.push(batchData.batch_metadata);

      // Send batch completion progress
      sendProgress({
        type: "batch_complete",
        batch: batchNum,
        totalBatches,
        questionsGenerated: allQuestions.length,
        totalQuestions,
        message: `Batch ${batchNum} complete: ${batchData.questions.length} questions generated`,
        progress: Math.round((batchNum / totalBatches) * 100),
      });

      console.log(
        `Batch ${batchNum} complete: ${batchData.questions.length} questions generated`
      );

      // Small delay between batches to avoid rate limiting
      if (batchNum < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Calculate final cumulative statistics
    const finalStats = allBatchMetadata.reduce(
      (acc, batch) => ({
        easy: acc.easy + (batch.difficulty_counts?.easy || 0),
        medium: acc.medium + (batch.difficulty_counts?.medium || 0),
        hard: acc.hard + (batch.difficulty_counts?.hard || 0),
        mcq: acc.mcq + (batch.type_counts?.mcq || 0),
        text: acc.text + (batch.type_counts?.text || 0),
        total_marks: acc.total_marks + (batch.total_marks || 0),
      }),
      { easy: 0, medium: 0, hard: 0, mcq: 0, text: 0, total_marks: 0 }
    );

    // Generate unique test ID
    const testId = `test_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Send final completion with complete data
    sendProgress({
      type: "complete",
      message: "Test generation complete!",
      progress: 100,
      data: {
        test_id: testId,
        level,
        skill,
        specialization,
        qualification,
        total_questions: allQuestions.length,
        total_batches: totalBatches,
        questions: allQuestions,
        statistics: {
          ...finalStats,
          total_questions: allQuestions.length,
        },
        generated_at: new Date().toISOString(),
      },
    });

    // Close the SSE connection
    res.end();
  } catch (error) {
    console.error("Test Generation Error:", error);
    console.error("Error stack:", error.stack);

    sendProgress({
      type: "error",
      message: error.message,
      error: error.toString(),
      details: error.stack,
    });

    res.end();
  }
};

exports.evaluateTextAnswers = async (req, res) => {
  const { text_responses, user_id, test_id } = req.body;

  // Validate input
  if (
    !text_responses ||
    !Array.isArray(text_responses) ||
    text_responses.length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: "text_responses array is required and cannot be empty",
    });
  }

  try {
    // Process all text responses in parallel for better performance
    const evaluationPromises = text_responses.map(async (response) => {
      const {
        question_sn,
        question,
        answer,
        points: max_points,
        difficulty,
        evaluation_rubric,
        max_words,
      } = response;

      // Parse answer if it's stringified
      const userAnswer =
        typeof answer === "string" ? JSON.parse(answer) : answer;

      // Check for empty or very short answers
      const wordCount = userAnswer.trim().split(/\s+/).length;
      if (wordCount < 10) {
        return {
          question_sn,
          total_score: 0,
          max_score: max_points,
          word_count: wordCount,
          criterion_scores: evaluation_rubric.criteria.map((criterion) => ({
            criterion: criterion.criterion,
            score: 0,
            max_score: Math.round((max_points * criterion.weight) / 100),
            feedback: "Answer is too short or empty.",
          })),
          overall_feedback:
            "Answer is insufficient. Please provide a detailed explanation.",
          strengths: [],
          improvements: [
            "Provide a more comprehensive answer",
            "Address all aspects of the question",
          ],
        };
      }

      // Create evaluation prompt
      const prompt = `You are an expert evaluator for ${difficulty} level questions.

QUESTION:
${question}

STUDENT'S ANSWER:
${userAnswer}

EVALUATION CRITERIA:
${evaluation_rubric.criteria
  .map(
    (c, i) =>
      `${i + 1}. ${c.criterion} (Weight: ${c.weight}%, Max Points: ${Math.round(
        (max_points * c.weight) / 100
      )})`
  )
  .join("\n")}

MAXIMUM POINTS: ${max_points}
EXPECTED WORD COUNT: ${max_words || "Not specified"}
ACTUAL WORD COUNT: ${wordCount}

INSTRUCTIONS:
1. Evaluate the answer based strictly on the provided criteria
2. Assign points for each criterion proportional to its weight
3. Be fair but maintain academic standards
4. Provide specific, constructive feedback
5. Identify concrete strengths and areas for improvement
6. Consider the word count and depth of explanation
7. **IMPORTANT: Return ALL scores as INTEGERS (whole numbers) - NO DECIMALS**

SCORING GUIDELINES:
- Excellent (90-100% of criterion points): Comprehensive, accurate, well-explained
- Good (70-89% of criterion points): Correct with minor gaps
- Satisfactory (50-69% of criterion points): Basic understanding but incomplete
- Poor (0-49% of criterion points): Significant gaps or inaccuracies

Return ONLY a JSON object in this exact format (no markdown, no code blocks):
{
  "total_score": <INTEGER between 0 and ${max_points}>,
  "criterion_scores": [
    {
      "criterion": "<criterion name>",
      "score": <INTEGER points earned>,
      "max_score": <INTEGER max points for this criterion>,
      "feedback": "<specific feedback explaining the score>"
    }
  ],
  "overall_feedback": "<2-3 sentences of constructive feedback>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": ["<specific improvement 1>", "<specific improvement 2>"]
}`;

      // Call Gemini API
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();

      // COMPLETE REGEX - Remove ALL markdown code block variations
      // Remove ```
      text = text.replace(/^```json\s*/i, "");
      // Remove ```
      text = text.replace(/^```javascript\s*/i, "");
      // Remove generic ```
      text = text.replace(/^```\s*/, "");
      // Remove ```
      text = text.replace(/\s*```\s*$/g, "");
      // Remove any remaining backticks at start or end
      text = text.replace(/^`+|`+$/g, "");
      // Trim whitespace
      text = text.trim();

      let evaluation;
      try {
        evaluation = JSON.parse(text);

        // **FORCE ALL SCORES TO BE INTEGERS** (in case AI returns decimals)
        evaluation.total_score = Math.round(evaluation.total_score);
        evaluation.criterion_scores = evaluation.criterion_scores.map(
          (criterion) => ({
            ...criterion,
            score: Math.round(criterion.score),
            max_score: Math.round(criterion.max_score),
          })
        );
      } catch (parseError) {
        console.error(
          "JSON Parse Error for question",
          question_sn,
          ":",
          parseError
        );
        console.error("Failed text:", text);
        throw new Error(
          `Failed to parse AI response for question ${question_sn}`
        );
      }

      return {
        question_sn,
        max_score: max_points,
        word_count: wordCount,
        ...evaluation,
      };
    });

    // Wait for all evaluations to complete
    const evaluations = await Promise.all(evaluationPromises);

    // Calculate total text score (as INTEGER)
    const totalTextScore = Math.round(
      evaluations.reduce((sum, ev) => sum + (ev.total_score || 0), 0)
    );
    
    const totalMaxScore = evaluations.reduce(
      (sum, ev) => sum + ev.max_score,
      0
    );
    
    // Calculate percentage as INTEGER
    const percentage =
      totalMaxScore > 0
        ? Math.round((totalTextScore / totalMaxScore) * 100)
        : 0;

    // Prepare response (ALL INTEGERS)
    const responseData = {
      success: true,
      user_id: user_id || null,
      test_id: test_id || null,
      evaluation_summary: {
        total_text_score: totalTextScore,      // INTEGER
        total_max_score: totalMaxScore,         // INTEGER
        percentage: percentage,                 // INTEGER
        questions_evaluated: evaluations.length,
      },
      evaluations: evaluations,
      evaluated_at: new Date().toISOString(),
    };

    res.json(responseData);
    
  } catch (error) {
    console.error("Text Evaluation Error:", error);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      success: false,
      error: error.message,
      details: "Failed to evaluate text answers",
    });
  }
};




