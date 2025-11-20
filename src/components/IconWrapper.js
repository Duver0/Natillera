import React from "react";
import { Platform, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Mapeo de iconos a emojis para web
const iconEmojis = {
  "log-out": "🚪",
  "person-add": "👤➕",
  "person-add-outline": "👤",
  "people": "👥",
  "pencil": "✏️",
  "trash": "🗑️",
  "add-circle": "➕",
  "cash": "💰",
  "card": "💳",
  "checkmark-circle": "✅",
  "trash-outline": "🗑️",
  "create": "✏️",
  "create-outline": "✏️",
  "settings": "⚙️",
  "help-circle": "❓",
  "close": "❌",
  "menu": "☰",
  "home": "🏠",
  "wallet": "👛",
  "checkmark": "✓",
};

export default function IconWrapper({ name, size = 24, color = "#000", style }) {
  const isWeb = Platform.OS === "web";
  
  if (isWeb) {
    const emoji = iconEmojis[name] || "•";
    return (
      <Text
        style={[
          {
            fontSize: size * 0.9,
            color: color,
            lineHeight: size,
            height: size,
            width: size,
            textAlign: 'center',
            textAlignVertical: 'center',
            marginHorizontal: 2,
          },
          style,
        ]}
      >
        {emoji}
      </Text>
    );
  }

  return <Ionicons name={name} size={size} color={color} style={style} />;
}
}
