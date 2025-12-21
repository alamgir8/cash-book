import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrganization } from "../../hooks/useOrganization";

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
  const { activeOrganization, canManageAccounts, canCreateTransactions } =
    useOrganization();

  // If user is in an organization with viewer role (no permissions), show limited tabs
  const showLimitedTabs =
    activeOrganization && !canCreateTransactions && !canManageAccounts;

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
          paddingBottom: insets.bottom + 5,
          paddingTop: 5,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: "transparent",
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "600",
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
          // Hide if user doesn't have account management permissions and is in an organization
          href: showLimitedTabs ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="receipt" label="History" focused={focused} />
          ),
          // Always show transactions (viewers can see, just not create)
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
      <Tabs.Screen
        name="categories"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="organizations"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="organizations/[organizationId]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="parties"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="parties/new"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="parties/[partyId]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="parties/[partyId]/edit"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="parties/[partyId]/ledger"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invoices/new"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invoices/[invoiceId]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
