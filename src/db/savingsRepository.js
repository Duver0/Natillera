import { executeSql } from "./database";

export async function getOrCreateSavingsAccount(clientId) {
  const existing = await executeSql(
    `SELECT * FROM savings_accounts
     WHERE client_id = ? AND deleted = 0
     ORDER BY created_at ASC
     LIMIT 1;`,
    [clientId]
  );
  const rows = existing.rows?._array ?? [];
  if (rows[0]) return rows[0];

  const createdAt = new Date().toISOString();
  const insert = await executeSql(
    `INSERT INTO savings_accounts (client_id, name, interest_rate, created_at, updated_at, deleted, pending_sync)
     VALUES (?, ?, ?, ?, ?, 0, 1);`,
    [clientId, "Ahorro principal", 1, createdAt, createdAt]
  );
  const id = insert.insertId;
  const result = await executeSql(
    `SELECT * FROM savings_accounts WHERE id = ?;`,
    [id]
  );
  const newRows = result.rows?._array ?? [];
  return newRows[0] || null;
}

export async function updateSavingsInterestRate(accountId, rate) {
  await executeSql(
    `UPDATE savings_accounts
     SET interest_rate = ?, updated_at = datetime('now'), pending_sync = 1
     WHERE id = ?;`,
    [Number(rate) || 0, accountId]
  );
}

export async function addSavingsMovement({
  accountId,
  type,
  amount,
  date
}) {
  const createdAt = new Date().toISOString();
  await executeSql(
    `INSERT INTO savings_movements (
      account_id, type, amount, date, created_at, updated_at, deleted, pending_sync
    )
    VALUES (?, ?, ?, ?, ?, ?, 0, 1);`,
    [accountId, type, Number(amount) || 0, date, createdAt, createdAt]
  );
}

export async function getSavingsMovements(accountId) {
  const result = await executeSql(
    `SELECT * FROM savings_movements
     WHERE account_id = ? AND deleted = 0
     ORDER BY date ASC, id ASC;`,
    [accountId]
  );
  const rows = result.rows?._array ?? [];
  return rows;
}

export async function calculateLiquidation(account, movements, asOfDate) {
  const rate = Number(account.interest_rate) || 0;

  let totalDeposits = 0;
  let totalWithdrawals = 0;

  for (const m of movements) {
    const amt = Number(m.amount) || 0;
    if (m.type === "DEPOSIT") totalDeposits += amt;
    else if (m.type === "WITHDRAWAL") totalWithdrawals += amt;
  }

  const balance = totalDeposits - totalWithdrawals;

  // Interés calculado sobre el total ahorrado (aportes),
  // independientemente del tiempo y de los retiros posteriores.
  const rawInterest = totalDeposits * (rate / 100);
  // Redondear intereses hacia arriba a pesos enteros.
  const interest = rawInterest > 0 ? Math.ceil(rawInterest) : 0;
  const totalToPay = balance + interest;

  return {
    totalDeposits,
    totalWithdrawals,
    interest,
    totalToPay,
    balance
  };
}

export async function markSavingsAccountLiquidated(accountId) {
  const today = new Date().toISOString().slice(0, 10);
  await executeSql(
    `UPDATE savings_accounts
     SET liquidated = 1,
         liquidated_at = ?,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [today, accountId]
  );
}

export async function deleteSavingsMovement(id) {
  await executeSql(
    `UPDATE savings_movements
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [id]
  );
}

export async function deleteSavingsAccount(accountId) {
  await executeSql(
    `UPDATE savings_accounts
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [accountId]
  );

  await executeSql(
    `UPDATE savings_movements
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE account_id = ?;`,
    [accountId]
  );
}
