import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import supabase from "./supabaseClient";

const SYNC_QUEUE_KEY = "natillera_sync_queue";
const LAST_SYNC_KEY = "natillera_last_sync";

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.isOnline = true;
    this.syncListeners = [];
  }

  /**
   * Agregar operación a la cola de sincronización
   */
  async addToQueue(operation) {
    try {
      const queue = await this.getQueue();
      const newOp = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        ...operation,
      };
      queue.push(newOp);
      
      const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;
      const key = SYNC_QUEUE_KEY;
      const value = JSON.stringify(queue);
      
      if (Platform.OS === 'web') {
        storage.setItem(key, value);
      } else {
        await storage.setItem(key, value);
      }
      
      console.log(`[SyncManager] Operación agregada a cola:`, newOp);
      
      // Intentar sincronizar si estamos online
      if (this.isOnline) {
        this.syncQueue();
      }
      
      return newOp.id;
    } catch (error) {
      console.error('[SyncManager] Error agregando a cola:', error);
    }
  }

  /**
   * Obtener cola de sincronización
   */
  async getQueue() {
    try {
      const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;
      const key = SYNC_QUEUE_KEY;
      let data;
      
      if (Platform.OS === 'web') {
        data = storage.getItem(key);
      } else {
        data = await storage.getItem(key);
      }
      
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[SyncManager] Error obteniendo cola:', error);
      return [];
    }
  }

  /**
   * Sincronizar la cola con Supabase
   */
  async syncQueue() {
    if (this.isSyncing || !this.isOnline) {
      console.log('[SyncManager] Sincronización en progreso o sin conexión');
      return;
    }

    this.isSyncing = true;
    this.notifyListeners('syncing');

    try {
      const queue = await this.getQueue();
      
      if (queue.length === 0) {
        console.log('[SyncManager] Cola vacía');
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncManager] Sincronizando ${queue.length} operaciones...`);

      const successful = [];
      const failed = [];

      for (const operation of queue) {
        try {
          await this.executeOperation(operation);
          successful.push(operation.id);
        } catch (error) {
          console.error('[SyncManager] Error sincronizando operación:', error);
          failed.push({ id: operation.id, error: error.message });
        }
      }

      // Remover operaciones exitosas de la cola
      const updatedQueue = queue.filter(op => !successful.includes(op.id));
      const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;
      const key = SYNC_QUEUE_KEY;
      
      if (Platform.OS === 'web') {
        localStorage.setItem(key, JSON.stringify(updatedQueue));
      } else {
        await AsyncStorage.setItem(key, JSON.stringify(updatedQueue));
      }

      // Guardar timestamp del último sync
      const now = new Date().toISOString();
      if (Platform.OS === 'web') {
        localStorage.setItem(LAST_SYNC_KEY, now);
      } else {
        await AsyncStorage.setItem(LAST_SYNC_KEY, now);
      }

      console.log(`[SyncManager] Sincronización completada: ${successful.length} exitosas, ${failed.length} fallidas`);
      
      this.notifyListeners('synced', { successful, failed });
    } catch (error) {
      console.error('[SyncManager] Error durante sincronización:', error);
      this.notifyListeners('error', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Ejecutar una operación de sincronización
   */
  async executeOperation(operation) {
    const { table, action, data, id: operationId } = operation;

    console.log(`[SyncManager] Ejecutando ${action} en ${table}:`, data);

    switch (action) {
      case 'insert':
        return await supabase.from(table).insert(data);
      
      case 'update':
        const { id, ...updateData } = data;
        return await supabase.from(table).update(updateData).eq('id', id);
      
      case 'delete':
        return await supabase.from(table).delete().eq('id', data.id);
      
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }
  }

  /**
   * Registrar listener para cambios de sincronización
   */
  onSyncStatusChange(callback) {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notificar a los listeners
   */
  notifyListeners(status, data = null) {
    this.syncListeners.forEach(callback => {
      callback(status, data);
    });
  }

  /**
   * Establecer estado de conexión
   */
  setOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    console.log(`[SyncManager] Estado online: ${isOnline}`);
    
    if (isOnline) {
      this.syncQueue();
    }
  }

  /**
   * Obtener estado de la sincronización
   */
  async getSyncStatus() {
    const queue = await this.getQueue();
    const lastSync = await this.getLastSyncTime();
    
    return {
      isSyncing: this.isSyncing,
      isOnline: this.isOnline,
      pendingOperations: queue.length,
      lastSyncTime: lastSync,
    };
  }

  /**
   * Obtener último tiempo de sincronización
   */
  async getLastSyncTime() {
    try {
      const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;
      let lastSync;
      
      if (Platform.OS === 'web') {
        lastSync = storage.getItem(LAST_SYNC_KEY);
      } else {
        lastSync = await storage.getItem(LAST_SYNC_KEY);
      }
      
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('[SyncManager] Error obteniendo último sync:', error);
      return null;
    }
  }

  /**
   * Limpiar cola (uso en desarrollo/testing)
   */
  async clearQueue() {
    try {
      const storage = Platform.OS === 'web' ? localStorage : AsyncStorage;
      const key = SYNC_QUEUE_KEY;
      
      if (Platform.OS === 'web') {
        storage.removeItem(key);
      } else {
        await storage.removeItem(key);
      }
      
      console.log('[SyncManager] Cola limpiada');
    } catch (error) {
      console.error('[SyncManager] Error limpiando cola:', error);
    }
  }
}

export default new SyncManager();
