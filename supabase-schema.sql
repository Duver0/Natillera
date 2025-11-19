-- Script SQL para crear las tablas en Supabase
-- Ejecuta esto en el SQL Editor de Supabase Dashboard

-- Tabla de usuarios de la aplicación
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT REFERENCES app_users(id),
  name TEXT NOT NULL,
  document_id TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0
);

-- Tabla de cuentas de ahorro
CREATE TABLE IF NOT EXISTS savings_accounts (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  interest_rate REAL NOT NULL DEFAULT 0,
  liquidated INTEGER NOT NULL DEFAULT 0,
  liquidated_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0
);

-- Tabla de movimientos de ahorro
CREATE TABLE IF NOT EXISTS savings_movements (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES savings_accounts(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0
);

-- Tabla de préstamos
CREATE TABLE IF NOT EXISTS loans (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id),
  principal REAL NOT NULL,
  term_months INTEGER NOT NULL,
  interest_rate REAL NOT NULL,
  interest_type TEXT NOT NULL,
  charge_frequency TEXT NOT NULL DEFAULT 'MONTHLY',
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0
);

-- Tabla de cuotas de préstamos
CREATE TABLE IF NOT EXISTS loan_installments (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES loans(id),
  number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount_capital REAL NOT NULL,
  amount_interest REAL NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  paid_date DATE,
  paid_capital REAL DEFAULT 0,
  paid_interest REAL DEFAULT 0,
  paid_amount REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending_sync INTEGER NOT NULL DEFAULT 0
);

-- Crear usuario admin por defecto
INSERT INTO app_users (name, email, password, role, created_at, updated_at, pending_sync)
VALUES ('Administrador', 'admin', '1193527117Rosa**', 'ADMIN', NOW(), NOW(), 0)
ON CONFLICT (email) DO NOTHING;

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_client ON savings_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_savings_movements_account ON savings_movements(account_id);
CREATE INDEX IF NOT EXISTS idx_loans_client ON loans(client_id);
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan ON loan_installments(loan_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_installments ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad (permiso total para pruebas - ajustar en producción)
CREATE POLICY "Enable all for users" ON app_users FOR ALL USING (true);
CREATE POLICY "Enable all for clients" ON clients FOR ALL USING (true);
CREATE POLICY "Enable all for savings_accounts" ON savings_accounts FOR ALL USING (true);
CREATE POLICY "Enable all for savings_movements" ON savings_movements FOR ALL USING (true);
CREATE POLICY "Enable all for loans" ON loans FOR ALL USING (true);
CREATE POLICY "Enable all for loan_installments" ON loan_installments FOR ALL USING (true);
