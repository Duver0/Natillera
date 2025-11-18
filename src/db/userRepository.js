import { executeSql } from "./database";

export async function createUser({ name, email, password }) {
  const result = await executeSql(
    `INSERT INTO app_users (name, email, password, role, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, 'USER', datetime('now'), datetime('now'), 1);`,
    [name.trim(), email.trim().toLowerCase(), password]
  );

  const id = result.insertId;
  return getUserById(id);
}

export async function getUserById(id) {
  const result = await executeSql(
    `SELECT * FROM app_users WHERE id = ? AND deleted = 0 LIMIT 1;`,
    [id]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows[0] || null;
}

export async function getUserByEmail(email) {
  const result = await executeSql(
    `SELECT * FROM app_users WHERE email = ? AND deleted = 0 LIMIT 1;`,
    [email.trim().toLowerCase()]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows[0] || null;
}

export async function getUserByEmailAndPassword(email, password) {
  const result = await executeSql(
    `SELECT * FROM app_users
     WHERE email = ? AND password = ? AND deleted = 0
     LIMIT 1;`,
    [email.trim().toLowerCase(), password]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows[0] || null;
}

export async function hasAnyUser() {
  const result = await executeSql(
    `SELECT COUNT(*) as count FROM app_users WHERE deleted = 0;`
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  const row = rows[0];
  return (row?.count ?? 0) > 0;
}

export async function getAllUsers() {
  const result = await executeSql(
    `SELECT * FROM app_users WHERE deleted = 0 ORDER BY created_at DESC;`
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows;
}

export async function updateUser({ id, name, email, role, password }) {
  const fields = [
    "name = ?",
    "email = ?",
    "role = ?",
    "updated_at = datetime('now')",
    "pending_sync = 1"
  ];
  const params = [
    name.trim(),
    email.trim().toLowerCase(),
    role || "USER"
  ];

  if (password && password.trim()) {
    fields.splice(3, 0, "password = ?");
    params.splice(3, 0, password);
  }

  params.push(id);

  await executeSql(
    `UPDATE app_users
     SET ${fields.join(", ")}
     WHERE id = ?;`,
    params
  );

  return getUserById(id);
}

export async function deleteUser(id) {
  await executeSql(
    `UPDATE app_users
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [id]
  );
}
