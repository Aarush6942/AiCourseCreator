import { Router } from "express";
// 1. Import your database connection pool. 
// Adjust the path below to match where your database configuration is located (e.g., "../db" or "@/db")
import { pool } from "./db"; 

const authRouter = Router();

// 1. POST /api/signup
authRouter.post("/signup", async (req, res) => {
  const { username, password, secretCode } = req.body;

  if (!username || !password || !secretCode) {
    return res.status(400).json({ error: "Missing required registration fields." });
  }

  try {
    // Check if the user already exists in the real Neon database
    // Lowercase comparison handles case-insensitivity securely
    const checkUserQuery = "SELECT id FROM users WHERE LOWER(username) = LOWER($1)";
    const existingUserCheck = await pool.query(checkUserQuery, [username]);

    if (existingUserCheck.rows.length > 0) {
      return res.status(400).json({ error: "Username is already taken." });
    }

    // Insert the new user record into Neon.
    // Let your database auto-generate the ID if it's a SERIAL or UUID column, 
    // otherwise we select the fields to confirm successful injection.
    const insertUserQuery = `
      INSERT INTO users (username, password, "secretCode") 
      VALUES ($1, $2, $3) 
      RETURNING id
    `;
    await pool.query(insertUserQuery, [username, password, secretCode]);

    return res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Neon DB Signup Error:", error);
    return res.status(500).json({ error: "Database error during registration." });
  }
});

// 2. POST /api/login
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  try {
    // Look up user details straight from the Neon cluster
    const findUserQuery = 'SELECT id, username, password, "secretCode" FROM users WHERE LOWER(username) = LOWER($1)';
    const result = await pool.query(findUserQuery, [username]);
    
    const user = result.rows[0];

    // Suggest signing up if username doesn't exist in the database rows
    if (!user) {
      return res.status(404).json({ 
        action: "redirect_to_signup", 
        error: "Account not found." 
      });
    }

    // Direct string comparison matching your original credential check
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid password credentials." });
    }

    // Authentication successful
    return res.status(200).json({
      user: {
        id: String(user.id),
        username: user.username,
        secretCode: user.secretCode,
      }
    });
  } catch (error) {
    console.error("Neon DB Login Error:", error);
    return res.status(500).json({ error: "Database error during login." });
  }
});

export default authRouter;