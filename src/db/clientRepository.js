import { Platform } from "react-native";
import { executeSql } from "./database";
import { supabase } from "./supabaseClient";

export async function createClient({ ownerId, name, documentId, phone }) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        owner_id: ownerId,
        name: name.trim(),
        document_id: documentId?.trim() || null,
        phone: phone?.trim() || null
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  const result = await executeSql(
    `INSERT INTO clients (owner_id, name, document_id, phone, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 1);`,
    [ownerId, name.trim(), documentId?.trim() || null, phone?.trim() || null]
  );
  const id = result.insertId;
  return getClientById(id);
}

export async function getClientById(id) {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('deleted', 0)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  const result = await executeSql(
    `SELECT * FROM clients WHERE id = ? AND deleted = 0 LIMIT 1;`,
    [id]
  );
  const rows = result.rows?._array ?? result.rows._array ?? [];
  return rows[0] || null;
}

export async function getClientsByOwner(ownerId) {
  if (Platform.OS === 'web') {
    let query = supabase
      .from('clients')
      .select('*')
      .eq('deleted', 0)
      .order('created_at', { ascending: false });
    
    if (ownerId !== null) {
      query = query.eq('owner_id', ownerId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

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
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: name.trim(),
        document_id: documentId?.trim() || null,
        phone: phone?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

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
  if (Platform.OS === 'web') {
    const { error } = await supabase
      .from('clients')
      .update({
        deleted: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) throw error;
    return;
  }

  await executeSql(
    `UPDATE clients
     SET deleted = 1,
         updated_at = datetime('now'),
         pending_sync = 1
     WHERE id = ?;`,
    [id]
  );
}
