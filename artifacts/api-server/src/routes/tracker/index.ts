import { Router, type IRouter } from "express";
import profileRouter from "./profile";
import reportRouter from "./reports";
import tasksRouter from "./tasks";
import teamRouter from "./team";

const router: IRouter = Router();

router.use(profileRouter);
router.use(tasksRouter);
router.use(teamRouter);
router.use(reportRouter);

export default router;
