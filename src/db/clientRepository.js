import { executeSql } from "./database";

export async function createClient({ ownerId, name, documentId, phone }) {
  const result = await executeSql(
    `INSERT INTO clients (owner_id, name, document_id, phone, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 1);`,
    [ownerId, name.trim(), documentId?.trim() || null, phone?.trim() || null]
  );
  const id = result.insertId;
  return getClientById(id);
}

export async function getClientById(id) {
  const result = await executeSql(
    `SELECT * FROM clients WHERE id = ? AND deleted = 0 LIMIT 1;`,
    [id]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows[0] || null;
}

export async function getClientsByOwner(ownerId) {
  const result = await executeSql(
    `SELECT * FROM clients
     WHERE deleted = 0
       AND (? IS NULL OR owner_id = ?)
     ORDER BY created_at DESC;`,
    [ownerId, ownerId]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows;
}

export async function updateClient({ id, name, documentId, phone }) {
  await executeSql(
    `UPDATE clients
     SET name = ?,
         document_id = ?,
         phone = ?,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [name.trim(), documentId?.trim() || null, phone?.trim() || null, id]
  );

  return getClientById(id);
}

export async function deleteClient(id) {
  await executeSql(
    `UPDATE clients
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [id]
  );
}
