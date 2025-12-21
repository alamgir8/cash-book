import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as organizationController from "../controllers/organization.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get options (business types, roles, etc.)
router.get("/options", organizationController.getOptions);

// Get my organizations
router.get("/", organizationController.getMyOrganizations);

// Create organization
router.post("/", organizationController.createOrganization);

// Get specific organization
router.get("/:organizationId", organizationController.getOrganization);

// Update organization
router.patch("/:organizationId", organizationController.updateOrganization);
router.put("/:organizationId", organizationController.updateOrganization);

// Delete organization
router.delete("/:organizationId", organizationController.deleteOrganization);

// Members management
router.get("/:organizationId/members", organizationController.getMembers);
router.post("/:organizationId/members", organizationController.inviteMember);
router.post("/:organizationId/accept", organizationController.acceptInvitation);
router.patch(
  "/:organizationId/members/:memberId",
  organizationController.updateMemberRole
);
router.delete(
  "/:organizationId/members/:memberId",
  organizationController.removeMember
);
router.post("/:organizationId/leave", organizationController.leaveOrganization);

export default router;
