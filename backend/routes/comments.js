const express = require("express");
const commentController = require("../controllers/commentController");
const { authenticate } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validation");
const { commentRules } = require("../utils/validators");

const router = express.Router();

router.use(authenticate);

router.put(
  "/:commentId",
  commentRules,
  validateRequest,
  commentController.updateComment,
);
router.delete("/:commentId", commentController.deleteComment);
router.get("/:commentId/history", commentController.getCommentHistory);

module.exports = router;
