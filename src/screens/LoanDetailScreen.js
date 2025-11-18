import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  getInstallmentsByLoan,
  getLoanById,
  markInstallmentPaid,
  deleteLoan,
  deletePayment,
  getRemainingInterestForLoan,
  payInterestForLoan
} from "../db/loanRepository";
import { formatCurrency, formatCurrencyInput } from "../utils/currency";
import PendingInstallmentsList from "../components/PendingInstallmentsList";

export default function LoanDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { loanId } = route.params || {};
  const [loan, setLoan] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [pending, setPending] = useState([]);
  const [paid, setPaid] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTarget, setPaymentTarget] = useState("CAPITAL"); // CAPITAL | INTEREST

  useEffect(() => {
    loadData();
  }, [loanId]);

  async function loadData() {
    if (!loanId) return;
    try {
      const loanData = await getLoanById(loanId);
      const installmentsData = await getInstallmentsByLoan(loanId);
      setLoan(loanData);
      setInstallments(installmentsData);
      const pendingData = installmentsData.filter((i) => i.paid !== 1);
      const paidData = installmentsData.filter((i) => i.paid === 1);
      setPending(pendingData);
      setPaid(paidData);

      // Calcular cuánto falta por pagar en el crédito.
      let scheduledTotal = 0;
      let paidTotal = 0;
      for (const inst of installmentsData) {
        const base =
          (Number(inst.amount_capital) || 0) +
          (Number(inst.amount_interest) || 0);
        scheduledTotal += base;
        let paidAmount = 0;
        if (inst.paid_amount != null) {
          paidAmount = Number(inst.paid_amount) || 0;
        } else if (inst.paid === 1) {
          paidAmount = base;
        }
        paidTotal += paidAmount;
      }
      const remaining = Math.max(scheduledTotal - paidTotal, 0);
      setRemainingAmount(remaining);

      // Total del préstamo (capital + intereses) y desagregado de intereses.
      setTotalAmount(scheduledTotal);
      const principalNum = Number(loanData.principal) || 0;
      setTotalInterest(Math.max(scheduledTotal - principalNum, 0));
    } catch (error) {
      console.error("Error cargando detalle de préstamo", error);
    }
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

    // Para pagos solo de intereses, aplicamos el pago a nivel de préstamo,
    // distribuyéndolo sobre todas las cuotas con interés pendiente.
    if (paymentTarget === "INTEREST") {
      const loanId = loan?.id || selectedInstallment.loan_id;
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
                await loadData();
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
            await loadData();
          } catch (error) {
            console.error("Error registrando pago", error);
          }
        }
      }
    ]);
  }

  function handleDeletePayment(item) {
    if (!item.id || item.paid_amount == null) {
      return;
    }
    Alert.alert(
      "Eliminar pago",
      "¿Deseas eliminar este pago? La cuota volverá a quedar pendiente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePayment(item.id);
              await loadData();
            } catch (error) {
              console.error("Error eliminando pago", error);
            }
          }
        }
      ]
    );
  }

  function renderInstallment({ item }) {
    const paid = item.paid === 1;
    const totalPaid =
      item.paid_amount != null
        ? Number(item.paid_amount)
        : (Number(item.amount_capital) || 0) +
          (Number(item.amount_interest) || 0);

    const paidCapital = Number(item.paid_capital) || 0;
    const paidInterest = Number(item.paid_interest) || 0;

    let paymentType = "";
    if (item.paid_amount != null) {
      if (paidCapital > 0 && paidInterest > 0) {
        paymentType = "Cuota (capital + interés)";
      } else if (paidCapital > 0) {
        paymentType = "Solo capital";
      } else if (paidInterest > 0) {
        paymentType = "Solo interés";
      }
    }

    return (
      <View style={styles.installmentItem}>
        <View style={styles.installmentHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.installmentNumber}>Cuota #{item.number}</Text>
            <Text style={styles.installmentDate}>
              Vence: {item.due_date || "-"}
            </Text>
          </View>
          <View
            style={[
              styles.statusPillSmall,
              paid ? styles.statusPaid : styles.statusPending
            ]}
          >
            <Text style={styles.statusTextSmall}>
              {paid ? "Pagada" : "Pendiente"}
            </Text>
          </View>
        </View>

        {paid && (
          <View style={styles.installmentRow}>
            <View style={styles.installmentCol}>
              <Text style={styles.installmentLabel}>Pagado</Text>
              <Text style={styles.installmentValue}>
                {formatCurrency(totalPaid)}
              </Text>
              {paymentType === "Cuota (capital + interés)" && (
                <View style={styles.paymentBreakdownRow}>
                  <Text style={styles.paymentBreakdownText}>
                    Cap: {formatCurrency(paidCapital)}
                  </Text>
                  <Text style={styles.paymentBreakdownText}>
                    Int: {formatCurrency(paidInterest)}
                  </Text>
                </View>
              )}
            </View>
            {paymentType ? (
              <View style={[styles.installmentCol, styles.paymentTypeContainer]}>
                <View style={styles.paymentTypePill}>
                  <Text style={styles.installmentPaymentType}>{paymentType}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.installmentFooter}>
          {paid && item.paid_date ? (
            <Text style={styles.installmentFootnote}>
              Pagada el: {item.paid_date}
            </Text>
          ) : (
            <View />
          )}
          {paid && item.paid_amount != null && (
            <TouchableOpacity
              style={styles.deletePaymentButton}
              onPress={() => handleDeletePayment(item)}
            >
              <Ionicons name="trash" size={16} color="#d32f2f" />
              <Text style={styles.deletePaymentText}>Eliminar pago</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Detalle del préstamo</Text>
        <Text>Cargando...</Text>
      </View>
    );
  }

  const interestTypeLabel =
    loan.interest_type === "FIXED" ? "Fijo" : "Variable";
  const interestLabel = `${loan.interest_rate}% ${interestTypeLabel}`;

  const hasValidPaymentAmount =
    paymentAmount &&
    Number(String(paymentAmount).replace(/[^\d]/g, "")) > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1976d2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle del préstamo</Text>
        <TouchableOpacity
          style={styles.headerDeleteButton}
          onPress={() => {
            Alert.alert(
              "Eliminar préstamo",
              "¿Estás seguro de que deseas eliminar este préstamo y todas sus cuotas?",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Eliminar",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteLoan(loan.id);
                      navigation.goBack();
                    } catch (error) {
                      console.error("Error eliminando préstamo", error);
                    }
                  }
                }
              ]
            );
          }}
        >
          <Ionicons name="trash" size={20} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.loanCard}>
          <View style={styles.loanCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{loan.client_name}</Text>
              <Text style={styles.loanId}>ID #{loan.id}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                loan.status === "ACTIVE" ? styles.statusActive : styles.statusOther
              ]}
            >
              <Text style={styles.statusText}>{loan.status}</Text>
            </View>
          </View>

          <Text style={styles.loanAmount}>
            Monto: {formatCurrency(loan.principal)}
          </Text>
          <Text style={styles.loanTotal}>
            Total con intereses: {formatCurrency(totalAmount)}
          </Text>
          <Text style={styles.loanInterestTotal}>
            Intereses totales: {formatCurrency(totalInterest)}
          </Text>
          <Text style={styles.loanRemaining}>
            Pendiente: {formatCurrency(remainingAmount)}
          </Text>

          <View style={styles.loanInfoRow}>
            <View style={styles.loanInfoBlock}>
              <Text style={styles.infoLabel}>Interés</Text>
              <Text style={styles.infoValue}>{interestLabel}</Text>
            </View>
          </View>

          <View style={styles.loanInfoRow}>
            <View style={styles.loanInfoBlock}>
              <Text style={styles.infoLabel}>Inicio</Text>
              <Text style={styles.infoValue}>{loan.start_date}</Text>
            </View>
            <View style={styles.loanInfoBlock}>
              <Text style={styles.infoLabel}>Cliente</Text>
              <Text style={styles.infoValueSmall}>{loan.client_name}</Text>
            </View>
          </View>

          {loan.closed_at && (
            <View style={styles.loanInfoRow}>
              <View style={styles.loanInfoBlock}>
                <Text style={styles.infoLabel}>Liquidado el</Text>
                <Text style={styles.infoValue}>{loan.closed_at}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pagos registrados</Text>
          {paid.length > 0 ? (
            paid.map((item) => (
              <View key={item.id}>{renderInstallment({ item })}</View>
            ))
          ) : (
            <Text style={styles.emptyTextSmall}>
              Aún no has registrado pagos para este préstamo.
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Saldo pendiente</Text>
          <PendingInstallmentsList
            installments={pending}
            onPressPay={openPaymentModal}
            onPressOpenLoan={null}
            showClientName={false}
            useSimpleList
          />
          {pending.length === 0 && (
            <Text style={styles.emptyTextSmall}>
              No hay cuotas pendientes para este préstamo.
            </Text>
          )}
        </View>
      </ScrollView>

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
                  Préstamo #{loan.id} · Saldo actual:{" "}
                  {formatCurrency(remainingAmount)}
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
                <Text style={styles.modalLabel}>Monto del pago</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0f2f5"
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8
  },
  loanCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 16
  },
  loanCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600"
  },
  loanId: {
    fontSize: 12,
    color: "#777",
    marginTop: 2
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20
  },
  statusActive: {
    backgroundColor: "#e3f2fd"
  },
  statusOther: {
    backgroundColor: "#f5f5f5"
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1976d2"
  },
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  statusPending: {
    backgroundColor: "#ffc400ff"
  },
  statusPaid: {
    backgroundColor: "#00fd15ff"
  },
  statusTextSmall: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555"
  },
  loanAmount: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4
  },
  loanTotal: {
    fontSize: 14,
    color: "#555",
    marginTop: 2
  },
  loanInterestTotal: {
    fontSize: 14,
    color: "#555",
    marginTop: 2
  },
  loanRemaining: {
    fontSize: 14,
    color: "#555",
    marginTop: 2
  },
  loanInterest: {
    fontSize: 14,
    color: "#555",
    marginTop: 4
  },
  loanText: {
    fontSize: 14,
    color: "#555",
    marginTop: 2
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8
  },
  sectionCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12
  },
  installmentItem: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee"
  },
  installmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  installmentDate: {
    fontSize: 12,
    color: "#777"
  },
  installmentRow: {
    flexDirection: "row",
    marginTop: 6
  },
  installmentCol: {
    flex: 1
  },
  installmentLabel: {
    fontSize: 12,
    color: "#777"
  },
  installmentValue: {
    fontSize: 14,
    fontWeight: "600"
  },
  installmentPaymentType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1976d2"
  },
  paymentBreakdownRow: {
    flexDirection: "row",
    marginTop: 2
  },
  paymentBreakdownText: {
    fontSize: 12,
    color: "#555",
    marginRight: 8
  },
  paymentTypeContainer: {
    alignItems: "flex-end",
    justifyContent: "center"
  },
  paymentTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#e3f2fd"
  },
  installmentNumber: {
    fontSize: 14,
    fontWeight: "600"
  },
  installmentStatus: {
    fontSize: 12,
    color: "#d32f2f"
  },
  paid: {
    color: "#388e3c"
  },
  installmentText: {
    fontSize: 13,
    color: "#555"
  },
  installmentFootnote: {
    marginTop: 4,
    fontSize: 12,
    color: "#777"
  },
  installmentFooter: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  deletePaymentButton: {
    flexDirection: "row",
    alignItems: "center"
  },
  deletePaymentText: {
    marginLeft: 4,
    fontSize: 12,
    color: "#d32f2f",
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
  emptyTextSmall: {
    fontSize: 13,
    color: "#777"
  },
  loanInfoRow: {
    flexDirection: "row",
    marginTop: 10
  },
  loanInfoBlock: {
    flex: 1
  },
  infoLabel: {
    fontSize: 12,
    color: "#777"
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600"
  },
  infoValueSmall: {
    fontSize: 13,
    fontWeight: "500"
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
  headerDeleteButton: {
    marginLeft: "auto",
    paddingHorizontal: 4,
    paddingVertical: 2
  }
});
