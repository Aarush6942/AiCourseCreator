import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lessonPlansRouter from "./lesson-plans";
import authRouter from "./auth";

const router: IRouter = Router();

// Mount sub-routers with explicit API paths
router.use("/api", healthRouter);
router.use("/api/lesson-plans", lessonPlansRouter); // Mounts under /api/lesson-plans
router.use("/api/auth", authRouter);

export default router;