import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Obtener las URLs y keys de Supabase desde las variables de entorno
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Crear el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper para verificar si estamos en web o móvil
export const isWeb = typeof window !== 'undefined' && window.document;

// Helper para manejar errores de Supabase
export function handleSupabaseError(error) {
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message || 'Database operation failed');
  }
}

// Helper para convertir resultados de Supabase al formato esperado
export function formatSupabaseResult(data, isArray = true) {
  if (!data) return isArray ? [] : null;
  return data;
}
