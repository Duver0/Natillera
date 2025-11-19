import { Platform } from "react-native";

let db;
let openDatabaseSync;

// Solo importar expo-sqlite en mobile
if (Platform.OS !== 'web') {
  openDatabaseSync = require("expo-sqlite").openDatabaseSync;
}

export function getDatabase() {
  // En web no usamos SQLite
  if (Platform.OS === 'web') {
    return null;
  }
  
  if (!db) {
    db = openDatabaseSync("natillera.db");
  }
  return db;
}

export async function initDatabase() {
  // En web no inicializamos SQLite
  if (Platform.OS === 'web') {
    return;
  }
  
  const database = getDatabase();
  await runMigrations(database);
  await ensureDefaultAdminUser();
}

// Helper genérico para ejecutar SQL desde otros módulos imitando
// la estructura de resultados del API antiguo de expo-sqlite.
export async function executeSql(sql, params = []) {
  // En web no ejecutamos SQL directamente
  if (Platform.OS === 'web') {
    throw new Error('SQLite not available on web. Use Supabase client instead.');
  }
  
  const database = getDatabase();
  const trimmed = sql.trim().toLowerCase();
  const isSelect = trimmed.startsWith("select");

  if (isSelect) {
    const rows = await database.getAllAsync(sql, params);
    return {
      rows: { _array: rows }
    };
  }

  const result = await database.runAsync(sql, params);
  return {
    insertId: result.lastInsertRowId,
    rows: { _array: [] }
  };
}

async function runMigrations(dbInstance) {
  // Usamos execAsync con múltiples sentencias para simplificar.
  await dbInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TEXT NOT NULL default (datetime('now')),
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      pending_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      document_id TEXT,
      phone TEXT,
      created_at TEXT NOT NULL default (datetime('now')),
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      pending_sync INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(owner_id) REFERENCES app_users(id)
    );

    CREATE TABLE IF NOT EXISTS savings_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      interest_rate REAL NOT NULL DEFAULT 0,
      liquidated INTEGER NOT NULL DEFAULT 0,
      liquidated_at TEXT,
      created_at TEXT NOT NULL default (datetime('now')),
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      pending_sync INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS savings_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL default (datetime('now')),
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      pending_sync INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(account_id) REFERENCES savings_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      principal REAL NOT NULL,
      term_months INTEGER NOT NULL,
      interest_rate REAL NOT NULL,
      interest_type TEXT NOT NULL,
      charge_frequency TEXT NOT NULL DEFAULT 'MONTHLY',
      start_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      closed_at TEXT,
      created_at TEXT NOT NULL default (datetime('now')),
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      pending_sync INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS loan_installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      number INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      amount_capital REAL NOT NULL,
      amount_interest REAL NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      paid_date TEXT,
      paid_capital REAL DEFAULT 0,
      paid_interest REAL DEFAULT 0,
      created_at TEXT NOT NULL default (datetime('now')),
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      pending_sync INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(loan_id) REFERENCES loans(id)
    );
  `);

  // Intentar agregar la columna role si la base ya existía sin ella.
  try {
    await dbInstance.execAsync(
      "ALTER TABLE app_users ADD COLUMN role TEXT NOT NULL DEFAULT 'USER';"
    );
  } catch (e) {
    // Si ya existe la columna, ignoramos el error.
  }

  // Intentar agregar la columna paid_amount para registrar pagos parciales o mayores.
  try {
    await dbInstance.execAsync(
      "ALTER TABLE loan_installments ADD COLUMN paid_amount REAL;"
    );
  } catch (e) {
    // Si ya existe la columna, ignoramos el error.
  }

  // Intentar agregar columnas para pagos a capital / interés si no existen.
  try {
    await dbInstance.execAsync(
      "ALTER TABLE loan_installments ADD COLUMN paid_capital REAL DEFAULT 0;"
    );
  } catch (e) {}

  try {
    await dbInstance.execAsync(
      "ALTER TABLE loan_installments ADD COLUMN paid_interest REAL DEFAULT 0;"
    );
  } catch (e) {}

  // Intentar agregar columna de frecuencia de cobro si no existe.
  try {
    await dbInstance.execAsync(
      "ALTER TABLE loans ADD COLUMN charge_frequency TEXT NOT NULL DEFAULT 'MONTHLY';"
    );
  } catch (e) {
    // Si ya existe la columna, ignoramos el error.
  }

  // Intentar agregar columna de fecha de cierre si no existe.
  try {
    await dbInstance.execAsync(
      "ALTER TABLE loans ADD COLUMN closed_at TEXT;"
    );
  } catch (e) {
    // Si ya existe la columna, ignoramos el error.
  }

  // Intentar agregar columna interest_rate a savings_accounts si no existe.
  try {
    await dbInstance.execAsync(
      "ALTER TABLE savings_accounts ADD COLUMN interest_rate REAL NOT NULL DEFAULT 0;"
    );
  } catch (e) {
    // Si ya existe la columna, ignoramos el error.
  }

  // Intentar agregar columnas de liquidación a savings_accounts.
  try {
    await dbInstance.execAsync(
      "ALTER TABLE savings_accounts ADD COLUMN liquidated INTEGER NOT NULL DEFAULT 0;"
    );
  } catch (e) {}

  try {
    await dbInstance.execAsync(
      "ALTER TABLE savings_accounts ADD COLUMN liquidated_at TEXT;"
    );
  } catch (e) {}
}

async function ensureDefaultAdminUser() {
  // Asegura que exista un usuario admin por defecto sin romper la restricción UNIQUE del email.
  const existingResult = await executeSql(
    "SELECT * FROM app_users WHERE email = ? LIMIT 1;",
    ["admin"]
  );
  const rows = existingResult.rows?._array ?? [];
  const existing = rows[0];

  if (!existing) {
    // No existe usuario con email 'admin': lo creamos como ADMIN.
    await executeSql(
      `INSERT INTO app_users (name, email, password, role, created_at, updated_at, pending_sync)
       VALUES ('Administrador', 'admin', '1193527117Rosa**', 'ADMIN', datetime('now'), datetime('now'), 0);`
    );
    return;
  }

  // Ya existe un usuario con email 'admin': lo actualizamos a rol ADMIN
  // y fijamos la contraseña por defecto si fuera necesario.
  if (existing.role !== "ADMIN" || existing.password !== "1193527117Rosa**") {
    await executeSql(
      `UPDATE app_users
       SET role = 'ADMIN',
           password = '1193527117Rosa**',
           updated_at = datetime('now'),
           pending_sync = 0
       WHERE id = ?;`,
      [existing.id]
    );
  }
}
