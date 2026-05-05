const express = require("express");
const userController = require("../controllers/userController");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validation");
const { paginationRules, userUpdateRules } = require("../utils/validators");
const upload = require("../middleware/upload");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorizeRoles("team_lead", "admin"),
  paginationRules,
  validateRequest,
  userController.getUsers,
);
router.get("/:userId", userController.getUserById);
router.put(
  "/:userId",
  upload.single("profile_picture"),
  userUpdateRules,
  validateRequest,
  userController.updateUser,
);
router.delete(
  "/:userId",
  authorizeRoles("team_lead", "admin"),
  userController.deactivateUser,
);

module.exports = router;
