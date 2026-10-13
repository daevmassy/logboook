import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trackerRouter from "./tracker";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trackerRouter);

export default router;
