import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lessonPlansRouter from "./lesson-plans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lessonPlansRouter);

export default router;
