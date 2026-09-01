import { Router, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

const router = Router();

// Validate API Key at startup
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("❌ CRITICAL: No Gemini API Key found in environment variables!");
} else {
  console.log("✅ Gemini API Key is loaded.");
}

// Initialize Google Gen AI Client using the modern @google/genai SDK
const ai = new GoogleGenAI({ apiKey });

const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Safely extracts and parses JSON content even if wrapped in markdown code fences
 */
function parseGeminiJson(rawText: string) {
  try {
    const cleaned = rawText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
      
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Failed to parse JSON string:", rawText);
    throw new Error("Gemini returned invalid JSON structure.");
  }
}

/**
 * Executes a generation request using Gemini
 */
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  responseFormatJson = true
): Promise<string> {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: responseFormatJson ? "application/json" : "text/plain",
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response.");
  }

  return response.text;
}

/**
 * Route: POST / (Mounted under /api/lesson-plans)
 * Generates an entire structured course
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { topic, depth = "intermediate", durationDays = 5 } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    // Step 1: Generate Course Outline
    const outlineSystemPrompt = `You are an expert curriculum designer. Return JSON matching the requested schema.`;
    const outlineUserPrompt = `Create a high-level ${durationDays}-day course outline for: "${topic}".
Format output strictly as JSON:
{
  "title": "Course Title",
  "description": "Short description",
  "days": [
    { "dayNumber": 1, "topic": "Day 1 Topic Summary" }
  ]
}`;

    const rawOutline = await callGemini(outlineSystemPrompt, outlineUserPrompt, true);
    const outlineData = parseGeminiJson(rawOutline);

    if (!outlineData.days || !Array.isArray(outlineData.days)) {
      throw new Error("Invalid course outline generated: missing 'days' array.");
    }

    // Step 2: Generate Content for All Days in Parallel (Speeds up response drastically)
    const dayPromises = outlineData.days.map(async (day: { dayNumber: number; topic: string }) => {
      const daySystemPrompt = `You are a master instructor crafting comprehensive educational modules. Write in detailed JSON.`;
      const dayUserPrompt = `Create lesson details for Day ${day.dayNumber}: "${day.topic}" for the course "${topic}".
Target Depth Level: ${depth}.

Format output strictly as JSON:
{
  "dayNumber": ${day.dayNumber},
  "title": "${day.topic}",
  "content": "Detailed text content and explanation of concepts...",
  "keyTakeaways": ["Point 1", "Point 2"],
  "quiz": [
    {
      "question": "Sample Question",
      "options": ["A", "B", "C", "D"],
      "answer": "A"
    }
  ]
}`;

      const rawDayContent = await callGemini(daySystemPrompt, dayUserPrompt, true);
      return parseGeminiJson(rawDayContent);
    });

    const generatedDays = await Promise.all(dayPromises);

    // Sort days to ensure strictly ascending chronological order
    generatedDays.sort((a, b) => a.dayNumber - b.dayNumber);

    // Step 3: Combine and Respond
    const fullCoursePlan = {
      title: outlineData.title,
      description: outlineData.description,
      depth,
      totalDays: durationDays,
      days: generatedDays,
    };

    return res.status(200).json({
      success: true,
      data: fullCoursePlan,
    });
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    return res.status(500).json({
      error: "Failed to generate lesson plan",
      details: error.message || "An unexpected error occurred",
    });
  }
});

export default router;