import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { getPaidInstallmentsByOwner } from "../db/loanRepository";
import { formatCurrency } from "../utils/currency";

export default function PaymentsScreen() {
  const { user, isAdmin } = useAuth();
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (user && isFocused) {
      loadPayments();
    }
  }, [user, isFocused]);

  async function loadPayments() {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getPaidInstallmentsByOwner(isAdmin ? null : user.id);
      setRows(list);
    } catch (error) {
      console.error("Error cargando pagos", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  }

  function openLoanDetail(loanId) {
    navigation.navigate("LoanDetail", { loanId });
  }

  function renderPayment({ item }) {
    const total =
      item.paid_amount != null
        ? Number(item.paid_amount)
        : (item.amount_capital || 0) + (item.amount_interest || 0);
    return (
      <TouchableOpacity
        style={styles.paymentItem}
        onPress={() => openLoanDetail(item.loan_id)}
      >
        <View style={styles.paymentHeader}>
          <Text style={styles.clientName}>{item.client_name}</Text>
          <Text style={styles.loanId}>ID #{item.loan_id}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Ionicons name="card" size={18} color="#1976d2" />
          <Text style={styles.paymentText}>
            Pago cuota #{item.number} - {formatCurrency(total)}
          </Text>
        </View>
        <Text style={styles.paymentDate}>
          Pagado el: {item.paid_date || "-"}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagos</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPayment}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={
          rows.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>
              Aún no se han registrado pagos.
            </Text>
          )
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
    marginBottom: 12
  },
  paymentItem: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee"
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600"
  },
  loanId: {
    fontSize: 12,
    color: "#777"
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  paymentText: {
    marginLeft: 6,
    fontSize: 16
  },
  paymentDate: {
    marginTop: 4,
    fontSize: 14,
    color: "#555"
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
