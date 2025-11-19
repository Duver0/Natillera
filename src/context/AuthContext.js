import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { Platform } from "react-native";
import {
  createUser,
  getUserByEmailAndPassword,
  getUserByEmail
} from "../db/userRepository";

const AuthContext = createContext(null);

const STORAGE_KEY = '@natillera_user';

// Storage helper compatible con web y móvil
const storage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    // Para móvil, necesitaremos AsyncStorage pero por ahora solo web
    return null;
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    }
    // Para móvil, necesitaremos AsyncStorage
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    }
    // Para móvil, necesitaremos AsyncStorage
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === "ADMIN";

  // Cargar usuario guardado al iniciar
  useEffect(() => {
    loadStoredUser();
  }, []);

  async function loadStoredUser() {
    try {
      const userJson = await storage.getItem(STORAGE_KEY);
      if (userJson) {
        const storedUser = JSON.parse(userJson);
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveUser(userData) {
    try {
      const userJson = JSON.stringify(userData);
      await storage.setItem(STORAGE_KEY, userJson);
    } catch (error) {
      console.error('Error saving user:', error);
    }
  }

  async function clearUser() {
    try {
      await storage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing user:', error);
    }
  }

  async function login(email, password) {
    setLoading(true);
    try {
      const found = await getUserByEmailAndPassword(email, password);
      if (!found) {
        throw new Error("Correo o contraseña incorrectos");
      }
      setUser(found);
      await saveUser(found);
      return found;
    } finally {
      setLoading(false);
    }
  }

  async function register({ name, email, password }) {
    setLoading(true);
    try {
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new Error("Ya existe un usuario con este correo");
      }
      const newUser = await createUser({ name, email, password });
      setUser(newUser);
      await saveUser(newUser);
      return newUser;
    } finally {
      setLoading(false);
    }
  }

  async function createUserAsAdmin({ name, email, password }) {
    if (!isAdmin) {
      throw new Error("Solo el administrador puede crear usuarios");
    }
    setLoading(true);
    try {
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new Error("Ya existe un usuario con este correo");
      }
      const newUser = await createUser({ name, email, password });
      return newUser;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setUser(null);
    await clearUser();
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin,
      login,
      register,
      createUserAsAdmin,
      logout
    }),
    [user, loading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
