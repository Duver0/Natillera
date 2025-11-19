import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { getClientsByOwner } from "../db/clientRepository";
import { createLoanWithInstallments } from "../db/loanRepository";
import { formatCurrencyInput } from "../utils/currency";

export default function NewLoanScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const preselectedClientId = route.params?.clientId || null;

  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(preselectedClientId);
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("2");
  const [interestType] = useState("FIXED");
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, [user]);

  async function loadClients() {
    if (!user) return;
    try {
      const list = await getClientsByOwner(user.id);
      setClients(list);
      if (!clientId && list.length > 0) {
        setClientId(list[0].id);
      }
    } catch (error) {
      console.error("Error cargando clientes para préstamo", error);
    }
  }

  async function handleCreateLoan() {
    if (!clientId || !principal || !interestRate) {
      return;
    }

    const principalNum = Number(principal.replace(/[^\d]/g, ""));
    const rateNum = Number(interestRate.replace(",", "."));
    if (!principalNum) {
      return;
    }

    setLoading(true);
    try {
      const loan = await createLoanWithInstallments({
        clientId,
        principal: principalNum,
        interestRate: rateNum,
        interestType,
        // La frecuencia ya no se usa en el flujo de negocio,
        // pero seguimos guardando un valor por compatibilidad.
        chargeFrequency: "MONTHLY",
        startDate: startDate.toISOString().slice(0, 10)
      });
      navigation.replace("LoanDetail", { loanId: loan.id });
    } catch (error) {
      console.error("Error creando préstamo", error);
    } finally {
      setLoading(false);
    }
  }

  function handlePrincipalChange(text) {
    const formatted = formatCurrencyInput(text);
    setPrincipal(formatted);
  }

  function handleDateChange(event, selectedDate) {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1976d2" />
          </TouchableOpacity>
          <Text style={styles.title}>Nuevo préstamo</Text>
        </View>

        <Text style={styles.label}>Cliente</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={clientId}
            onValueChange={(value) => setClientId(value)}
          >
            {clients.map((c) => (
              <Picker.Item key={c.id} label={c.name} value={c.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Monto a prestar</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={principal}
          onChangeText={handlePrincipalChange}
          placeholder="Ej: $ 1.000.000"
        />

        <Text style={styles.label}>Tasa de interés Fija</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={interestRate}
          onChangeText={setInterestRate}
          placeholder="Ej: 24"
        />

        <Text style={styles.label}>Fecha de inicio</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar" size={20} color="#1976d2" />
          <Text style={styles.dateText}>
            {startDate.toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}

        <View style={styles.buttonContainer}>
          <Button
            title={loading ? "Creando préstamo..." : "Crear préstamo"}
            onPress={handleCreateLoan}
            disabled={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  label: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: "500"
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  segment: {
    flexDirection: "row",
    marginBottom: 4,
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
    color: "#1976d2"
  },
  segmentTextActive: {
    color: "#fff",
    fontWeight: "600"
  },
  buttonContainer: {
    marginTop: 16
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#ddd"
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#333"
  }
});
