import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lessonPlansRouter from "./lesson-plans";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/lesson-plans", lessonPlansRouter); // Combines with app.ts to make /api/lesson-plans
router.use("/auth", authRouter);

export default router;