import React, { createContext, useContext, useState, useMemo } from "react";
import {
  createUser,
  getUserByEmailAndPassword,
  getUserByEmail
} from "../db/userRepository";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  async function login(email, password) {
    setLoading(true);
    try {
      const found = await getUserByEmailAndPassword(email, password);
      if (!found) {
        throw new Error("Correo o contraseña incorrectos");
      }
      setUser(found);
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

  function logout() {
    setUser(null);
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
