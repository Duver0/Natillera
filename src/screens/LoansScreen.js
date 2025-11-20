import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import IconWrapper from "../components/IconWrapper";
import { useAuth } from "../context/AuthContext";
import { getLoansByOwner, deleteLoan } from "../db/loanRepository";
import { formatCurrency } from "../utils/currency";

export default function LoansScreen() {
  const { user, isAdmin } = useAuth();
  const navigation = useNavigation();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (user && isFocused) {
      loadLoans();
    }
  }, [user, isFocused]);

  async function loadLoans() {
    if (!user) return;
    setLoading(true);
    try {
      const list = await getLoansByOwner(isAdmin ? null : user.id);
      setLoans(list);
    } catch (error) {
      console.error("Error cargando préstamos", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadLoans();
    setRefreshing(false);
  }

  function openLoanDetail(loanId) {
    navigation.navigate("LoanDetail", { loanId });
  }

  async function handleDeleteLoan(item) {
    const { id } = item;
    if (!id) return;

    // Confirmación simple; puedes ajustar el texto según tu gusto.
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
              await deleteLoan(id);
              await loadLoans();
            } catch (error) {
              console.error("Error eliminando préstamo", error);
            }
          }
        }
      ]
    );
  }

  function renderLoanItem(item) {
    const interestTypeLabel =
      "Fijo";
    const interestLabel = `${item.interest_rate}% ${interestTypeLabel}`;
    const remaining =
      item.remaining_amount != null ? Number(item.remaining_amount) : 0;
    return (
      <View style={styles.loanItem}>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => openLoanDetail(item.id)}
        >
          <View style={styles.loanHeader}>
            <Text style={styles.clientName}>{item.client_name}</Text>
            <Text style={styles.loanId}>ID #{item.id}</Text>
          </View>
          <View style={styles.loanRow}>
            <IconWrapper name="cash" size={18} color="#1976d2" />
            <Text style={styles.loanAmount}>
              Monto: {formatCurrency(item.principal)}
            </Text>
          </View>
          <Text style={styles.loanInterest}>Interés: {interestLabel}</Text>
          <Text style={styles.loanRemaining}>
            Pendiente: {formatCurrency(Math.max(remaining, 0))}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteLoan(item)}
        >
          <IconWrapper name="trash" size={18} color="#d32f2f" />
        </TouchableOpacity>
      </View>
    );
  }

  const activeLoans = loans.filter((l) => l.status !== "PAID");
  const paidLoans = loans.filter((l) => l.status === "PAID");

  function renderLoan({ item }) {
    return renderLoanItem(item);
  }

  function renderPaidLoan({ item }) {
    return renderLoanItem(item);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Préstamos</Text>
        <TouchableOpacity
          style={styles.newLoanButton}
          onPress={() => navigation.navigate("NewLoan")}
        >
          <IconWrapper name="add-circle" size={22} color="#1976d2" />
          <Text style={styles.newLoanText}>Nuevo</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionTitle}>En progreso</Text>
      <FlatList
        data={activeLoans}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderLoan}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={
          activeLoans.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>
              No tienes préstamos en progreso.
            </Text>
          )
        }
      />

      <Text style={styles.sectionTitle}>Pagados</Text>
      <FlatList
        data={paidLoans}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPaidLoan}
        contentContainerStyle={
          paidLoans.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>
              Aún no tienes préstamos pagados.
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  newLoanButton: {
    flexDirection: "row",
    alignItems: "center"
  },
  newLoanText: {
    marginLeft: 4,
    color: "#1976d2",
    fontWeight: "500"
  },
  loanItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee"
  },
  loanHeader: {
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
  loanRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4
  },
  loanAmount: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: "500"
  },
  loanInterest: {
    marginTop: 4,
    fontSize: 14,
    color: "#555"
  },
  loanRemaining: {
    marginTop: 2,
    fontSize: 13,
    color: "#555"
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center"
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6
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
