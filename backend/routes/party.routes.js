import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as partyController from "../controllers/party.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get options
router.get("/options", partyController.getOptions);

// Get summary/stats
router.get("/summary", partyController.getPartySummary);

// CRUD operations
router.get("/", partyController.getParties);
router.post("/", partyController.createParty);
// Register static subpaths BEFORE /:partyId so they never get swallowed
router.get("/:partyId/ledger", partyController.getPartyLedger);
router.get("/:partyId/net-balance", partyController.getPartyNetBalance);
router.post("/:partyId/archive", partyController.archiveParty);
router.post("/:partyId/merge", partyController.mergeParties);
router.get("/:partyId", partyController.getParty);
router.patch("/:partyId", partyController.updateParty);
router.delete("/:partyId", partyController.deleteParty);

export default router;
