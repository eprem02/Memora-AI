import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import notesRouter from "./notes";
import tasksRouter from "./tasks";
import memoriesRouter from "./memories";
import dashboardRouter from "./dashboard";
import profileRouter from "./profile";
import photosRouter from "./photos";
import medicationsRouter from "./medications";
import sosRouter from "./sos";
import aiRouter from "./ai";
import briefingRouter from "./briefing";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(notesRouter);
router.use(tasksRouter);
router.use(memoriesRouter);
router.use(dashboardRouter);
router.use(profileRouter);
router.use(photosRouter);
router.use(medicationsRouter);
router.use(sosRouter);
router.use(aiRouter);
router.use(briefingRouter);
router.use(storageRouter);

export default router;
