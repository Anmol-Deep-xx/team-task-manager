const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const { authenticate, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("team_lead", "admin"));

router.get("/overview", dashboardController.getOverview);
router.get("/team-performance", dashboardController.getTeamPerformance);
router.get("/member-workload", dashboardController.getMemberWorkload);

module.exports = router;
