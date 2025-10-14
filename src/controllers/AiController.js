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
