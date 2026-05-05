const express = require("express");
const { register, login, verify } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validation");
const { registerRules, loginRules } = require("../utils/validators");
const upload = require("../middleware/upload");

const router = express.Router();

router.post("/register", upload.single("profile_picture"), registerRules, validateRequest, register);
router.post("/login", loginRules, validateRequest, login);
router.get("/verify", authenticate, verify);

module.exports = router;
