import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Button,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import {
  useNavigation,
  useRoute,
  useIsFocused
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import {
  createClient,
  getClientsByOwner,
  updateClient,
  deleteClient
} from "../db/clientRepository";
import { getClientLoanAndSavingsCounts } from "../db/clientStatsRepository";

export default function ClientsScreen() {
  const { user, isAdmin } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statsByClientId, setStatsByClientId] = useState({});
  const [name, setName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [phone, setPhone] = useState("");
  const nameInputRef = useRef(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDocumentId, setEditDocumentId] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    if (user && isFocused) {
      loadClientsWithStats();
    }
  }, [user, isFocused]);

  useEffect(() => {
    if (route.params?.autoOpenForm) {
      setShowForm(true);
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }
  }, [route.params]);

  async function loadClientsWithStats() {
    if (!user) return;
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        isAdmin ? getClientsByOwner(null) : getClientsByOwner(user.id),
        getClientLoanAndSavingsCounts(isAdmin ? null : user.id)
      ]);
      const map = {};
      for (const s of stats) {
        map[s.client_id] = {
          loansCount: s.loans_count || 0,
          savingsDepositsCount: s.savings_deposits_count || 0
        };
      }
      setClients(list);
      setStatsByClientId(map);
    } catch (error) {
      console.error("Error cargando clientes", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadClientsWithStats();
    setRefreshing(false);
  }

  async function handleCreateClient() {
    if (!name.trim()) {
      return;
    }
    try {
      await createClient({
        ownerId: user.id,
        name,
        documentId,
        phone
      });
      await loadClientsWithStats();
      setName("");
      setDocumentId("");
      setPhone("");
    } catch (error) {
      console.error("Error creando cliente", error);
    }
  }

  function openEditClientModal(client) {
    setSelectedClient(client);
    setEditName(client.name || "");
    setEditDocumentId(client.document_id || "");
    setEditPhone(client.phone || "");
    setEditModalVisible(true);
  }

  function closeEditClientModal() {
    setEditModalVisible(false);
    setSelectedClient(null);
    setEditName("");
    setEditDocumentId("");
    setEditPhone("");
  }

  async function handleSaveClient() {
    if (!selectedClient) return;
    if (!editName.trim()) return;
    try {
      await updateClient({
        id: selectedClient.id,
        name: editName,
        documentId: editDocumentId,
        phone: editPhone
      });
      await loadClientsWithStats();
      closeEditClientModal();
    } catch (error) {
      console.error("Error actualizando cliente", error);
    }
  }

  function handleDeleteClient(client) {
    if (!isAdmin && client.owner_id !== user.id) {
      return;
    }
    Alert.alert(
      "Eliminar cliente",
      `¿Seguro que deseas eliminar a ${client.name}? Esta acción ocultará sus datos de la vista.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteClient(client.id);
              await loadClientsWithStats();
            } catch (error) {
              console.error("Error eliminando cliente", error);
            }
          }
        }
      ]
    );
  }

  function renderClient({ item }) {
    const stats = statsByClientId[item.id] || {
      loansCount: 0,
      savingsDepositsCount: 0
    };
    return (
      <View style={styles.clientItem}>
        <View style={styles.clientTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName}>{item.name}</Text>
            {item.document_id ? (
              <Text style={styles.clientDetail}>Doc: {item.document_id}</Text>
            ) : null}
            {item.phone ? (
              <Text style={styles.clientDetail}>Tel: {item.phone}</Text>
            ) : null}
          </View>
          <View style={styles.clientStats}>
            <Text style={styles.clientStatText}>
              Créditos: {stats.loansCount}
            </Text>
            <Text style={styles.clientStatText}>
              Ahorros: {stats.savingsDepositsCount}
            </Text>
            {isAdmin && (
              <View style={styles.clientActionsIcons}>
                <TouchableOpacity
                  style={styles.clientIconButton}
                  onPress={() => openEditClientModal(item)}
                >
                  <Ionicons name="pencil" size={16} color="#1976d2" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.clientIconButton}
                  onPress={() => handleDeleteClient(item)}
                >
                  <Ionicons name="trash" size={16} color="#d32f2f" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.clientActionsRow}>
          <TouchableOpacity
            style={styles.clientLoanButton}
            onPress={() =>
              navigation.navigate("NewLoan", {
                clientId: item.id
              })
            }
          >
            <Ionicons name="cash" size={16} color="#1976d2" />
            <Text style={styles.clientLoanText}>Nuevo préstamo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clientSavingsButton}
            onPress={() =>
              navigation.navigate("ClientSavings", {
                clientId: item.id,
                clientName: item.name
              })
            }
          >
            <Ionicons name="wallet" size={16} color="#388e3c" />
            <Text style={styles.clientSavingsText}>Ahorro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const filteredClients = clients.filter((client) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (client.name || "").toLowerCase().includes(term) ||
      (client.document_id || "").toLowerCase().includes(term) ||
      (client.phone || "").toLowerCase().includes(term)
    );
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Clientes</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowForm((prev) => !prev)}
          >
            <Ionicons
              name={showForm ? "close" : "person-add"}
              size={20}
              color="#1976d2"
            />
            <Text style={styles.headerButtonText}>
              {showForm ? "Cerrar" : "Nuevo"}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, documento o teléfono"
          value={search}
          onChangeText={setSearch}
        />

        {showForm && (
          <View style={styles.form}>
            <TextInput
              ref={nameInputRef}
              style={styles.input}
              placeholder="Nombre del cliente"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Documento (opcional)"
              value={documentId}
              onChangeText={setDocumentId}
            />
            <TextInput
              style={styles.input}
              placeholder="Teléfono (opcional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Button title="Guardar cliente" onPress={handleCreateClient} />
          </View>
        )}

        <FlatList
          data={filteredClients}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderClient}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            !loading && (
              <Text style={styles.emptyText}>
                Aún no tienes clientes creados.
              </Text>
            )
          }
          contentContainerStyle={
            clients.length === 0 ? styles.emptyContainer : undefined
          }
          keyboardShouldPersistTaps="handled"
        />
      </View>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditClientModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar cliente</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Documento"
              value={editDocumentId}
              onChangeText={setEditDocumentId}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Teléfono"
              keyboardType="phone-pad"
              value={editPhone}
              onChangeText={setEditPhone}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={closeEditClientModal}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveClient}
              >
                <Text style={styles.modalButtonPrimaryText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "bold"
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerButtonText: {
    marginLeft: 4,
    color: "#1976d2",
    fontSize: 14,
    fontWeight: "500"
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd"
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
  clientItem: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee"
  },
  clientTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  clientStats: {
    alignItems: "flex-end",
    marginLeft: 8
  },
  clientStatText: {
    fontSize: 12,
    color: "#555"
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600"
  },
  clientDetail: {
    fontSize: 14,
    color: "#555",
    marginTop: 2
  },
  clientActionsIcons: {
    flexDirection: "row",
    marginTop: 4
  },
  clientIconButton: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  clientActionsRow: {
    flexDirection: "row",
    marginTop: 6
  },
  clientLoanButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12
  },
  clientLoanText: {
    marginLeft: 4,
    fontSize: 13,
    color: "#1976d2",
    fontWeight: "500"
  },
  clientSavingsButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  clientSavingsText: {
    marginLeft: 4,
    fontSize: 13,
    color: "#388e3c",
    fontWeight: "500"
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  emptyText: {
    color: "#777"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 8
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 8
  },
  modalButtonSecondary: {
    backgroundColor: "#eee"
  },
  modalButtonPrimary: {
    backgroundColor: "#1976d2"
  },
  modalButtonSecondaryText: {
    color: "#333",
    fontSize: 14
  },
  modalButtonPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  }
});
