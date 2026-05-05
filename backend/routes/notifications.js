const express = require("express");
const { body, param, query } = require("express-validator");
const notificationController = require("../controllers/notificationController");
const { authenticate } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validation");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  [
    query("is_read")
      .optional()
      .isIn(["true", "false"])
      .withMessage("is_read must be true or false"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("limit must be between 1 and 100"),
    query("page").optional().isInt({ min: 1 }).withMessage("page must be >= 1"),
  ],
  validateRequest,
  notificationController.getNotifications,
);

router.patch(
  "/:id/read",
  [param("id").isInt({ min: 1 }).withMessage("Invalid notification id")],
  validateRequest,
  notificationController.markNotificationRead,
);

router.patch("/read-all", notificationController.markAllNotificationsRead);

router.get("/web-push-public-key", notificationController.getPushPublicKey);

router.delete("/clear-all", notificationController.clearAllNotifications);

router.delete(
  "/:id",
  [param("id").isInt({ min: 1 }).withMessage("Invalid notification id")],
  validateRequest,
  notificationController.deleteNotification,
);

router.post(
  "/subscribe",
  [
    body("subscription").isObject().withMessage("subscription is required"),
    body("subscription.endpoint")
      .trim()
      .notEmpty()
      .withMessage("subscription.endpoint is required")
      .isLength({ max: 1024 })
      .withMessage("subscription.endpoint is too long"),
    body("subscription.keys")
      .isObject()
      .withMessage("subscription.keys is required"),
    body("subscription.keys.p256dh")
      .trim()
      .notEmpty()
      .withMessage("subscription.keys.p256dh is required"),
    body("subscription.keys.auth")
      .trim()
      .notEmpty()
      .withMessage("subscription.keys.auth is required"),
  ],
  validateRequest,
  notificationController.subscribePush,
);

module.exports = router;
