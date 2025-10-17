import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabIcon = ({
  icon,
  label,
  focused,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}) => (
  <View className="items-center justify-center px-1 py-1 gap-0.5 min-w-[60px]">
    <View className={`p-1.5 rounded-lg ${focused ? "bg-blue-100" : ""}`}>
      <Ionicons name={icon} size={20} color={focused ? "#2563eb" : "#64748b"} />
    </View>
    <Text
      className={`text-xs font-medium text-center ${
        focused ? "text-blue-600" : "text-slate-500"
      }`}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {label}
    </Text>
  </View>
);

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarInactiveTintColor: "#2a2828",
        tabBarActiveTintColor: "#2563eb",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#ddd",
          height: 40 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: "transparent",
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 600,
        },
        tabBarBadgeStyle: {
          top: -5,
          right: -10,
        },

        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="home" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Accounts",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="wallet" label="Accounts" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="receipt" label="History" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="settings" label="Settings" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts/[accountId]"
        options={{
          href: null, // This hides the dynamic route from tabs
        }}
      />
    </Tabs>
  );
}
