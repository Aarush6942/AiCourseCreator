import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, lessonPlansTable, lessonDaysTable } from "@workspace/db";
import {
  CreateLessonPlanBody,
  GetLessonPlanParams,
  DeleteLessonPlanParams,
  DeleteLessonDayParams,
  RegenerateQuizParams,
  CreateLessonPlanResponse,
  GetLessonPlanResponse,
  ListLessonPlansResponse,
  RegenerateQuizResponse,
} from "@workspace/api-zod";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
const router: IRouter = Router();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface GeneratedDay {
  dayNumber: number;
  title: string;
  lessonContent: string;
  quiz: QuizQuestion[];
}

interface DayOutline {
  dayNumber: number;
  title: string;
  objective: string;
}

type LearningDepth = "quick" | "standard" | "deep";

const depthSettings: Record<
  LearningDepth,
  { label: string; wordCount: number; maxTokens: number }
> = {
  quick: { label: "a concise overview", wordCount: 250, maxTokens: 2400 },
  standard: { label: "a balanced learning session", wordCount: 550, maxTokens: 4200 },
  deep: { label: "an in-depth lesson", wordCount: 900, maxTokens: 6000 },
};

function parseRetryAfterMs(errorBody: string): number {
  const secondsMatch = errorBody.match(/try again in ([0-9.]+)s/);
  if (secondsMatch) return Math.ceil(parseFloat(secondsMatch[1]) * 1000) + 500;
  const minsMatch = errorBody.match(/try again in ([0-9]+)m([0-9.]+)s/);
  if (minsMatch) return (parseInt(minsMatch[1]) * 60 + parseFloat(minsMatch[2])) * 1000 + 500;
  return 30_000; // default 30s fallback
}

async function callGroq(messages: Array<{ role: string; content: string }>, maxTokens = 4000, retries = 5, responseFormatJson = true): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptMaxTokens = attempt === 0 ? maxTokens : Math.min(Math.ceil(maxTokens * 1.5), 8000);
    
    // Create an abort controller with a 15-second timeout to prevent hanging on Render
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      const requestBody: any = {
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: attemptMaxTokens,
      };

      if (responseFormatJson) {
        requestBody.response_format = { type: "json_object" };
      }

      response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("Groq API request timed out after 15 seconds");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 429) {
      const errorText = await response.text();
      const waitMs = parseRetryAfterMs(errorText);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(`Groq rate limit after ${retries} retries`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 400 && errorText.includes("json_validate_failed") && attempt < retries) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("No content returned from Groq");
    return content;
  }

  throw new Error("callGroq exhausted retries");
}

async function generatePlanOutline(topic: string, dayCount: number): Promise<DayOutline[]> {
  const content = await callGroq([
    {
      role: "system",
      content: "You are an expert curriculum designer. Respond with valid JSON only.",
    },
    {
      role: "user",
      content: `Design a ${dayCount}-day course outline for: "${topic}".

Return JSON:
{
  "days": [
    { "dayNumber": 1, "title": "Title here", "objective": "One sentence describing what is covered and learned this day." }
  ]
}

router.get("/lesson-plans", async (req, res) => {
  const secretCode = req.query.secretCode as string;

  if (!secretCode) {
    return res.status(401).json({ error: "Unauthorized: Missing secret code" });
  }

  // Filter your database query by secretCode
  const plans = await db.lessonPlan.findMany({
    where: { secretCode },
    orderBy: { createdAt: "desc" },
  });

  return res.json(plans);
});

Requirements:
- Exactly ${dayCount} day${dayCount === 1 ? "" : "s"} numbered 1-${dayCount}
- Each day builds logically on previous days, from fundamentals to advanced
- Titles should be specific and descriptive (not generic like "Introduction")
- Objectives should describe concrete skills or knowledge the learner gains`,
    },
  ], 2000);

  const parsed = JSON.parse(content) as { days: DayOutline[] };
  if (!parsed.days || !Array.isArray(parsed.days)) throw new Error("Invalid outline structure");
  return parsed.days;
}

async function generateDayLesson(
  topic: string,
  day: DayOutline,
  allDays: DayOutline[],
  depth: LearningDepth,
): Promise<GeneratedDay> {
  const settings = depthSettings[depth];
  const previousDays = allDays
    .filter((d) => d.dayNumber < day.dayNumber)
    .map((d) => `Day ${d.dayNumber}: ${d.title} — ${d.objective}`)
    .join("\n");

  const upcomingDays = allDays
    .filter((d) => d.dayNumber > day.dayNumber)
    .slice(0, 3)
    .map((d) => `Day ${d.dayNumber}: ${d.title}`)
    .join(", ");

  const content = await callGroq([
    {
      role: "system",
      content: `You are an expert educator writing a comprehensive, in-depth lesson. Your writing is clear, engaging, and pedagogically sound. You include real examples, analogies, and detailed explanations. Respond with valid JSON only.`,
    },
    {
      role: "user",
      content: `Write a detailed lesson for Day ${day.dayNumber} of a ${allDays.length}-day course on "${topic}".

Day ${day.dayNumber} title: "${day.title}"
Day ${day.dayNumber} objective: ${day.objective}
${previousDays ? `\nCoverage so far:\n${previousDays}` : ""}
${upcomingDays ? `\nUpcoming days: ${upcomingDays}` : ""}

Return JSON with this structure:
{
  "dayNumber": ${day.dayNumber},
  "title": "${day.title}",
  "lessonContent": "...(full markdown lesson here)...",
  "quiz": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "..."
    }
  ]
}

LESSON CONTENT REQUIREMENTS — this is the most important part:
- Write approximately ${settings.wordCount} words of educational content in markdown. This should be ${settings.label}.
- Keep the lesson within that target; reserve enough response space to complete all five quiz questions and the closing JSON brackets.
- Start with a brief overview paragraph explaining what will be covered and why it matters
- Use ## for main sections (aim for 5-7 distinct sections)
- Use ### for subsections where appropriate
- Include concrete, real-world examples for every concept — show, don't just tell
- Include at least one worked example or case study that walks through a scenario step by step
- Use **bold** for key terms when first introduced, then define them clearly
- Use bullet lists and numbered steps for processes and comparisons
- Include a "Key Takeaways" section at the end summarizing the 4-5 most important points
- Write for a motivated adult learner — be thorough but engaging, not dry
- Reference concepts from previous days naturally where relevant
- Hint at how today's material connects to what comes next

QUIZ REQUIREMENTS:
- Exactly 5 multiple choice questions
- Questions should test genuine understanding, not just memorization
- Each question must have exactly 4 answer options
- correctAnswer is the 0-based index of the correct option
- Explanations should teach — explain WHY the answer is correct and why the others aren't
- Vary difficulty: 2 foundational, 2 applied, 1 analytical/synthesis question`,
    },
  ], settings.maxTokens);

  const parsed = JSON.parse(content) as GeneratedDay;
  if (!parsed.lessonContent || !parsed.quiz) throw new Error(`Invalid day ${day.dayNumber} structure`);
  return { ...parsed, dayNumber: day.dayNumber, title: day.title };
}

async function generateLessonPlanWithGroq(topic: string, depth: LearningDepth, dayCount: number): Promise<GeneratedDay[]> {
  if (dayCount === 1) {
    const content = await callGroq([
      { role: "system", content: "You are a helpful assistant. Respond with valid JSON only." },
      { 
        role: "user", 
        content: `Provide a 1-sentence test summary for the topic: "${topic}". Return JSON: {"summary": "your sentence here"}` 
      }
    ], 500);

    const parsed = JSON.parse(content) as { summary: string };
    
    return [{
      dayNumber: 1,
      title: `Test: ${topic}`,
      lessonContent: `# Test Run\n\n${parsed.summary || "Groq connection successful."}`,
      quiz: [
        {
          question: "Is the Groq API working?",
          options: ["Yes", "No", "Maybe", "Unknown"],
          correctAnswer: 0,
          explanation: "If you see this, the round-trip to Groq succeeded."
        }
      ]
    }];
  }

  const outline = await generatePlanOutline(topic, dayCount);
  const concurrency = 2;
  const days: GeneratedDay[] = [];
  let nextDayIndex = 0;

  async function generateNextDay(): Promise<void> {
    while (nextDayIndex < outline.length) {
      const day = outline[nextDayIndex++];
      const generated = await generateDayLesson(topic, day, outline, depth);
      days.push(generated);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, outline.length) }, generateNextDay),
  );

  return days.sort((a, b) => a.dayNumber - b.dayNumber);
}

async function generateNewQuiz(topic: string, dayTitle: string, lessonContent: string, dayNumber: number): Promise<QuizQuestion[]> {
  const content = await callGroq([
    {
      role: "system",
      content: "You are an expert educator. Create fresh, high-quality quiz questions. Respond with valid JSON only.",
    },
    {
      role: "user",
      content: `Generate a brand-new set of 5 quiz questions for Day ${dayNumber} of a course on "${topic}".

Lesson title: "${dayTitle}"

Lesson content summary (first 1500 chars):
${lessonContent.slice(0, 1500)}

Return JSON:
{
  "quiz": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "..."
    }
  ]
}

Requirements:
- Exactly 5 questions, ALL different from any previous quiz
- Test genuine understanding and application, not surface recall
- Each question has exactly 4 options
- correctAnswer is the 0-based index of the correct option
- Explanations teach WHY the answer is correct and why others are wrong
- Mix: 2 foundational, 2 applied, 1 analytical question
- Questions should be fresh angles on the material — scenarios, edge cases, "what would happen if..." style`,
  },
  ], 3000);

  const parsed = JSON.parse(content) as { quiz: QuizQuestion[] };
  if (!parsed.quiz || !Array.isArray(parsed.quiz)) throw new Error("Invalid quiz structure");
  return parsed.quiz;
}

// GET /lesson-plans
router.get("/lesson-plans", async (req, res): Promise<void> => {
  const plans = await db
    .select({
      id: lessonPlansTable.id,
      topic: lessonPlansTable.topic,
      createdAt: lessonPlansTable.createdAt,
      dayCount: sql<number>`cast(count(${lessonDaysTable.id}) as integer)`,
    })
    .from(lessonPlansTable)
    .leftJoin(lessonDaysTable, eq(lessonDaysTable.lessonPlanId, lessonPlansTable.id))
    .groupBy(lessonPlansTable.id)
    .orderBy(lessonPlansTable.createdAt);

  res.json(ListLessonPlansResponse.parse(plans.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))));
});

// POST /lesson-plans
router.post("/lesson-plans", async (req, res): Promise<void> => {
  const requestId = req.headers["cf-ray"] ?? req.id;
  req.log.info({ requestId }, "Lesson-plan generation request received");
  req.once("aborted", () => {
    req.log.warn({ requestId }, "Lesson-plan client disconnected before completion");
  });
  res.once("close", () => {
    if (!res.writableEnded) {
      req.log.warn({ requestId }, "Lesson-plan response connection closed before completion");
    }
  });

  const parsed = CreateLessonPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { topic, depth = "standard", secretCode, dayCount = 10 } = parsed.data;
  const generationDepth: LearningDepth = dayCount === 1 ? "quick" : depth;
  req.log.info({ topic, depth: generationDepth, dayCount }, "Generating lesson plan with Groq");

  let days: GeneratedDay[];
  try {
    days = await generateLessonPlanWithGroq(topic, generationDepth, dayCount);
  } catch (err: any) {
    req.log.error({ err: err?.message || err }, "Groq API error during plan generation");
    res.status(500).json({ error: err?.message || "Failed to generate lesson plan. Please try again." });
    return;
  }

  const [plan] = await db.insert(lessonPlansTable).values({ topic, secretCode }).returning();
  const insertedDays = await db
    .insert(lessonDaysTable)
    .values(
      days.map((d) => ({
        lessonPlanId: plan.id,
        dayNumber: d.dayNumber,
        title: d.title,
        lessonContent: d.lessonContent,
        quiz: d.quiz,
      })),
    )
    .returning();

  const result = {
    id: plan.id,
    topic: plan.topic,
    createdAt: plan.createdAt.toISOString(),
    days: insertedDays
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d: typeof insertedDays[number]) => ({
        id: d.id,
        dayNumber: d.dayNumber,
        title: d.title,
        lessonContent: d.lessonContent,
        quiz: d.quiz as QuizQuestion[],
        createdAt: d.createdAt.toISOString(),
      })),
  };

  res.status(201).json(CreateLessonPlanResponse.parse(result));
});

// GET /lesson-plans/:id
router.get("/lesson-plans/:id", async (req, res): Promise<void> => {
  const params = GetLessonPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plan] = await db.select().from(lessonPlansTable).where(eq(lessonPlansTable.id, params.data.id));
  if (!plan) {
    res.status(404).json({ error: "Lesson plan not found" });
    return;
  }

  const days = await db
    .select()
    .from(lessonDaysTable)
    .where(eq(lessonDaysTable.lessonPlanId, plan.id))
    .orderBy(lessonDaysTable.dayNumber);

  const result = {
    id: plan.id,
    topic: plan.topic,
    createdAt: plan.createdAt.toISOString(),
    days: days.map((d) => ({
      id: d.id,
      dayNumber: d.dayNumber,
      title: d.title,
      lessonContent: d.lessonContent,
      quiz: d.quiz as QuizQuestion[],
      createdAt: d.createdAt.toISOString(),
    })),
  };

  res.json(GetLessonPlanResponse.parse(result));
});

// DELETE /lesson-plans/:id
router.delete("/lesson-plans/:id", async (req, res): Promise<void> => {
  const params = DeleteLessonPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plan] = await db.delete(lessonPlansTable).where(eq(lessonPlansTable.id, params.data.id)).returning();
  if (!plan) {
    res.status(404).json({ error: "Lesson plan not found" });
    return;
  }

  res.sendStatus(204);
});

// DELETE /lesson-plans/:id/days/:dayNumber
router.delete("/lesson-plans/:id/days/:dayNumber", async (req, res): Promise<void> => {
  const params = DeleteLessonDayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [day] = await db
    .delete(lessonDaysTable)
    .where(and(eq(lessonDaysTable.lessonPlanId, params.data.id), eq(lessonDaysTable.dayNumber, params.data.dayNumber)))
    .returning();

  if (!day) {
    res.status(404).json({ error: "Lesson day not found" });
    return;
  }

  res.sendStatus(204);
});

// POST /lesson-plans/:id/days/:dayNumber/regenerate-quiz
router.post("/lesson-plans/:id/days/:dayNumber/regenerate-quiz", async (req, res): Promise<void> => {
  const params = RegenerateQuizParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plan] = await db.select().from(lessonPlansTable).where(eq(lessonPlansTable.id, params.data.id));
  if (!plan) {
    res.status(404).json({ error: "Lesson plan not found" });
    return;
  }

  const [day] = await db
    .select()
    .from(lessonDaysTable)
    .where(and(eq(lessonDaysTable.lessonPlanId, params.data.id), eq(lessonDaysTable.dayNumber, params.data.dayNumber)));

  if (!day) {
    res.status(404).json({ error: "Lesson day not found" });
    return;
  }

  req.log.info({ planId: params.data.id, dayNumber: params.data.dayNumber }, "Regenerating quiz with Groq");

  let newQuiz: QuizQuestion[];
  try {
    newQuiz = await generateNewQuiz(plan.topic, day.title, day.lessonContent, day.dayNumber);
  } catch (err: any) {
    req.log.error({ err: err?.message || err }, "Groq API error during quiz regeneration");
    res.status(500).json({ error: err?.message || "Failed to generate new quiz. Please try again." });
    return;
  }

  const [updatedDay] = await db
    .update(lessonDaysTable)
    .set({ quiz: newQuiz })
    .where(and(eq(lessonDaysTable.lessonPlanId, params.data.id), eq(lessonDaysTable.dayNumber, params.data.dayNumber)))
    .returning();

  const result = {
    id: updatedDay.id,
    dayNumber: updatedDay.dayNumber,
    title: updatedDay.title,
    lessonContent: updatedDay.lessonContent,
    quiz: updatedDay.quiz as QuizQuestion[],
    createdAt: updatedDay.createdAt.toISOString(),
  };

  res.json(RegenerateQuizResponse.parse(result));
});

// POST /lesson-plans/:id/days/:dayNumber/ask — AI tutor chat (no codegen, free-form text)
router.post("/lesson-plans/:id/days/:dayNumber/ask", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const dayNumber = parseInt(req.params.dayNumber, 10);
  if (isNaN(id) || isNaN(dayNumber)) {
    res.status(400).json({ error: "Invalid id or dayNumber" });
    return;
  }

  const { message, history } = req.body as {
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  };
  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const [plan] = await db.select().from(lessonPlansTable).where(eq(lessonPlansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

  const [day] = await db
    .select()
    .from(lessonDaysTable)
    .where(and(eq(lessonDaysTable.lessonPlanId, id), eq(lessonDaysTable.dayNumber, dayNumber)));
  if (!day) { res.status(404).json({ error: "Day not found" }); return; }

  const systemPrompt = `You are an expert, friendly tutor helping a student study "${plan.topic}".
They are currently on Day ${day.dayNumber}: "${day.title}".

Here is the lesson content they have read:
---
${day.lessonContent.slice(0, 3000)}
---

Answer their questions clearly and concisely. Use short paragraphs or bullet points. 
If the question is off-topic from the lesson, gently steer back.
Keep answers under ~250 words unless they specifically ask for more detail.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []).slice(-10),          // last 10 turns of context
    { role: "user", content: message.trim() },
  ];

  let reply: string;
  try {
    // Utilize callGroq with responseFormatJson = false for free-form text
    reply = await callGroq(messages, 600, 3, false);
  } catch (err: any) {
    req.log.error({ err: err?.message || err }, "Groq error in /ask");
    res.status(500).json({ error: err?.message || "Failed to get AI response. Please try again." });
    return;
  }

  res.json({ reply });
});

export default router;