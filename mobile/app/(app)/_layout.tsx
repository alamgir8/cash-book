import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const TabIcon = ({
  icon,
  label,
  focused,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}) => (
  <View className="items-center justify-center px-2 py-1">
    <View
      className={`p-2 rounded-xl ${focused ? "bg-blue-100" : "bg-transparent"}`}
    >
      <Ionicons name={icon} size={26} color={focused ? "#1d4ed8" : "#6b7280"} />
    </View>
    <Text
      className={`text-xs mt-1 font-semibold ${
        focused ? "text-blue-700" : "text-gray-600"
      }`}
    >
      {label}
    </Text>
  </View>
);

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e7eb",
          borderTopWidth: 1,
          paddingVertical: 12,
          paddingHorizontal: 8,
          height: 88,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 12,
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
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="settings" label="Settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
