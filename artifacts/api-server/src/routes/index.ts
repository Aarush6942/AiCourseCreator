import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lessonPlansRouter from "./lesson-plans";
import authRouter from "./auth";
const router: IRouter = Router();

router.use(healthRouter);
router.use(lessonPlansRouter);
router.use(authRouter); 

export default router;