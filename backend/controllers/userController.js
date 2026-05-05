const UserModel = require("../models/User");
const { successResponse, paginationResponse } = require("../utils/response");
const { ForbiddenError, NotFoundError } = require("../utils/errors");
const fs = require("fs");
const path = require("path");

function parsePagination(query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 10);
  return { page, pageSize };
}

async function getUsers(req, res, next) {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const isActive =
      req.query.isActive === undefined
        ? undefined
        : req.query.isActive === "true";

    const { rows, totalItems } = await UserModel.listUsers({
      page,
      pageSize,
      role: req.query.role,
      search: req.query.search,
      isActive,
    });

    return paginationResponse(
      res,
      "Users retrieved successfully",
      rows,
      {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
      200,
    );
  } catch (error) {
    return next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const userId = Number(req.params.userId);

    if (
      req.user.role !== "team_lead" &&
      req.user.role !== "admin" &&
      req.user.id !== userId
    ) {
      throw new ForbiddenError("You can only view your own profile");
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    return successResponse(res, "User retrieved successfully", user);
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const userId = Number(req.params.userId);

    if (
      req.user.role !== "team_lead" &&
      req.user.role !== "admin" &&
      req.user.id !== userId
    ) {
      throw new ForbiddenError("You can only update your own profile");
    }

    const target = await UserModel.findById(userId);
    if (!target) {
      throw new NotFoundError("User not found");
    }

    const payload = {};
    if (req.body.name !== undefined) payload.name = req.body.name;
    if (req.body.contact_number !== undefined)
      payload.contact_number = req.body.contact_number;
    if (
      (req.user.role === "team_lead" || req.user.role === "admin") &&
      req.body.is_active !== undefined
    )
      payload.is_active = req.body.is_active;

    if (req.file) {
      payload.profile_picture = `/uploads/profiles/${req.file.filename}`;
      // Clean up old file if it exists and was stored locally
      if (
        target.profile_picture &&
        target.profile_picture.startsWith("/uploads/profiles/")
      ) {
        const oldFilePath = path.join(__dirname, "..", target.profile_picture);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    } else if (req.body.profile_picture !== undefined) {
      payload.profile_picture = req.body.profile_picture;
    }

    await UserModel.updateUser(userId, payload);
    const updated = await UserModel.findById(userId);

    return successResponse(res, "User updated successfully", updated);
  } catch (error) {
    return next(error);
  }
}

async function deactivateUser(req, res, next) {
  try {
    const userId = Number(req.params.userId);

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    await UserModel.deactivateUser(userId);
    return successResponse(res, "User deactivated successfully", null, 200);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deactivateUser,
};
