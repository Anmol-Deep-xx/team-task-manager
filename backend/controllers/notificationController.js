const { pool } = require("../config/database");
const { successResponse } = require("../utils/response");
const { NotFoundError } = require("../utils/errors");
const {
  ensureNotificationSchema,
  getWebPushPublicKey,
  saveUserPushSubscription,
} = require("../services/notificationService");

async function getNotifications(req, res, next) {
  try {
    await ensureNotificationSchema();

    const userId = req.user.id;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const params = [userId];
    let readFilterSql = "";

    if (req.query.is_read !== undefined) {
      const isRead = String(req.query.is_read).toLowerCase() === "true";
      readFilterSql = " AND n.is_read = ?";
      params.push(isRead);
    }

    const [rows] = await pool.execute(
      `SELECT n.*
       FROM notifications n
       WHERE n.user_id = ? ${readFilterSql}
       ORDER BY n.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM notifications n
       WHERE n.user_id = ? ${readFilterSql}`,
      params,
    );

    const [[unreadRow]] = await pool.execute(
      `SELECT COUNT(*) AS unread_count
       FROM notifications
       WHERE user_id = ? AND is_read = FALSE`,
      [userId],
    );

    return successResponse(res, "Notifications retrieved", {
      items: rows,
      unread_count: Number(unreadRow.unread_count || 0),
      pagination: {
        page,
        limit,
        totalItems: Number(countRows[0]?.total || 0),
        totalPages: Math.ceil(Number(countRows[0]?.total || 0) / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    await ensureNotificationSchema();

    const userId = req.user.id;
    const notificationId = Number(req.params.id);

    const [result] = await pool.execute(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError("Notification not found");
    }

    return successResponse(res, "Notification marked as read", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    await ensureNotificationSchema();

    await pool.execute(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = ? AND is_read = FALSE`,
      [req.user.id],
    );

    return successResponse(res, "All notifications marked as read", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    await ensureNotificationSchema();

    const userId = req.user.id;
    const notificationId = Number(req.params.id);

    const [result] = await pool.execute(
      `DELETE FROM notifications
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundError("Notification not found");
    }

    return successResponse(res, "Notification deleted", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function clearAllNotifications(req, res, next) {
  try {
    await ensureNotificationSchema();

    await pool.execute(
      `DELETE FROM notifications
       WHERE user_id = ?`,
      [req.user.id],
    );

    return successResponse(res, "All notifications deleted", null, 200);
  } catch (error) {
    return next(error);
  }
}

async function getPushPublicKey(req, res, next) {
  try {
    await ensureNotificationSchema();

    return successResponse(res, "Push public key retrieved", {
      publicKey: getWebPushPublicKey(),
    });
  } catch (error) {
    return next(error);
  }
}

async function subscribePush(req, res, next) {
  try {
    await ensureNotificationSchema();

    await saveUserPushSubscription(req.user.id, req.body.subscription || {});

    return successResponse(res, "Push subscription saved", null, 200);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  getPushPublicKey,
  subscribePush,
};
