import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRoles, staffMiddleware } from "../middlewares/adminMiddleware.js";
import { auditMiddleware } from "../middlewares/auditMiddleware.js";
import { downloadBackup, listActivity, listRecycleBin, purgeRecycleItem, restoreRecycleItem } from "../controllers/adminActivity.controller.js";
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
import {
  adjustCredits,
  createDemo,
  createReseller,
  deleteDevice,
  listCreditMovements,
  listDevices,
  listResellers
} from "../controllers/adminOperations.controller.js";

const router = Router();
router.use(authMiddleware, staffMiddleware, auditMiddleware);
const adminOnly=requireRoles("admin"), sales=requireRoles("admin","vendedor"), support=requireRoles("admin","soporte"), deviceManagers=requireRoles("admin","vendedor","soporte");
router.get("/activity", adminOnly, listActivity);
router.get("/recycle-bin", adminOnly, listRecycleBin);
router.post("/recycle-bin/:id/restore", adminOnly, restoreRecycleItem);
router.delete("/recycle-bin/:id", adminOnly, purgeRecycleItem);
router.get("/backup", adminOnly, downloadBackup);
router.get("/operations/resellers", sales, listResellers);
router.post("/operations/resellers", adminOnly, createReseller);
router.post("/operations/resellers/:userId/credits", adminOnly, adjustCredits);
router.get("/operations/resellers/:userId/credits", adminOnly, listCreditMovements);
router.post("/operations/demos", sales, createDemo);
router.get("/operations/devices", listDevices);
router.delete("/operations/devices/:id", deviceManagers, deleteDevice);
router.get("/users", listUsers);
router.post("/users", sales, createUser);
router.put("/users/:id", sales, updateUser);
router.delete("/users/:id", adminOnly, deleteUser);
router.get("/payments", listPayments);
router.post("/payments", sales, createPayment);
router.put("/payments/:id", sales, updatePayment);
router.delete("/payments/:id", adminOnly, deletePayment);
router.post("/plans", adminOnly, createPlan);
router.put("/plans/:id", adminOnly, updatePlan);
router.delete("/plans/:id", adminOnly, deletePlan);
router.get("/subscriptions", listSubscriptions);
router.get("/plans", listPlans);
router.post("/subscriptions", sales, createSubscription);
router.put("/subscriptions/:id", sales, updateSubscription);
router.delete("/subscriptions/:id", adminOnly, deleteSubscription);
router.post("/subscriptions/:id/renew", sales, renewSubscription);
router.get("/automations/jobs", listAutomationJobs);
router.post("/automations/run", sales, runAutomations);
router.get("/content/import/iptv-org/paraguay/preview", support, previewParaguayPlaylist);
router.post("/content/import/iptv-org/paraguay", support, importParaguayPlaylist);
router.get("/content/import/iptv-org/countries", support, listIptvOrgCountries);
router.get("/content/import/iptv-org/:countryCode/preview", support, previewCountryPlaylist);
router.post("/content/import/iptv-org/:countryCode", support, importCountryPlaylist);
router.get("/content/import/xtream/providers", support, listXtreamProviders);
router.post("/content/import/xtream/providers", support, createXtreamProvider);
router.get("/content/import/xtream/providers/:providerId/streams", support, previewXtreamStreams);
router.post("/content/import/xtream/providers/:providerId/import", support, importXtreamStreams);
router.get("/content/:kind", listContent);
router.post("/content/:kind", support, createContent);
router.delete("/content/:kind", support, deleteContentBatch);
router.put("/content/:kind/:id", support, updateContent);
router.delete("/content/:kind/:id", support, deleteContent);
export default router;
