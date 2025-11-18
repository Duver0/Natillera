import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function YearlyReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reporte Anual</Text>
      <Text>
        Aquí podrás seleccionar un año y ver el ahorro e intereses por cliente.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8
  }
});

