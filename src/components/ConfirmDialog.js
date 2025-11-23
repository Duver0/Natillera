import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";

export default function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  destructive = false,
}) {
  // En mobile, usar Alert.alert
  if (Platform.OS !== "web" && visible) {
    setTimeout(() => {
      Alert.alert(title, message, [
        { text: cancelText, style: "cancel", onPress: onCancel },
        {
          text: confirmText,
          style: destructive ? "destructive" : "default",
          onPress: onConfirm,
        },
      ]);
      // Callback para cerrar el modal
      onCancel && onCancel();
    }, 0);
    return null;
  }

  if (!visible || Platform.OS !== "web") {
    return null;
  }

  return (
    <View style={styles.webBackdrop}>
      <View style={styles.dialog}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>{cancelText}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              destructive && styles.destructiveButton,
            ]}
            onPress={onConfirm}
          >
            <Text
              style={[
                styles.confirmButtonText,
                destructive && styles.destructiveButtonText,
              ]}
            >
              {confirmText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    minWidth: 280,
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#555",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: "#1976d2",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  destructiveButton: {
    backgroundColor: "#d32f2f",
  },
  destructiveButtonText: {
    color: "#fff",
  },
});
