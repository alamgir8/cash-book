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
router.get("/:partyId", partyController.getParty);
router.patch("/:partyId", partyController.updateParty);
router.post("/:partyId/archive", partyController.archiveParty);

// Ledger
router.get("/:partyId/ledger", partyController.getPartyLedger);

export default router;
