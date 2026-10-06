import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { adminMiddleware } from "../middlewares/adminMiddleware.js";
import { listUsers, createUser, updateUser, deleteUser } from "../controllers/adminUsers.controller.js";
import {
  createSubscription,
  createPayment,
  createPlan,
  deletePayment,
  deletePlan,
  deleteSubscription,
  updatePlan,
  updatePayment,
  updateSubscription,
  listPlans,
  listPayments,
  listSubscriptions,
  renewSubscription
} from "../controllers/adminPayments.controller.js";
import { listContent, createContent, updateContent, deleteContent, deleteContentBatch } from "../controllers/adminContent.controller.js";
import {
  importCountryPlaylist,
  importParaguayPlaylist,
  listIptvOrgCountries,
  previewCountryPlaylist,
  previewParaguayPlaylist
} from "../controllers/adminIptvImport.controller.js";
import {
  createXtreamProvider,
  importXtreamStreams,
  listXtreamProviders,
  previewXtreamStreams
} from "../controllers/adminXtream.controller.js";
import {
  listAutomationJobs,
  runAutomations
} from "../controllers/automation.controller.js";

const router = Router();
router.use(authMiddleware, adminMiddleware);
router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.get("/payments", listPayments);
router.post("/payments", createPayment);
router.put("/payments/:id", updatePayment);
router.delete("/payments/:id", deletePayment);
router.post("/plans", createPlan);
router.put("/plans/:id", updatePlan);
router.delete("/plans/:id", deletePlan);
router.get("/subscriptions", listSubscriptions);
router.get("/plans", listPlans);
router.post("/subscriptions", createSubscription);
router.put("/subscriptions/:id", updateSubscription);
router.delete("/subscriptions/:id", deleteSubscription);
router.post("/subscriptions/:id/renew", renewSubscription);
router.get("/automations/jobs", listAutomationJobs);
router.post("/automations/run", runAutomations);
router.get("/content/import/iptv-org/paraguay/preview", previewParaguayPlaylist);
router.post("/content/import/iptv-org/paraguay", importParaguayPlaylist);
router.get("/content/import/iptv-org/countries", listIptvOrgCountries);
router.get("/content/import/iptv-org/:countryCode/preview", previewCountryPlaylist);
router.post("/content/import/iptv-org/:countryCode", importCountryPlaylist);
router.get("/content/import/xtream/providers", listXtreamProviders);
router.post("/content/import/xtream/providers", createXtreamProvider);
router.get("/content/import/xtream/providers/:providerId/streams", previewXtreamStreams);
router.post("/content/import/xtream/providers/:providerId/import", importXtreamStreams);
router.get("/content/:kind", listContent);
router.post("/content/:kind", createContent);
router.delete("/content/:kind", deleteContentBatch);
router.put("/content/:kind/:id", updateContent);
router.delete("/content/:kind/:id", deleteContent);
export default router;
