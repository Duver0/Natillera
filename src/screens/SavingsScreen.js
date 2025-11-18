import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { getSavingsOverviewByOwner } from "../db/savingsOverviewRepository";
import { formatCurrency } from "../utils/currency";

export default function SavingsScreen() {
  const { user, isAdmin } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && isFocused) {
      loadOverview();
    }
  }, [user, isFocused]);

  async function loadOverview() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSavingsOverviewByOwner(isAdmin ? null : user.id);
      setItems(data);
    } catch (error) {
      console.error("Error cargando ahorros", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadOverview();
    setRefreshing(false);
  }

  function openClientSavings(clientId, clientName) {
    navigation.navigate("ClientSavings", { clientId, clientName });
  }

  function renderItem({ item }) {
    const { clientName, liquidation, firstDate, lastDate } = item;
    const { totalDeposits, totalWithdrawals, interest, totalToPay, balance } =
      liquidation;

    const isLiquidated = balance <= 0.01;
    const periodLabel =
      firstDate && lastDate
        ? `${firstDate.toISOString().slice(0, 10)} · ${
            lastDate.toISOString().slice(0, 10)
          }`
        : "Sin movimientos";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openClientSavings(item.clientId, clientName)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.clientName}>{clientName}</Text>
          <View
            style={[
              styles.badge,
              isLiquidated ? styles.badgeLiquidated : styles.badgePending
            ]}
          >
            <Text style={styles.badgeText}>
              {isLiquidated ? "Liquidado" : "Pendiente"}
            </Text>
          </View>
        </View>
        <Text style={styles.periodText}>{periodLabel}</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Aportes</Text>
            <Text style={styles.value}>{formatCurrency(totalDeposits)}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Retiros</Text>
            <Text style={styles.value}>{formatCurrency(totalWithdrawals)}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Intereses</Text>
            <Text style={styles.value}>{formatCurrency(interest)}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Total a pagar</Text>
            <Text style={styles.value}>{formatCurrency(totalToPay)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const pendingItems = items.filter(
    (i) => !i.account.liquidated
  );
  const liquidatedItems = items.filter(
    (i) => i.account.liquidated
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ahorros</Text>
      <Text style={styles.subtitle}>
        Resumen de ahorros por cliente, ordenados por estado y fechas.
      </Text>

      <Text style={styles.sectionTitle}>Pendientes</Text>
      <FlatList
        data={pendingItems}
        keyExtractor={(item) => String(item.account.id)}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={
          pendingItems.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>
              No hay ahorros pendientes por liquidar.
            </Text>
          )
        }
      />

      <Text style={styles.sectionTitle}>Liquidados</Text>
      <FlatList
        data={liquidatedItems}
        keyExtractor={(item) => `liq-${item.account.id}`}
        renderItem={renderItem}
        contentContainerStyle={
          liquidatedItems.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>
              Aún no hay ahorros liquidados.
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
    fontWeight: "bold"
  },
  subtitle: {
    fontSize: 13,
    color: "#555",
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 8
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600"
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16
  },
  badgePending: {
    backgroundColor: "#fff3cd"
  },
  badgeLiquidated: {
    backgroundColor: "#e8f5e9"
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555"
  },
  periodText: {
    fontSize: 12,
    color: "#777",
    marginBottom: 6
  },
  row: {
    flexDirection: "row",
    marginTop: 4
  },
  col: {
    flex: 1
  },
  label: {
    fontSize: 12,
    color: "#777"
  },
  value: {
    fontSize: 14,
    fontWeight: "600"
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
