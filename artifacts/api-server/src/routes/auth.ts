import { Router } from "express";

const authRouter = Router();

// Mock database in-memory for users. 
// Note: If you have an active database connected (Prisma, Mongoose, Drizzle), replace this array check with a database query.
const usersDb: any[] = [];

// 1. POST /api/signup
authRouter.post("/signup", (req, res) => {
  const { username, password, secretCode } = req.body;

  if (!username || !password || !secretCode) {
    return res.status(400).json({ error: "Missing required registration fields." });
  }

  const userExists = usersDb.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (userExists) {
    return res.status(400).json({ error: "Username is already taken." });
  }

  // Create new user record
  const newUser = {
    id: String(usersDb.length + 1),
    username,
    password, // In production, hash your password (e.g., using bcrypt)
    secretCode,
  };

  usersDb.push(newUser);
  return res.status(201).json({ message: "User registered successfully!" });
});

// 2. POST /api/login
authRouter.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = usersDb.find((u) => u.username.toLowerCase() === username.toLowerCase());

  // Special feature from your login frontend: suggest signing up if username doesn't exist
  if (!user) {
    return res.status(404).json({ 
      action: "redirect_to_signup", 
      error: "Account not found." 
    });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: "Invalid password credentials." });
  }

  // Authentication successful
  return res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      secretCode: user.secretCode,
    }
  });
});

export default authRouter;