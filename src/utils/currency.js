export function formatCurrency(value) {
  const number = Number(value) || 0;
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }).format(number);
  } catch {
    // Fallback simple si Intl no está disponible
    return `$ ${number.toLocaleString("es-CO")}`;
  }
}

// Formatea el texto de entrada a moneda, interpretando solo dígitos como pesos.
export function formatCurrencyInput(text) {
  const digits = String(text || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return formatCurrency(Number(digits));
}

