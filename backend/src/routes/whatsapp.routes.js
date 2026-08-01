import { Router } from "express";
import {
  configurationStatus,
  createMessage,
  dispatchMessage,
  listMessages,
  listTemplates,
  markMessageSent,
  receiveWebhook,
  updateTemplateMeta,
  verifyWebhook
} from "../controllers/whatsapp.controller.js";
import { adminMiddleware } from "../middlewares/adminMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveWebhook);

router.use(authMiddleware, adminMiddleware);
router.get("/config", configurationStatus);
router.get("/templates", listTemplates);
router.put("/templates/:key/meta", updateTemplateMeta);
router.get("/messages", listMessages);
router.post("/messages", createMessage);
router.post("/messages/:id/dispatch", dispatchMessage);
router.post("/messages/:id/mark-sent", markMessageSent);

export default router;
