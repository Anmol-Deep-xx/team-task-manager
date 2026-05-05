const bcrypt = require("bcryptjs");
const UserModel = require("../models/User");
const { generateToken } = require("../utils/jwt");
const { successResponse } = require("../utils/response");
const { ConflictError, UnauthorizedError } = require("../utils/errors");

async function register(req, res, next) {
  try {
    let { name, email, password, contact_number, profile_picture, role } = req.body;

    if (req.file) {
      profile_picture = `/uploads/profiles/${req.file.filename}`;
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await UserModel.createUser({
      name,
      email,
      password: hashedPassword,
      contact_number,
      profile_picture,
      role,
    });

    const createdUser = await UserModel.findById(userId);

    return successResponse(res, "Registration successful", createdUser, 201);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findByEmail(email);

    if (!user || !user.is_active) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return successResponse(res, "Login successful", {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        contact_number: user.contact_number,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function verify(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      throw new UnauthorizedError("Invalid user in token");
    }
    return successResponse(res, "Token verified", user);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  verify,
};
