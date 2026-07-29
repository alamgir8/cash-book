import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as schemeController from "../controllers/collection-scheme.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/", schemeController.listSchemes);
router.post("/", schemeController.createScheme);

router.get("/:schemeId/roster", schemeController.getRoster);
router.post("/:schemeId/members", schemeController.addMember);
router.patch("/:schemeId/members/:memberId", schemeController.updateMember);
router.delete("/:schemeId/members/:memberId", schemeController.removeMember);
router.get(
  "/:schemeId/members/:memberId/payments",
  schemeController.listMemberPayments,
);
router.post("/:schemeId/payments", schemeController.recordPayment);
router.post("/:schemeId/archive", schemeController.archiveScheme);
router.delete("/:schemeId", schemeController.deleteScheme);

router.get("/:schemeId", schemeController.getScheme);
router.patch("/:schemeId", schemeController.updateScheme);
router.post("/:schemeId/duplicate", schemeController.duplicateScheme);

export default router;
