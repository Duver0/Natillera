import { Platform } from "react-native";
import { executeSql } from "./database";
import { supabase } from "./supabaseClient";

export async function createUser({ name, email, password }) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('app_users')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: 'USER'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  const result = await executeSql(
    `INSERT INTO app_users (name, email, password, role, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, 'USER', datetime('now'), datetime('now'), 1);`,
    [name.trim(), email.trim().toLowerCase(), password]
  );

  const id = result.insertId;
  return getUserById(id);
}

export async function getUserById(id) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .eq('deleted', 0)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  const result = await executeSql(
    `SELECT * FROM app_users WHERE id = ? AND deleted = 0 LIMIT 1;`,
    [id]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows[0] || null;
}

export async function getUserByEmail(email) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('deleted', 0)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  const result = await executeSql(
    `SELECT * FROM app_users WHERE email = ? AND deleted = 0 LIMIT 1;`,
    [email.trim().toLowerCase()]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows[0] || null;
}

export async function getUserByEmailAndPassword(email, password) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('password', password)
      .eq('deleted', 0)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

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
  if (Platform.OS === 'web') {
    const { count, error } = await supabase
      .from('app_users')
      .select('*', { count: 'exact', head: true })
      .eq('deleted', 0);
    
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  const result = await executeSql(
    `SELECT COUNT(*) as count FROM app_users WHERE deleted = 0;`
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  const row = rows[0];
  return (row?.count ?? 0) > 0;
}

export async function getAllUsers() {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('deleted', 0)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  const result = await executeSql(
    `SELECT * FROM app_users WHERE deleted = 0 ORDER BY created_at DESC;`
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows;
}

export async function updateUser({ id, name, email, role, password }) {
  if (Platform.OS === 'web') {
    const updateData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role || 'USER',
      updated_at: new Date().toISOString()
    };

    if (password && password.trim()) {
      updateData.password = password;
    }

    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

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
  if (Platform.OS === 'web') {
    const { error } = await supabase
      .from('app_users')
      .update({
        deleted: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) throw error;
    return;
  }

  await executeSql(
    `UPDATE app_users
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [id]
  );
}
