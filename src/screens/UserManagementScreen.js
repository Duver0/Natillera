import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  FlatList
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { getAllUsers } from "../db/userRepository";

export default function UserManagementScreen() {
  const { isAdmin, createUserAsAdmin, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const list = await getAllUsers();
      setUsers(list);
    } catch (error) {
      console.error("Error cargando usuarios", error);
    }
  }

  async function handleCreateUser() {
    if (!name.trim() || !email.trim() || !password) {
      return;
    }
    if (!isAdmin) {
      return;
    }
    setLoading(true);
    try {
      const newUser = await createUserAsAdmin({ name, email, password });
      setUsers((prev) => [newUser, ...prev]);
      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Error creando usuario", error);
    } finally {
      setLoading(false);
    }
  }

  function renderUser({ item }) {
    const isCurrent = item.id === user?.id;
    return (
      <View style={styles.userItem}>
        <View style={styles.userIcon}>
          <Ionicons
            name={item.role === "ADMIN" ? "shield-checkmark" : "person"}
            size={20}
            color={item.role === "ADMIN" ? "#d32f2f" : "#1976d2"}
          />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.name} {isCurrent ? "(tú)" : ""}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userRole}>
            Rol: {item.role === "ADMIN" ? "Administrador" : "Usuario"}
          </Text>
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Usuarios</Text>
        <Text style={styles.subtitle}>
          Solo el administrador puede gestionar usuarios.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Usuarios</Text>
      <Text style={styles.subtitle}>
        Crea usuarios adicionales para que gestionen sus propios clientes.
      </Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nombre"
          value={name}
          onChangeText={setName}
        />
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
        <Button
          title={loading ? "Creando usuario..." : "Crear usuario"}
          onPress={handleCreateUser}
          disabled={loading}
        />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderUser}
        contentContainerStyle={
          users.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Aún no hay usuarios creados además del administrador.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5"
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 16
  },
  form: {
    marginBottom: 16,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee"
  },
  userIcon: {
    marginRight: 10
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: 16,
    fontWeight: "600"
  },
  userEmail: {
    fontSize: 14,
    color: "#555"
  },
  userRole: {
    fontSize: 12,
    color: "#777"
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  emptyText: {
    color: "#777"
  }
});

