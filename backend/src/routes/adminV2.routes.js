import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { adminMiddleware } from "../middlewares/adminMiddleware.js";
import { listUsers, createUser, updateUser } from "../controllers/adminUsers.controller.js";
import { listPayments, listSubscriptions } from "../controllers/adminPayments.controller.js";
import { listContent, createContent, disableContent } from "../controllers/adminContent.controller.js";

const router = Router();
router.use(authMiddleware, adminMiddleware);
router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.get("/payments", listPayments);
router.get("/subscriptions", listSubscriptions);
router.get("/content/:kind", listContent);
router.post("/content/:kind", createContent);
router.delete("/content/:kind/:id", disableContent);
export default router;
