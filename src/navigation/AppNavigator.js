import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import IconWrapper from "../components/IconWrapper";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ClientsScreen from "../screens/ClientsScreen";
import LoansScreen from "../screens/LoansScreen";
import PaymentsScreen from "../screens/PaymentsScreen";
import { useAuth } from "../context/AuthContext";
import UserManagementScreen from "../screens/UserManagementScreen";
import LoanDetailScreen from "../screens/LoanDetailScreen";
import NewLoanScreen from "../screens/NewLoanScreen";
import ClientSavingsScreen from "../screens/ClientSavingsScreen";
import SavingsScreen from "../screens/SavingsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName = "home";
          if (route.name === "Dashboard") iconName = "home";
          else if (route.name === "Clientes") iconName = "people";
          else if (route.name === "Prestamos") iconName = "cash";
          else if (route.name === "Pagos") iconName = "card";
          else if (route.name === "Ahorros") iconName = "wallet";
          return <IconWrapper name={iconName} size={size || 24} color={color} />;
        },
        tabBarActiveTintColor: "#1976d2",
        tabBarInactiveTintColor: "#777",
        tabBarStyle: {
          backgroundColor: "#f5f5f5",
          borderTopColor: "#ddd"
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Clientes" component={ClientsScreen} />
      <Tab.Screen name="Prestamos" component={LoansScreen} />
      <Tab.Screen name="Pagos" component={PaymentsScreen} />
      <Tab.Screen name="Ahorros" component={SavingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
          <Stack.Screen name="NewLoan" component={NewLoanScreen} />
          <Stack.Screen
            name="ClientSavings"
            component={ClientSavingsScreen}
          />
          <Stack.Screen
            name="UserManagement"
            component={UserManagementScreen}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
