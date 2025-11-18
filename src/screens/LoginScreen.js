import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkedUsers] = useState(true);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Campos requeridos", "Ingresa correo y contraseña.");
      return;
    }
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert("No se pudo iniciar sesión", error.message);
    }
  }

  if (!checkedUsers) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Natillera</Text>
        <Text>Cargando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Natillera</Text>
        <Text style={styles.subtitle}>Iniciar sesión</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <View style={styles.buttonContainer}>
          <Button
            title={loading ? "Ingresando..." : "Ingresar"}
            onPress={handleLogin}
            disabled={loading}
          />
        </View>

        <Text style={styles.info}>
          Usuario administrador por defecto: <Text style={styles.bold}>admin</Text>{" "}
          / <Text style={styles.bold}>12345678</Text>. Solo el administrador puede
          crear otros usuarios.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f5"
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 16
  },
  info: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    color: "#555"
  },
  bold: {
    fontWeight: "bold"
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  buttonContainer: {
    marginTop: 4,
    marginBottom: 12
  },
  link: {
    color: "#0066cc",
    textAlign: "center"
  }
});
