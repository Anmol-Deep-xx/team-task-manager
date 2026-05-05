const express = require("express");
const timeEntryController = require("../controllers/timeEntryController");
const { authenticate } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validation");
const { timeEntryRules, timeEntryUpdateRules } = require("../utils/validators");

const router = express.Router();

router.use(authenticate);

router.get("/my-history", timeEntryController.getMyTimeHistory);

router.post(
  "/",
  timeEntryRules,
  validateRequest,
  timeEntryController.createTimeEntry,
);
router.put(
  "/:timeEntryId",
  timeEntryUpdateRules,
  validateRequest,
  timeEntryController.updateTimeEntry,
);
router.delete("/:timeEntryId", timeEntryController.deleteTimeEntry);

module.exports = router;
