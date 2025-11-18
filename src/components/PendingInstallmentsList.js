import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "../utils/currency";

export default function PendingInstallmentsList({
  installments,
  onPressPay,
  onPressOpenLoan,
  showClientName = true,
  useSimpleList = false
}) {
  const data = (installments || []).filter((item) => item.paid !== 1);

  function renderItem({ item }) {
    const total =
      (Number(item.amount_capital) || 0) +
      (Number(item.amount_interest) || 0);

    return (
      <View style={styles.item}>
        <TouchableOpacity
          style={styles.itemMain}
          onPress={() => onPressOpenLoan && onPressOpenLoan(item)}
        >
          <View style={styles.itemHeader}>
            {showClientName && item.client_name ? (
              <Text style={styles.clientName}>{item.client_name}</Text>
            ) : null}
            <Text style={styles.cuotaText}>Pago pendiente</Text>
          </View>
          <Text style={styles.amountText}>{formatCurrency(total)}</Text>
          <Text style={styles.dateText}>
            Vence: {item.due_date || "-"}
          </Text>
        </TouchableOpacity>
        {onPressPay && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => onPressPay(item)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.payText}>Pagar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!data.length) {
    return null;
  }

  if (useSimpleList) {
    return (
      <View>
        {data.map((item) => (
          <View key={item.id}>{renderItem({ item })}</View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee"
  },
  itemMain: {
    flex: 1
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2
  },
  clientName: {
    fontSize: 14,
    fontWeight: "600"
  },
  cuotaText: {
    fontSize: 13,
    color: "#555"
  },
  amountText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 2
  },
  dateText: {
    fontSize: 12,
    color: "#777",
    marginTop: 2
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "#1976d2",
    marginLeft: 8
  },
  payText: {
    marginLeft: 4,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600"
  }
});
