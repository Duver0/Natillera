import { Platform } from "react-native";
import { executeSql } from "./database";
import { supabase } from "./supabaseClient";
import syncManager from "./syncManager";

export async function createClient({ ownerId, name, documentId, phone }) {
  const clientData = {
    owner_id: ownerId,
    name: name.trim(),
    document_id: documentId?.trim() || null,
    phone: phone?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Mobile: guardar localmente y agregar a cola de sincronización
  const result = await executeSql(
    `INSERT INTO clients (owner_id, name, document_id, phone, created_at, updated_at, pending_sync)
     VALUES (?, ?, ?, ?, ?, ?, 1);`,
    [ownerId, name.trim(), documentId?.trim() || null, phone?.trim() || null, clientData.created_at, clientData.updated_at]
  );
  
  const id = result.insertId;
  
  // Agregar a cola de sincronización
  await syncManager.addToQueue({
    table: 'clients',
    action: 'insert',
    data: { id, ...clientData }
  });

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
  const updateData = {
    id,
    name: name.trim(),
    document_id: documentId?.trim() || null,
    phone: phone?.trim() || null,
    updated_at: new Date().toISOString()
  };

  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Mobile: actualizar localmente y agregar a cola
  await executeSql(
    `UPDATE clients
     SET name = ?,
         document_id = ?,
         phone = ?,
         updated_at = ?,
         pending_sync = 1
     WHERE id = ?;`,
    [name.trim(), documentId?.trim() || null, phone?.trim() || null, updateData.updated_at, id]
  );

  // Agregar a cola de sincronización
  await syncManager.addToQueue({
    table: 'clients',
    action: 'update',
    data: updateData
  });

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
