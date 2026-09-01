import { Router, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

const router = Router();

// Initialize Google Gen AI Client using the modern @google/genai SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
});

// gemini-2.5-flash is ultra-fast, has a 1M token context, and strong rate limits
const GEMINI_MODEL = "gemini-2.5-flash";

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
 * Route: POST /api/lesson-plans
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
    const outlineData = JSON.parse(rawOutline);

    // Step 2: Generate Content for Each Day
    const generatedDays = [];
    
    for (const day of outlineData.days) {
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
      generatedDays.push(JSON.parse(rawDayContent));
    }

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
      details: error.message,
    });
  }
});

export default router;