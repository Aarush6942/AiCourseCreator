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
const GROQ_MODEL = "openai/gpt-oss-120b";

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
  return 30_000;
}

async function callGroq(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 4000,
  retries = 5,
  responseFormatJson = true
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptMaxTokens = attempt === 0 ? maxTokens : Math.min(Math.ceil(maxTokens * 1.5), 8000);

    // Set a 60-second timeout to allow complete lesson generation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

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
        throw new Error("Groq API request timed out after 60 seconds");
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

Return JSON with this exact format:
{
  "days": [
    { "dayNumber": 1, "title": "Title here", "objective": "One sentence describing what is covered and learned this day." }
  ]
}

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
      content: `You are an expert educator writing a comprehensive lesson. Respond with valid JSON only.`,
    },
    {
      role: "user",
      content: `Write a detailed lesson for Day ${day.dayNumber} of a ${allDays.length}-day course on "${topic}".

Day ${day.dayNumber} title: "${day.title}"
Day ${day.dayNumber} objective: ${day.objective}
${previousDays ? `\nCoverage so far:\n${previousDays}` : ""}
${upcomingDays ? `\nUpcoming days: ${upcomingDays}` : ""}

Return JSON:
{
  "dayNumber": ${day.dayNumber},
  "title": "${day.title}",
  "lessonContent": "...(markdown lesson here)...",
  "quiz": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "..."
    }
  ]
}

LESSON CONTENT REQUIREMENTS:
- Target length: ${settings.wordCount} words (${settings.label})
- Use ## for 5-7 main sections
- Include real-world examples and step-by-step case studies
- Include a "Key Takeaways" section at the end

QUIZ REQUIREMENTS:
- Exactly 5 multiple choice questions with 4 options each
- correctAnswer is the 0-based index`,
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
      content: "You are an expert educator. Respond with valid JSON only.",
    },
    {
      role: "user",
      content: `Generate 5 quiz questions for Day ${dayNumber} of "${topic}". Title: "${dayTitle}".

Lesson summary: ${lessonContent.slice(0, 1500)}

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
}`,
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
      secretCode: lessonPlansTable.secretCode,
      dayCount: sql<number>`cast(count(${lessonDaysTable.id}) as integer)`,
    })
    .from(lessonPlansTable)
    .leftJoin(lessonDaysTable, eq(lessonDaysTable.lessonPlanId, lessonPlansTable.id))
    .groupBy(lessonPlansTable.id, lessonPlansTable.secretCode)
    .orderBy(lessonPlansTable.createdAt);

  res.json(ListLessonPlansResponse.parse(plans.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))));
});

// POST /lesson-plans
router.post("/lesson-plans", async (req, res): Promise<void> => {
  const parsed = CreateLessonPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { topic, depth = "standard", secretCode, dayCount = 10 } = parsed.data;
  const generationDepth: LearningDepth = dayCount === 1 ? "quick" : depth;

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
      .map((d) => ({
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

// POST /lesson-plans/:id/days/:dayNumber/ask
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

  const systemPrompt = `You are an expert tutor helping a student study "${plan.topic}".
Lesson Day ${day.dayNumber}: "${day.title}".

Context:
${day.lessonContent.slice(0, 3000)}

Answer concisely with short paragraphs or bullets.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []).slice(-10),
    { role: "user", content: message.trim() },
  ];

  let reply: string;
  try {
    reply = await callGroq(messages, 600, 3, false);
  } catch (err: any) {
    req.log.error({ err: err?.message || err }, "Groq error in /ask");
    res.status(500).json({ error: err?.message || "Failed to get AI response. Please try again." });
    return;
  }

  res.json({ reply });
});

export default router;