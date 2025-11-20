import React from "react";
import { Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Mapeo de iconos a emojis para web
const iconEmojis = {
  "log-out": "🚪",
  "person-add": "👤",
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
    const fontSize = typeof size === 'number' ? size * 1.2 : 24 * 1.2;
    
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'visible',
          },
          style,
        ]}
      >
        <Text
          style={{
            fontSize: fontSize,
            color: color,
            lineHeight: fontSize,
            textAlign: 'center',
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        >
          {emoji}
        </Text>
      </View>
    );
  }

  return <Ionicons name={name} size={size} color={color} style={style} />;
}
