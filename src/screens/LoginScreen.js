import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
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
  const isWeb = Platform.OS === "web"; // Web usa layout distinto para aprovechar ancho

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
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-3xl font-bold text-slate-900">Natillera</Text>
        <Text className="mt-2 text-base text-slate-500">Cargando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className={`flex-1 items-center justify-center px-6 ${
            isWeb ? "py-12 md:px-12" : "pb-16 pt-12"
          }`}
        >
          <View
            className={`w-full ${
              isWeb ? "max-w-5xl flex-col gap-8 md:flex-row" : "max-w-md"
            }`}
          >
            {isWeb && (
              <View className="hidden flex-1 rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-10 shadow-2xl shadow-brand-200 md:flex">
                <View className="flex-1 justify-between">
                  <View>
                    <Text className="text-4xl font-semibold text-white">Natillera</Text>
                    <Text className="mt-4 text-lg text-brand-50">
                      Gestiona aportes, préstamos y reportes desde un mismo panel sin perder el enfoque mobile first.
                    </Text>
                  </View>

                  <View className="mt-10 space-y-4">
                    <Text className="text-sm uppercase tracking-widest text-brand-100">
                      Beneficios
                    </Text>
                    <Text className="text-base text-white">• Sesiones seguras sincronizadas con Supabase.</Text>
                    <Text className="text-base text-white">• Optimizada para Android y Web desde un solo código.</Text>
                    <Text className="text-base text-white">• Datos accesibles incluso cuando estás en movimiento.</Text>
                  </View>
                </View>
              </View>
            )}

            <View
              className={`rounded-[32px] border border-slate-200 bg-white/90 shadow-xl ${
                isWeb ? "flex-1 p-8 backdrop-blur md:p-10" : "w-full p-6"
              }`}
            >
              <View className="items-center">
                <View className="mb-6 h-24 w-24 items-center justify-center rounded-3xl bg-brand-50 shadow-inner">
                  <Text className="text-5xl">📱</Text>
                </View>
                <Text className="text-3xl font-black text-slate-900 md:text-4xl">Natillera</Text>
                <Text className="mt-2 text-base text-slate-500 md:text-lg">Iniciar sesión</Text>
              </View>

              <View className="mt-8 gap-6">
                <View>
                  <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Correo
                  </Text>
                  <TextInput
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm"
                    placeholder="correo@ejemplo.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View>
                  <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Contraseña
                  </Text>
                  <TextInput
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm"
                    placeholder="••••••••"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <TouchableOpacity
                className={`mt-8 w-full rounded-2xl bg-brand-600 py-3 ${
                  loading ? "opacity-60" : "active:bg-brand-500"
                }`}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text className="text-center text-base font-semibold uppercase tracking-wide text-white">
                  {loading ? "Ingresando..." : "Ingresar"}
                </Text>
              </TouchableOpacity>

              <Text className="mt-6 text-center text-sm text-slate-500 md:text-base">
                Ingresa con tu usuario y contraseña para continuar.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
