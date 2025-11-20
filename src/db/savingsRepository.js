import { Platform } from "react-native";
import { executeSql } from "./database";
import { supabase } from "./supabaseClient";
import syncManager from "./syncManager";

export async function getOrCreateSavingsAccount(clientId) {
  if (Platform.OS === 'web') {
    const { data: existing } = await supabase
      .from('savings_accounts')
      .select('*')
      .eq('client_id', clientId)
      .eq('deleted', 0)
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (existing && existing[0]) return existing[0];
    
    const { data, error } = await supabase
      .from('savings_accounts')
      .insert({
        client_id: clientId,
        name: "Ahorro principal",
        interest_rate: 1
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

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
  
  // Agregar a cola de sincronización
  await syncManager.addToQueue({
    table: 'savings_accounts',
    action: 'insert',
    data: {
      id,
      client_id: clientId,
      name: "Ahorro principal",
      interest_rate: 1,
      created_at: createdAt,
      updated_at: createdAt,
      deleted: 0
    }
  });
  
  const result = await executeSql(
    `SELECT * FROM savings_accounts WHERE id = ?;`,
    [id]
  );
  const newRows = result.rows?._array ?? [];
  return newRows[0] || null;
}

export async function updateSavingsInterestRate(accountId, rate) {
  if (Platform.OS === 'web') {
    const { error } = await supabase
      .from('savings_accounts')
      .update({
        interest_rate: Number(rate) || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId);
    
    if (error) throw error;
    return;
  }

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
  const movementData = {
    account_id: accountId,
    type,
    amount: Number(amount) || 0,
    date,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted: 0
  };

  if (Platform.OS === 'web') {
    const { error } = await supabase
      .from('savings_movements')
      .insert(movementData);
    
    if (error) throw error;
    return;
  }

  const createdAt = new Date().toISOString();
  await executeSql(
    `INSERT INTO savings_movements (
      account_id, type, amount, date, created_at, updated_at, deleted, pending_sync
    )
    VALUES (?, ?, ?, ?, ?, ?, 0, 1);`,
    [accountId, type, Number(amount) || 0, date, createdAt, createdAt]
  );

  // Agregar a cola de sincronización
  await syncManager.addToQueue({
    table: 'savings_movements',
    action: 'insert',
    data: movementData
  });
}

export async function getSavingsMovements(accountId) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('savings_movements')
      .select('*')
      .eq('account_id', accountId)
      .eq('deleted', 0)
      .order('date', { ascending: true })
      .order('id', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  const result = await executeSql(
    `SELECT * FROM savings_movements
     WHERE account_id = ? AND deleted = 0
     ORDER BY date ASC, id ASC;`,
    [accountId]
  );
  const rows = result.rows?._array ?? [];
  return rows;
}

export async function calculateLiquidation(account, movements, customInterest = null) {
  const rate = Number(account.interest_rate) || 0;

  let totalDeposits = 0;
  let totalWithdrawals = 0;

  for (const m of movements) {
    const amt = Number(m.amount) || 0;
    if (m.type === "DEPOSIT") totalDeposits += amt;
    else if (m.type === "WITHDRAWAL") totalWithdrawals += amt;
  }

  const balance = totalDeposits - totalWithdrawals;

  // Si se proporciona customInterest (monto fijo), usarlo.
  // De lo contrario, calcular interés como porcentaje sobre el balance actual.
  let interest = 0;
  if (customInterest !== null) {
    interest = Number(customInterest) || 0;
  } else {
    const rawInterest = balance * (rate / 100);
    interest = rawInterest > 0 ? Math.ceil(rawInterest) : 0;
  }
  
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
  
  if (Platform.OS === 'web') {
    const { error } = await supabase
      .from('savings_accounts')
      .update({
        liquidated: 1,
        liquidated_at: today,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId);
    
    if (error) throw error;
    return;
  }

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
  if (Platform.OS === 'web') {
    const { error } = await supabase
      .from('savings_movements')
      .update({
        deleted: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) throw error;
    return;
  }

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
  if (Platform.OS === 'web') {
    const now = new Date().toISOString();
    
    const { error: accountError } = await supabase
      .from('savings_accounts')
      .update({ deleted: 1, updated_at: now })
      .eq('id', accountId);
    
    if (accountError) throw accountError;
    
    const { error: movementsError } = await supabase
      .from('savings_movements')
      .update({ deleted: 1, updated_at: now })
      .eq('account_id', accountId);
    
    if (movementsError) throw movementsError;
    return;
  }

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
