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
  <View className="items-center justify-center px-1.5 py-1 gap-1">
    <Ionicons
      name={icon}
      size={22}
      color={focused ? "#0f172a" : "#94a3b8"}
    />
    <Text
      className={`text-[10px] font-medium ${
        focused ? "text-slate-900" : "text-slate-400"
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
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          paddingVertical: 8,
          height: 68,
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
