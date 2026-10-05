import { Router } from "express";
import {
  createLead,
  crmDashboard,
  deleteLead,
  getLead,
  listLeads,
  updateLead
} from "../controllers/crm.controller.js";
import { adminMiddleware } from "../middlewares/adminMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authMiddleware, adminMiddleware);
router.get("/dashboard", crmDashboard);
router.get("/leads", listLeads);
router.post("/leads", createLead);
router.get("/leads/:id", getLead);
router.put("/leads/:id", updateLead);
router.delete("/leads/:id", deleteLead);

export default router;
