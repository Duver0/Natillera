import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDatabase } from "./src/db/database";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";

// Importar NetInfo solo en mobile
let NetInfo = null;
let syncManager = null;
if (Platform.OS !== 'web') {
  try {
    NetInfo = require("@react-native-community/netinfo").default;
  } catch (e) {
    // NetInfo no disponible en web
  }
  try {
    syncManager = require("./src/db/syncManager").default;
  } catch (e) {
    // SyncManager no disponible en web
  }
}

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // En web no inicializamos SQLite, usamos Supabase directamente
    if (Platform.OS === 'web') {
      setDbInitialized(true);
      return;
    }
    
    // En móvil usamos SQLite
    initDatabase()
      .then(() => {
        setDbInitialized(true);
      })
      .catch((err) => {
        console.error("Error initializing database:", err);
        setError(err.message);
      });
  }, []);

  // Monitorear conexión a internet en mobile
  useEffect(() => {
    if (Platform.OS === 'web' || !NetInfo || !syncManager) return;

    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable;
      syncManager.setOnlineStatus(isConnected);
      
      if (isConnected) {
        console.log('[App] Conexión detectada, sincronizando...');
        syncManager.syncQueue();
      }
    });

    return () => unsubscribe();
  }, []);

  if (!dbInitialized) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.title}>Natillera App</Text>
        {error ? (
          <Text style={styles.error}>❌ Error: {error}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.text}>Inicializando base de datos...</Text>
          </>
        )}
        <Text style={styles.subtitle}>v1.0.0</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  text: {
    fontSize: 18,
    color: "#666",
    marginBottom: 10,
    textAlign: "center",
  },
  error: {
    fontSize: 16,
    color: "#d32f2f",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 20,
  },
});
