const { pool } = require("../config/database");

async function createUser({
  name,
  email,
  password,
  contact_number,
  profile_picture,
  role,
}) {
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, password, contact_number, profile_picture, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      password,
      contact_number || null,
      profile_picture || null,
      role || "member",
    ],
  );
  return result.insertId;
}

async function findByEmail(email) {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT id, name, email, contact_number, profile_picture, role, created_at, updated_at, is_active
     FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function findRawById(id) {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] || null;
}

async function listUsers({ page, pageSize, role, search, isActive }) {
  const where = [];
  const params = [];

  if (role) {
    where.push("role = ?");
    params.push(role);
  }
  if (search) {
    where.push("(name LIKE ? OR email LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (typeof isActive === "boolean") {
    where.push("is_active = ?");
    params.push(isActive);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM users ${whereSql}`,
    params,
  );
  const totalItems = countRows[0].total;

  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const safeOffset = Math.max(0, (Number(page) - 1) * safePageSize);
  const [rows] = await pool.execute(
    `SELECT id, name, email, contact_number, profile_picture, role, created_at, updated_at, is_active
     FROM users ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${safePageSize} OFFSET ${safeOffset}`,
    params,
  );

  return { rows, totalItems };
}

async function updateUser(id, payload) {
  const fields = [];
  const params = [];

  Object.entries(payload).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    params.push(value);
  });

  if (!fields.length) {
    return;
  }

  params.push(id);
  await pool.execute(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );
}

async function deactivateUser(id) {
  await pool.execute("UPDATE users SET is_active = FALSE WHERE id = ?", [id]);
}

async function findActiveMembersByIds(ids) {
  const normalizedIds = [...new Set((ids || []).map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );

  if (!normalizedIds.length) {
    return [];
  }

  const placeholders = normalizedIds.map(() => "?").join(", ");
  const [rows] = await pool.execute(
    `SELECT id
     FROM users
     WHERE id IN (${placeholders}) AND role = 'member' AND is_active = TRUE`,
    normalizedIds,
  );

  return rows;
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  findRawById,
  listUsers,
  updateUser,
  deactivateUser,
  findActiveMembersByIds,
};
