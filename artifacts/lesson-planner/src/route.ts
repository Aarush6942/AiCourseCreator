import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { Pool } from "pg";

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- SIGN UP / REGISTER ROUTE ---
router.post("/signup", async (req: Request, res: Response): Promise<any> => {
  const { username, password, secretCode } = req.body;

  if (!username || !password || !secretCode) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await pool.query(
      "INSERT INTO users (username, password_hash, secret_code) VALUES ($1, $2, $3) RETURNING id, username, secret_code",
      [username, hashedPassword, secretCode]
    );

    return res.json({ success: true, user: newUser.rows[0] });
  } catch (err: any) {
    if (err.code === "23505") { // Unique violation error code in PostgreSQL
      return res.status(400).json({ error: "Username or Secret Code already taken" });
    }
    return res.status(500).json({ error: "Database error during registration" });
  }
});

// --- LOGIN ROUTE ---
router.post("/login", async (req: Request, res: Response): Promise<any> => {
  const { username, password } = req.body;

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ action: "redirect_to_signup", message: "User not found" });
    }

    const user = userResult.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Return the user information along with their unique secret code
    return res.json({ 
      success: true, 
      user: { id: user.id, username: user.username, secretCode: user.secret_code } 
    });
  } catch (err) {
    return res.status(500).json({ error: "Database error during login" });
  }
});

// --- FILTERED LESSON PLANS ROUTES ---

// Get plans only for the logged-in user
router.get("/lesson-plans", async (req: Request, res: Response): Promise<any> => {
  const userId = req.headers["x-user-id"]; // Read the identifying user ID from headers
  
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const plans = await pool.query("SELECT * FROM lesson_plans WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return res.json(plans.rows);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch lesson plans" });
  }
});

// Save plan with the creator's user ID linked
router.post("/lesson-plans", async (req: Request, res: Response): Promise<any> => {
  const userId = req.headers["x-user-id"];
  
  if (!req.body?.data) {
    return res.status(400).json({ error: "Invalid request payload layout" });
  }
  
  const { topic, depth } = req.body.data;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // [Insert your AI generation steps here to generate the content]
    const dummyContent = {}; 

    const newPlan = await pool.query(
      "INSERT INTO lesson_plans (topic, depth, content, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [topic, depth, JSON.stringify(dummyContent), userId]
    );

    return res.json(newPlan.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Failed to save lesson plan" });
  }
});

export default router;