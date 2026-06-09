import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import notesRouter from "./notes";
import tasksRouter from "./tasks";
import memoriesRouter from "./memories";
import dashboardRouter from "./dashboard";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(notesRouter);
router.use(tasksRouter);
router.use(memoriesRouter);
router.use(dashboardRouter);
router.use(profileRouter);

export default router;
