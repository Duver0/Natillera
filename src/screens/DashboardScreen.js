import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import IconWrapper from "../components/IconWrapper";
import PendingInstallmentsList from "../components/PendingInstallmentsList";
import {
  getPendingInstallmentsByOwner,
  markInstallmentPaid,
  getRemainingInterestForLoan,
  payInterestForLoan
} from "../db/loanRepository";
import { formatCurrencyInput } from "../utils/currency";
import { getAllUsers, updateUser, deleteUser } from "../db/userRepository";

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user, isAdmin, logout } = useAuth();
  const [pending, setPending] = React.useState([]);
  const [paymentModalVisible, setPaymentModalVisible] = React.useState(false);
  const [selectedInstallment, setSelectedInstallment] = React.useState(null);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentTarget, setPaymentTarget] = React.useState("CAPITAL"); // CAPITAL | INTEREST
  const [users, setUsers] = React.useState([]);
  const [userModalVisible, setUserModalVisible] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editRole, setEditRole] = React.useState("USER");
  const [editPassword, setEditPassword] = React.useState("");

  const isFocused = useIsFocused();

  React.useEffect(() => {
    if (user && isFocused) {
      loadPending();
      if (isAdmin) {
        loadUsers();
      }
    }
  }, [user, isFocused]);

  async function loadPending() {
    try {
      const rows = await getPendingInstallmentsByOwner(isAdmin ? null : user.id);
      setPending(rows);
    } catch (error) {
      console.error("Error cargando próximas cuotas", error);
    }
  }

  async function loadUsers() {
    try {
      const all = await getAllUsers();
      setUsers(all);
    } catch (error) {
      console.error("Error cargando usuarios", error);
    }
  }

  function handleCreateClient() {
    navigation.navigate("Clientes", { autoOpenForm: true });
  }

  function handleCreateUser() {
    navigation.navigate("UserManagement");
  }

  function handleGoToClients() {
    navigation.navigate("Clientes");
  }

  function handleOpenLoan(item) {
    navigation.navigate("LoanDetail", { loanId: item.loan_id });
  }

  function openPaymentModal(item) {
    const total =
      (Number(item.amount_capital) || 0) +
      (Number(item.amount_interest) || 0);
    const { maxForInstallment } = getPaymentLimits(item, "BOTH");
    const initialAmount = maxForInstallment || total;
    setSelectedInstallment(item);
    setPaymentAmount(formatCurrencyInput(String(initialAmount)));
    setPaymentModalVisible(true);
  }

  function closePaymentModal() {
    setPaymentModalVisible(false);
    setSelectedInstallment(null);
    setPaymentAmount("");
    setPaymentTarget("CAPITAL");
  }

  function getPaymentLimits(installment, target) {
    if (!installment) {
      return {
        remainingCapital: 0,
        remainingInterest: 0,
        maxForInstallment: 0,
        totalExpected: 0
      };
    }

    const baseCapital = Number(installment.amount_capital) || 0;
    const baseInterest = Number(installment.amount_interest) || 0;

    const prevPaidCapital =
      installment.paid_capital != null ? Number(installment.paid_capital) : 0;
    const prevPaidInterest =
      installment.paid_interest != null ? Number(installment.paid_interest) : 0;

    const remainingCapital = Math.max(baseCapital - prevPaidCapital, 0);
    const remainingInterest = Math.max(baseInterest - prevPaidInterest, 0);

    let maxForInstallment = remainingCapital + remainingInterest;
    if (target === "CAPITAL") {
      maxForInstallment = remainingCapital;
    } else if (target === "INTEREST") {
      maxForInstallment = remainingInterest;
    }

    const totalExpected = baseCapital + baseInterest;

    return {
      remainingCapital,
      remainingInterest,
      maxForInstallment,
      totalExpected
    };
  }

  function handlePaymentAmountChange(text) {
    const digits = String(text || "").replace(/[^\d]/g, "");
    if (!selectedInstallment) {
      setPaymentAmount(formatCurrencyInput(text));
      return;
    }

    const raw = Number(digits) || 0;
    const { maxForInstallment } = getPaymentLimits(selectedInstallment, paymentTarget);

    // Si no hay nada pendiente para este tipo de pago,
    // dejamos que el usuario escriba libremente y validamos en confirmPayment.
    if (maxForInstallment <= 0) {
      if (!raw) {
        setPaymentAmount("");
      } else {
        setPaymentAmount(formatCurrencyInput(String(raw)));
      }
      return;
    }

    const clamped = Math.min(raw, maxForInstallment);
    if (!clamped) {
      setPaymentAmount("");
    } else {
      setPaymentAmount(formatCurrencyInput(String(clamped)));
    }
  }

  function handleChangePaymentTarget(target) {
    setPaymentTarget(target);
    if (!selectedInstallment) return;

    const { maxForInstallment } = getPaymentLimits(selectedInstallment, target);
    if (!maxForInstallment) {
      setPaymentAmount("");
    } else {
      setPaymentAmount(formatCurrencyInput(String(maxForInstallment)));
    }
  }

  async function confirmPayment() {
    if (!selectedInstallment) return;

    const raw = Number(String(paymentAmount).replace(/[^\d]/g, ""));
    if (!raw || raw <= 0) {
      Alert.alert("Monto inválido", "Ingresa un monto mayor a 0.");
      return;
    }

    // Pagos solo de intereses: aplicar a nivel de préstamo.
    if (paymentTarget === "INTEREST") {
      const loanId = selectedInstallment.loan_id;
      if (!loanId) {
        Alert.alert(
          "Error",
          "No se pudo identificar el préstamo para aplicar el pago de intereses."
        );
        return;
      }

      const remainingInterest = await getRemainingInterestForLoan(loanId);
      const amountGlobal = Math.min(raw, remainingInterest);

      if (!amountGlobal || amountGlobal <= 0) {
        Alert.alert(
          "Sin saldo pendiente",
          "No hay intereses pendientes por pagar en este préstamo."
        );
        return;
      }

      Alert.alert(
        "Confirmar pago",
        "El pago se aplicará a los intereses pendientes del préstamo (posiblemente en varias cuotas). ¿Deseas continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Pagar",
            style: "destructive",
            onPress: async () => {
              try {
                await payInterestForLoan(loanId, amountGlobal, null);
                closePaymentModal();
                await loadPending();
              } catch (error) {
                console.error("Error registrando pago de intereses", error);
              }
            }
          }
        ]
      );
      return;
    }

    const {
      remainingCapital,
      remainingInterest,
      maxForInstallment,
      totalExpected
    } = getPaymentLimits(selectedInstallment, paymentTarget);

    const amountNum = Math.min(raw, maxForInstallment);

    if (!amountNum || amountNum <= 0) {
      const hasInterest = remainingInterest > 0;
      const hasCapital = remainingCapital > 0;
      let reason = "No hay saldo pendiente para este pago.";
      if (paymentTarget === "INTEREST" && !hasInterest) {
        reason = "No hay intereses pendientes por pagar en esta cuota.";
      } else if (paymentTarget === "CAPITAL" && !hasCapital) {
        reason = "No hay capital pendiente por pagar en esta cuota.";
      }
      Alert.alert("Sin saldo pendiente", reason);
      return;
    }

    let message =
      "¿Confirmas el registro del pago de esta cuota?";
    if (Math.abs(amountNum - totalExpected) > 0.01) {
      message =
        "El monto ingresado es diferente al valor de la cuota.\n\n" +
        "¿Deseas registrar este pago de todas formas?";
    }

    Alert.alert("Confirmar pago", message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Pagar",
        style: "destructive",
        onPress: async () => {
          try {
            await markInstallmentPaid(
              selectedInstallment.id,
              null,
              amountNum,
              paymentTarget
            );
            closePaymentModal();
            await loadPending();
          } catch (error) {
            console.error("Error registrando pago", error);
          }
        }
      }
    ]);
  }

  function openEditUserModal(userToEdit) {
    setSelectedUser(userToEdit);
    setEditName(userToEdit.name || "");
    setEditEmail(userToEdit.email || "");
    setEditRole(userToEdit.role || "USER");
    setEditPassword("");
    setUserModalVisible(true);
  }

  function closeUserModal() {
    setUserModalVisible(false);
    setSelectedUser(null);
    setEditName("");
    setEditEmail("");
    setEditRole("USER");
    setEditPassword("");
  }

  async function handleSaveUser() {
    if (!selectedUser) return;
    if (!editName.trim() || !editEmail.trim()) return;
    try {
      await updateUser({
        id: selectedUser.id,
        name: editName,
        email: editEmail,
        role: editRole,
        password: editPassword
      });
      await loadUsers();
      closeUserModal();
    } catch (error) {
      console.error("Error actualizando usuario", error);
    }
  }

  function handleDeleteUser(userToDelete) {
    if (userToDelete.id === user.id) {
      Alert.alert(
        "No permitido",
        "No puedes eliminar tu propio usuario mientras estás conectado."
      );
      return;
    }
    if (userToDelete.role === "ADMIN") {
      Alert.alert(
        "No permitido",
        "Por seguridad, no se permite eliminar usuarios administradores desde aquí."
      );
      return;
    }
    Alert.alert(
      "Eliminar usuario",
      `¿Seguro que deseas eliminar a ${userToDelete.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUser(userToDelete.id);
              await loadUsers();
            } catch (error) {
              console.error("Error eliminando usuario", error);
            }
          }
        }
      ]
    );
  }

  const hasValidPaymentAmount =
    paymentAmount &&
    Number(String(paymentAmount).replace(/[^\d]/g, "")) > 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.title}>Hola, {user?.name || "usuario"}</Text>
          <Text style={styles.subtitle}>
            {isAdmin
              ? "Tienes permisos de administrador."
              : "Tienes permisos de usuario estándar."}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutIconButton} onPress={logout}>
          <IconWrapper name="log-out" size={20} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleCreateClient}
        >
          <IconWrapper name="person-add" size={20} color="#fff" />
          <Text style={styles.actionTextPrimary}>Crear cliente</Text>
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCreateUser}
          >
            <IconWrapper name="person-add-outline" size={20} color="#1976d2" />
            <Text style={styles.actionText}>Crear usuario</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleGoToClients}
          >
            <IconWrapper name="people" size={20} color="#1976d2" />
            <Text style={styles.actionText}>Ver clientes</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Próximos pagos</Text>
      <PendingInstallmentsList
        installments={pending}
        onPressPay={openPaymentModal}
        onPressOpenLoan={handleOpenLoan}
        showClientName
      />

      {isAdmin && (
        <>
          <Text style={styles.sectionTitle}>Usuarios</Text>
          {users.map((u) => (
            <View key={u.id} style={styles.userItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
                <Text style={styles.userRole}>
                  Rol: {u.role === "ADMIN" ? "Administrador" : "Usuario"}
                </Text>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={styles.userEditButton}
                  onPress={() => openEditUserModal(u)}
                >
                  <IconWrapper name="pencil" size={16} color="#1976d2" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.userDeleteButton}
                  onPress={() => handleDeleteUser(u)}
                >
                  <IconWrapper name="trash" size={16} color="#d32f2f" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePaymentModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar pago</Text>
            {selectedInstallment && (
              <>
                <Text style={styles.modalSubtitle}>
                  {selectedInstallment.client_name
                    ? `${selectedInstallment.client_name} · `
                    : ""}
                  Préstamo #{selectedInstallment.loan_id}
                </Text>
                <View style={styles.paymentTargetRow}>
                  <TouchableOpacity
                    style={[
                      styles.paymentTargetButton,
                      paymentTarget === "CAPITAL" &&
                        styles.paymentTargetButtonActive
                    ]}
                    onPress={() => handleChangePaymentTarget("CAPITAL")}
                  >
                    <Text
                      style={[
                        styles.paymentTargetText,
                        paymentTarget === "CAPITAL" &&
                          styles.paymentTargetTextActive
                      ]}
                    >
                      Capital
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentTargetButton,
                      paymentTarget === "INTEREST" &&
                        styles.paymentTargetButtonActive
                    ]}
                    onPress={() => handleChangePaymentTarget("INTEREST")}
                  >
                    <Text
                      style={[
                        styles.paymentTargetText,
                        paymentTarget === "INTEREST" &&
                          styles.paymentTargetTextActive
                      ]}
                    >
                      Interés
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalLabel}>Monto a pagar</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={handlePaymentAmountChange}
                />
                <Text style={styles.modalHint}>
                  Puedes pagar el valor exacto de la cuota o un monto mayor o
                  menor como abono.
                </Text>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={closePaymentModal}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  !hasValidPaymentAmount && styles.modalButtonDisabled
                ]}
                onPress={hasValidPaymentAmount ? confirmPayment : undefined}
                activeOpacity={hasValidPaymentAmount ? 0.7 : 1}
              >
                <Text style={styles.modalButtonPrimaryText}>Confirmar pago</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={userModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeUserModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar usuario</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Correo"
              autoCapitalize="none"
              keyboardType="email-address"
              value={editEmail}
              onChangeText={setEditEmail}
            />
            <Text style={styles.modalLabel}>Rol</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  editRole === "USER" && styles.roleButtonActive
                ]}
                onPress={() => setEditRole("USER")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    editRole === "USER" && styles.roleButtonTextActive
                  ]}
                >
                  Usuario
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  editRole === "ADMIN" && styles.roleButtonActive
                ]}
                onPress={() => setEditRole("ADMIN")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    editRole === "ADMIN" && styles.roleButtonTextActive
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>
              Nueva contraseña (opcional)
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Dejar en blanco para no cambiar"
              secureTextEntry
              value={editPassword}
              onChangeText={setEditPassword}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={closeUserModal}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveUser}
              >
                <Text style={styles.modalButtonPrimaryText}>Guardar</Text>
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
    alignItems: "stretch",
    padding: 16,
    backgroundColor: "#f5f5f5"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24
  },
  topBarLeft: {
    flex: 1,
    paddingRight: 8
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 0
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#1976d2",
    marginHorizontal: 4
  },
  primaryButton: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2"
  },
  actionText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#1976d2",
    fontWeight: "500"
  },
  actionTextPrimary: {
    marginLeft: 8,
    fontSize: 16,
    color: "#fff",
    fontWeight: "600"
  },
  logoutIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 6
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
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 12
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4
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
  modalHint: {
    fontSize: 12,
    color: "#777",
    marginBottom: 12
  },
  paymentTargetRow: {
    flexDirection: "row",
    marginBottom: 8,
    marginTop: 4
  },
  paymentTargetButton: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1976d2",
    paddingVertical: 6,
    alignItems: "center",
    marginRight: 4
  },
  paymentTargetButtonActive: {
    backgroundColor: "#1976d2"
  },
  paymentTargetText: {
    fontSize: 12,
    color: "#1976d2"
  },
  paymentTargetTextActive: {
    color: "#fff",
    fontWeight: "600"
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
  },
  modalButtonDisabled: {
    opacity: 0.5
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 6
  },
  userName: {
    fontSize: 15,
    fontWeight: "600"
  },
  userEmail: {
    fontSize: 13,
    color: "#555"
  },
  userRole: {
    fontSize: 12,
    color: "#777"
  },
  userActions: {
    flexDirection: "row",
    marginLeft: 8
  },
  userEditButton: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  userDeleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  roleRow: {
    flexDirection: "row",
    marginVertical: 4
  },
  roleButton: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1976d2",
    paddingVertical: 8,
    alignItems: "center",
    marginRight: 4
  },
  roleButtonActive: {
    backgroundColor: "#1976d2"
  },
  roleButtonText: {
    fontSize: 13,
    color: "#1976d2"
  },
  roleButtonTextActive: {
    color: "#fff",
    fontWeight: "600"
  }
});
