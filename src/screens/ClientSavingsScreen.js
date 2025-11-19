import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Alert,
  Platform
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  getOrCreateSavingsAccount,
  getSavingsMovements,
  addSavingsMovement,
  updateSavingsInterestRate,
  calculateLiquidation,
  deleteSavingsMovement,
  deleteSavingsAccount,
  markSavingsAccountLiquidated
} from "../db/savingsRepository";
import { formatCurrency, formatCurrencyInput } from "../utils/currency";

export default function ClientSavingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clientId, clientName } = route.params || {};

  const [account, setAccount] = useState(null);
  const [movements, setMovements] = useState([]);
  const [interestRate, setInterestRate] = useState("1");
  const [interestType, setInterestType] = useState("PERCENTAGE");
  const [fixedInterestAmount, setFixedInterestAmount] = useState("");
  const [amount, setAmount] = useState("");
  const [movementDate, setMovementDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liquidationModalVisible, setLiquidationModalVisible] =
    useState(false);
  const [liquidationResult, setLiquidationResult] = useState(null);

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  async function loadData() {
    setLoading(true);
    try {
      const acc = await getOrCreateSavingsAccount(clientId);
      setAccount(acc);
      setInterestRate(String(acc.interest_rate ?? 1));
      const movs = await getSavingsMovements(acc.id);
      setMovements(movs);
    } catch (error) {
      console.error("Error cargando ahorros", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRate() {
    if (!account) return;
    const rateNum = Number(interestRate.replace(",", "."));
    if (Number.isNaN(rateNum)) return;
    try {
      await updateSavingsInterestRate(account.id, rateNum);
      await loadData();
    } catch (error) {
      console.error("Error actualizando tasa de interés", error);
    }
  }

  async function handleAddMovement(type) {
    if (!account) return;
    const value = Number(amount.replace(/[^\d]/g, ""));
    if (!value || value <= 0) return;
    try {
      await addSavingsMovement({
        accountId: account.id,
        type,
        amount: value,
        date: movementDate.toISOString().slice(0, 10)
      });
      setAmount("");
      setMovementDate(new Date());
      await loadData();
    } catch (error) {
      console.error("Error registrando movimiento de ahorro", error);
    }
  }

  function handleDateChange(event, selectedDate) {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setMovementDate(selectedDate);
    }
  }

  async function handleLiquidate() {
    if (!account) return;
    try {
      const customInterest = interestType === "FIXED_AMOUNT" 
        ? Number(fixedInterestAmount.replace(/[^\d]/g, "")) || 0
        : null;
      const result = await calculateLiquidation(account, movements, customInterest);
      setLiquidationResult(result);
      setLiquidationModalVisible(true);
    } catch (error) {
      console.error("Error calculando liquidación", error);
    }
  }

  function renderMovement({ item }) {
    const signo = item.type === "WITHDRAWAL" ? "-" : "+";
    return (
      <View style={styles.movementItem}>
        <View style={{ flex: 1 }}>
          <Text style={styles.movementType}>
            {item.type === "DEPOSIT" ? "Depósito" : "Retiro"}
          </Text>
          <Text style={styles.movementDate}>{item.date}</Text>
        </View>
        <Text
          style={[
            styles.movementAmount,
            item.type === "WITHDRAWAL" && styles.withdrawal
          ]}
        >
          {signo}
          {formatCurrency(item.amount)}
        </Text>
        <TouchableOpacity
          style={styles.deleteMovementButton}
          onPress={() =>
            Alert.alert(
              "Eliminar movimiento",
              "¿Deseas eliminar este movimiento de ahorro?",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Eliminar",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteSavingsMovement(item.id);
                      await loadData();
                    } catch (error) {
                      console.error("Error eliminando movimiento", error);
                    }
                  }
                }
              ]
            )
          }
        >
          <Ionicons name="trash" size={16} color="#d32f2f" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1976d2" />
        </TouchableOpacity>
        <Text style={styles.title}>Ahorro de {clientName}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nuevo movimiento</Text>
        <Text style={styles.label}>Fecha</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar" size={20} color="#1976d2" />
          <Text style={styles.dateText}>
            {movementDate.toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={movementDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}
        <Text style={styles.label}>Monto</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={(text) => setAmount(formatCurrencyInput(text))}
          placeholder="Ej: $ 50.000"
        />
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.depositButton]}
            onPress={() => handleAddMovement("DEPOSIT")}
          >
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.actionText}>Depósito</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.withdrawButton]}
            onPress={() => handleAddMovement("WITHDRAWAL")}
          >
            <Ionicons name="remove-circle" size={18} color="#fff" />
            <Text style={styles.actionText}>Retiro</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Movimientos</Text>
          <TouchableOpacity style={styles.liquidateButton} onPress={handleLiquidate}>
            <Ionicons name="calculator" size={18} color="#fff" />
            <Text style={styles.liquidateText}>Liquidar</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={movements}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMovement}
          ListEmptyComponent={
            !loading && (
              <Text style={styles.emptyText}>
                Aún no hay movimientos de ahorro.
              </Text>
            )
          }
        />
      </View>

      <Modal
        visible={liquidationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLiquidationModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Liquidación de ahorro</Text>
            
            <Text style={styles.label}>Tipo de interés</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  interestType === "PERCENTAGE" && styles.segmentButtonActive
                ]}
                onPress={() => setInterestType("PERCENTAGE")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    interestType === "PERCENTAGE" && styles.segmentTextActive
                  ]}
                >
                  Porcentaje
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  interestType === "FIXED_AMOUNT" && styles.segmentButtonActive
                ]}
                onPress={() => setInterestType("FIXED_AMOUNT")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    interestType === "FIXED_AMOUNT" && styles.segmentTextActive
                  ]}
                >
                  Monto fijo
                </Text>
              </TouchableOpacity>
            </View>

            {interestType === "PERCENTAGE" ? (
              <>
                <Text style={styles.label}>Tasa de interés (%)</Text>
                <View style={styles.rateRowModal}>
                  <TextInput
                    style={styles.inputModal}
                    keyboardType="numeric"
                    value={interestRate}
                    onChangeText={setInterestRate}
                  />
                  <TouchableOpacity
                    style={styles.saveRateButtonModal}
                    onPress={async () => {
                      await handleSaveRate();
                      await handleLiquidate();
                    }}
                  >
                    <Text style={styles.saveRateText}>Recalcular</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Monto de interés</Text>
                <View style={styles.rateRowModal}>
                  <TextInput
                    style={styles.inputModal}
                    keyboardType="numeric"
                    value={fixedInterestAmount}
                    onChangeText={(text) => setFixedInterestAmount(formatCurrencyInput(text))}
                    placeholder="Ej: $ 50.000"
                  />
                  <TouchableOpacity
                    style={styles.saveRateButtonModal}
                    onPress={handleLiquidate}
                  >
                    <Text style={styles.saveRateText}>Recalcular</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {liquidationResult && (
              <>
                <Text style={styles.modalLine}>
                  Aportes:{" "}
                  {formatCurrency(liquidationResult.totalDeposits)}
                </Text>
                <Text style={styles.modalLine}>
                  Retiros:{" "}
                  {formatCurrency(liquidationResult.totalWithdrawals)}
                </Text>
                <Text style={styles.modalLine}>
                  Intereses: {formatCurrency(liquidationResult.interest)}
                </Text>
                <Text style={styles.modalLineTotal}>
                  Total a pagar:{" "}
                  {formatCurrency(liquidationResult.totalToPay)}
                </Text>
              </>
            )}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setLiquidationModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalLiquidateButton}
                onPress={async () => {
                  try {
                    await markSavingsAccountLiquidated(account.id);
                    setLiquidationModalVisible(false);
                    await loadData();
                  } catch (error) {
                    console.error("Error marcando ahorro como liquidado", error);
                  }
                }}
              >
                <Text style={styles.modalLiquidateText}>
                  Confirmar liquidación
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  saveRateButton: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1976d2"
  },
  saveRateText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  deleteAccountButton: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4
  },
  depositButton: {
    backgroundColor: "#388e3c"
  },
  withdrawButton: {
    backgroundColor: "#d32f2f"
  },
  actionText: {
    marginLeft: 6,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  movementItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  movementType: {
    fontSize: 14,
    fontWeight: "500"
  },
  movementDate: {
    fontSize: 12,
    color: "#777"
  },
  movementAmount: {
    fontSize: 16,
    fontWeight: "600"
  },
  withdrawal: {
    color: "#d32f2f"
  },
  deleteMovementButton: {
    marginLeft: 8
  },
  emptyText: {
    fontSize: 13,
    color: "#777",
    marginTop: 4
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  liquidateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#1976d2"
  },
  liquidateText: {
    marginLeft: 4,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600"
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
  modalLine: {
    fontSize: 14,
    marginBottom: 4
  },
  modalLineTotal: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8
  },
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8
  },
  modalCloseButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#eee",
    marginRight: 8
  },
  modalCloseText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600"
  },
  modalLiquidateButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1976d2"
  },
  modalLiquidateText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  rateRowModal: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12
  },
  inputModal: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  saveRateButtonModal: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1976d2"
  },
  saveRateText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  segment: {
    flexDirection: "row",
    marginBottom: 12,
    marginTop: 4
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1976d2",
    alignItems: "center",
    marginRight: 4
  },
  segmentButtonActive: {
    backgroundColor: "#1976d2"
  },
  segmentText: {
    color: "#1976d2",
    fontSize: 13
  },
  segmentTextActive: {
    color: "#fff",
    fontWeight: "600"
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 8
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#333"
  }
});
