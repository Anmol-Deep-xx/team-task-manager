const axios = require("axios");
const webpush = require("web-push");
const { pool } = require("../config/database");
const logger = require("../utils/logger");

let notificationSchemaReadyPromise = null;
let vapidConfigCache = null;

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

function getOneSignalConfig() {
  const appId = String(process.env.ONESIGNAL_APP_ID || "").trim();
  const apiKey = String(process.env.ONESIGNAL_API_KEY || "").trim();

  if (!appId || !apiKey) {
    logger.warn(
      "ONESIGNAL_APP_ID or ONESIGNAL_API_KEY not set. Push notifications will be skipped.",
    );
    return null;
  }

  return { appId, apiKey };
}

function getVapidConfig() {
  if (vapidConfigCache) {
    return vapidConfigCache;
  }

  let publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
  let privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();

  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    logger.warn(
      "WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY not set. Generated ephemeral keys for fallback web push.",
    );
  }

  const subject =
    String(process.env.WEB_PUSH_VAPID_SUBJECT || "").trim() ||
    "mailto:support@taskscheduler.local";

  webpush.setVapidDetails(subject, publicKey, privateKey);

  vapidConfigCache = {
    publicKey,
    privateKey,
    subject,
  };

  return vapidConfigCache;
}

async function runSchemaChange(sql, ignorableErrorCodes = []) {
  try {
    await pool.execute(sql);
  } catch (error) {
    if (ignorableErrorCodes.includes(error?.code)) {
      return;
    }
    throw error;
  }
}

async function ensureNotificationSchema() {
  if (!notificationSchemaReadyPromise) {
    notificationSchemaReadyPromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          type ENUM('task_assigned', 'comment_added', 'task_status_changed', 'overdue_alert', 'new_chat_message') NOT NULL,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          reference_id INT NOT NULL,
          reference_type ENUM('task', 'project') NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_notifications_user (user_id),
          INDEX idx_notifications_unread (user_id, is_read),
          INDEX idx_notifications_type_created (type, created_at)
        )
      `);

      await pool.execute(`
        CREATE TABLE IF NOT EXISTS user_push_subscriptions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          endpoint VARCHAR(1024) NOT NULL,
          p256dh VARCHAR(512) NOT NULL,
          auth VARCHAR(512) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_push_subscription (user_id),
          UNIQUE KEY uq_push_endpoint (endpoint(255)),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_push_user (user_id)
        )
      `);

      // Migrate legacy schemas from prior OneSignal-only versions.
      await runSchemaChange(
        `ALTER TABLE user_push_subscriptions
         ADD COLUMN endpoint VARCHAR(1024) NOT NULL`,
        ["ER_DUP_FIELDNAME"],
      );
      await runSchemaChange(
        `ALTER TABLE user_push_subscriptions
         ADD COLUMN p256dh VARCHAR(512) NOT NULL`,
        ["ER_DUP_FIELDNAME"],
      );
      await runSchemaChange(
        `ALTER TABLE user_push_subscriptions
         ADD COLUMN auth VARCHAR(512) NOT NULL`,
        ["ER_DUP_FIELDNAME"],
      );
      await runSchemaChange(
        `ALTER TABLE user_push_subscriptions
         ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
        ["ER_DUP_FIELDNAME"],
      );
      await runSchemaChange(
        `ALTER TABLE user_push_subscriptions
         DROP COLUMN onesignal_player_id`,
        ["ER_CANT_DROP_FIELD_OR_KEY", "ER_BAD_FIELD_ERROR"],
      );
      await runSchemaChange(
        `ALTER TABLE user_push_subscriptions
         ADD UNIQUE KEY uq_push_endpoint (endpoint(255))`,
        ["ER_DUP_KEYNAME"],
      );
    })();
  }

  await notificationSchemaReadyPromise;
}

function getWebPushPublicKey() {
  return getVapidConfig().publicKey;
}

function isValidPushSubscription(subscription = {}) {
  return Boolean(
    subscription &&
    typeof subscription.endpoint === "string" &&
    subscription.endpoint.trim() &&
    subscription.keys &&
    typeof subscription.keys.p256dh === "string" &&
    subscription.keys.p256dh.trim() &&
    typeof subscription.keys.auth === "string" &&
    subscription.keys.auth.trim(),
  );
}

async function saveUserPushSubscription(userId, subscription) {
  await ensureNotificationSchema();

  if (!isValidPushSubscription(subscription)) {
    return false;
  }

  const endpoint = String(subscription.endpoint).trim();
  const p256dh = String(subscription.keys.p256dh).trim();
  const auth = String(subscription.keys.auth).trim();

  await pool.execute(
    `INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       endpoint = VALUES(endpoint),
       p256dh = VALUES(p256dh),
       auth = VALUES(auth)`,
    [Number(userId), endpoint, p256dh, auth],
  );

  return true;
}

async function sendWebPushToUsers(recipientUserIds, payload) {
  try {
    await ensureNotificationSchema();
    getVapidConfig();

    const ids = normalizeUserIds(recipientUserIds);
    if (ids.length === 0) {
      return false;
    }

    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await pool.execute(
      `SELECT id, endpoint, p256dh, auth
       FROM user_push_subscriptions
       WHERE user_id IN (${placeholders})`,
      ids,
    );

    if (!rows.length) {
      return false;
    }

    let delivered = false;

    await Promise.all(
      rows.map(async (row) => {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        };

        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify(payload),
            {
              TTL: 60,
            },
          );
          delivered = true;
        } catch (error) {
          const statusCode = Number(error?.statusCode || 0);
          if (
            statusCode === 400 ||
            statusCode === 403 ||
            statusCode === 404 ||
            statusCode === 410
          ) {
            await pool.execute(
              `DELETE FROM user_push_subscriptions
               WHERE id = ?`,
              [Number(row.id)],
            );
            return;
          }

          logger.error(`Web Push send failed: ${error.message}`);
        }
      }),
    );

    return delivered;
  } catch (error) {
    logger.error(`Web Push pipeline failed: ${error.message}`);
    return false;
  }
}

/**
 * Send a push notification via the OneSignal REST API.
 *
 * Users are targeted by OneSignal external_id values set by OneSignal.login().
 */
async function sendOneSignalPush(recipientUserIds, payload) {
  try {
    const config = getOneSignalConfig();
    if (!config) {
      return false;
    }

    const ids = normalizeUserIds(recipientUserIds);
    if (ids.length === 0) {
      return false;
    }

    const externalIds = ids.map((id) => String(id));

    const frontendOrigin = String(
      process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    ).trim();
    const targetUrl = payload.data?.url
      ? `${frontendOrigin}${payload.data.url}`
      : frontendOrigin;

    const notificationPayload = {
      app_id: config.appId,
      headings: { en: payload.title || "Task Scheduler" },
      contents: { en: payload.body || "You have a new update." },
      include_aliases: {
        external_id: externalIds,
      },
      target_channel: "push",
      url: targetUrl,
      web_url: targetUrl,
      chrome_web_icon: `${frontendOrigin}/favicon.svg`,
      // Attach custom data so the frontend can react on click.
      data: payload.data || {},
    };

    const response = await axios.post(ONESIGNAL_API_URL, notificationPayload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${config.apiKey}`,
      },
      timeout: 10000,
    });

    if (response.data?.errors && response.data.errors.length > 0) {
      logger.warn(
        `OneSignal push partial errors: ${JSON.stringify(response.data.errors)}`,
      );
    }

    logger.info(
      `OneSignal push sent to external_ids: [${externalIds.join(", ")}] — recipients: ${Number(response.data?.recipients || 0)} — OS notification id: ${response.data?.id || "unknown"}`,
    );

    return true;
  } catch (error) {
    const errMsg = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.error(`OneSignal push failed: ${errMsg}`);
    return false;
  }
}

function normalizeUserIds(ids = []) {
  return Array.from(
    new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
}

async function filterRecipientsByPreferences({
  recipientUserIds,
  type,
  reference_id,
  reference_type,
}) {
  await ensureNotificationSchema();

  const normalizedIds = normalizeUserIds(recipientUserIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const [users] = await pool.execute(
    `SELECT id, role, is_active
     FROM users
     WHERE id IN (${placeholders})`,
    normalizedIds,
  );

  let memberTaskMap = new Map();
  if (type === "task_status_changed" && reference_type === "task") {
    const [taskMembers] = await pool.execute(
      `SELECT u.id AS user_id
       FROM users u
       WHERE u.id IN (${placeholders})
         AND (
           EXISTS (
             SELECT 1 FROM task_assignees ta
             WHERE ta.task_id = ? AND ta.member_id = u.id
           )
           OR EXISTS (
             SELECT 1 FROM tasks t
             WHERE t.id = ? AND t.assigned_to = u.id
           )
         )`,
      [...normalizedIds, Number(reference_id), Number(reference_id)],
    );
    memberTaskMap = new Map(
      taskMembers.map((row) => [Number(row.user_id), true]),
    );
  }

  return users
    .filter((user) => user.is_active)
    .filter((user) => {
      const role = user.role;

      if (role === "member") {
        if (type === "task_status_changed") {
          if (reference_type !== "task") return false;
          return memberTaskMap.has(Number(user.id));
        }
        return (
          type === "task_assigned" ||
          type === "comment_added" ||
          type === "overdue_alert" ||
          type === "new_chat_message"
        );
      }

      if (role === "team_lead" || role === "admin") {
        if (type === "task_assigned") return false;
        return (
          type === "task_status_changed" ||
          type === "comment_added" ||
          type === "overdue_alert" ||
          type === "new_chat_message"
        );
      }

      return false;
    })
    .map((user) => Number(user.id));
}

async function sendNotification({
  recipientUserIds,
  type,
  title,
  body,
  reference_id,
  reference_type,
}) {
  try {
    await ensureNotificationSchema();

    const allowedRecipients = await filterRecipientsByPreferences({
      recipientUserIds,
      type,
      reference_id,
      reference_type,
    });

    if (allowedRecipients.length === 0) {
      return { notificationCount: 0, pushSent: false };
    }

    // 1. Persist in-app notifications (bell icon).
    const values = allowedRecipients.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const params = allowedRecipients.flatMap((userId) => [
      userId,
      type,
      title,
      body,
      Number(reference_id),
      reference_type,
    ]);

    await pool.execute(
      `INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
       VALUES ${values}`,
      params,
    );

    const payload = {
      title,
      body,
      data: {
        reference_id: Number(reference_id),
        reference_type,
        type,
        url:
          reference_type === "task"
            ? `/tasks/${Number(reference_id)}`
            : "/tasks",
      },
    };

    // 2. Send via OneSignal and fallback web push.
    const [oneSignalSent, webPushSent] = await Promise.all([
      sendOneSignalPush(allowedRecipients, payload),
      sendWebPushToUsers(allowedRecipients, payload),
    ]);

    const pushSent = Boolean(oneSignalSent || webPushSent);

    return { notificationCount: allowedRecipients.length, pushSent };
  } catch (error) {
    logger.error(`sendNotification failed: ${error.message}`);
    return { notificationCount: 0, pushSent: false };
  }
}

module.exports = {
  sendNotification,
  ensureNotificationSchema,
  getWebPushPublicKey,
  saveUserPushSubscription,
};
