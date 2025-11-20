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
  ScrollView,
  Image,
  useWindowDimensions,
  Dimensions
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkedUsers] = useState(true);
  const { width, height } = useWindowDimensions();
  
  // Detectar si está en modo desktop (ancho > 600px)
  const isDesktop = width > 600;
  const isMobile = width <= 600;

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
        contentContainerStyle={[
          styles.container,
          isDesktop && styles.containerDesktop
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formWrapper, isDesktop && styles.formWrapperDesktop]}>
          <View style={[styles.logo, isDesktop && styles.logoDesktop, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ fontSize: 60 }}>📱</Text>
          </View>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
            Natillera
          </Text>
          <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
            Iniciar sesión
          </Text>

          <TextInput
            style={[
              styles.input,
              isDesktop && styles.inputDesktop,
              isMobile && styles.inputMobile
            ]}
            placeholder="Correo"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="#999"
          />

          <TextInput
            style={[
              styles.input,
              isDesktop && styles.inputDesktop,
              isMobile && styles.inputMobile
            ]}
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#999"
          />

          <View style={[styles.buttonContainer, isDesktop && styles.buttonContainerDesktop]}>
            <Button
              title={loading ? "Ingresando..." : "Ingresar"}
              onPress={handleLogin}
              disabled={loading}
            />
          </View>

          <Text style={[styles.info, isDesktop && styles.infoDesktop]}>
            Ingresa con tu usuario y contraseña para continuar.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f5",
    minHeight: "100%"
  },
  containerDesktop: {
    padding: 40,
    minHeight: "100vh"
  },
  formWrapper: {
    width: "100%",
    maxWidth: 400,
    alignItems: "stretch"
  },
  formWrapperDesktop: {
    maxWidth: 350,
    backgroundColor: "#fff",
    padding: 48,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: "center",
    marginBottom: 16
  },
  logoDesktop: {
    width: 140,
    height: 140,
    marginBottom: 24
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
    color: "#333"
  },
  titleDesktop: {
    fontSize: 32,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    color: "#666"
  },
  subtitleDesktop: {
    fontSize: 18,
    marginBottom: 32,
    color: "#555"
  },
  info: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    color: "#666",
    lineHeight: 20
  },
  infoDesktop: {
    fontSize: 15,
    marginTop: 24,
    color: "#777"
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#333"
  },
  inputMobile: {
    paddingVertical: 14,
    marginBottom: 12
  },
  inputDesktop: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    borderColor: "#ccc"
  },
  buttonContainer: {
    marginTop: 12,
    marginBottom: 20,
    overflow: "hidden",
    borderRadius: 8
  },
  buttonContainerDesktop: {
    marginTop: 24,
    marginBottom: 28,
    minHeight: 48
  },
  link: {
    color: "#0066cc",
    textAlign: "center"
  }
});
