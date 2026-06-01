import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { activeOrganization, canManageAccounts, canCreateTransactions } =
    useOrganization();

  const showLimitedTabs =
    activeOrganization && !canCreateTransactions && !canManageAccounts;

  const TABS: {
    name: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconFocused: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      name: "index",
      label: t("tabHome"),
      icon: "home-outline",
      iconFocused: "home",
    },
    {
      name: "accounts",
      label: t("tabAccounts"),
      icon: "wallet-outline",
      iconFocused: "wallet",
    },
    {
      name: "transactions",
      label: t("tabTransactions"),
      icon: "receipt-outline",
      iconFocused: "receipt",
    },
    {
      name: "shop",
      label: "Shop",
      icon: "bag-handle-outline",
      iconFocused: "bag-handle",
    },
    {
      name: "settings",
      label: t("tabSettings"),
      icon: "settings-outline",
      iconFocused: "settings",
    },
  ];

  const visibleTabs = TABS.filter((tab) => {
    if (tab.name === "accounts" && showLimitedTabs) return false;
    return true;
  });

  const screenWidth = Dimensions.get("window").width;
  const tabWidth = Math.floor(screenWidth / visibleTabs.length);

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.bg.primary,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
        height: 60 + insets.bottom,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 10,
      }}
    >
      {visibleTabs.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const isFocused = state.routes[state.index]?.name === tab.name;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={onPress}
            activeOpacity={0.75}
            style={{
              width: tabWidth,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 6,
            }}
          >
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 3,
                borderRadius: 10,
                backgroundColor: isFocused ? colors.info + "1A" : "transparent",
              }}
            >
              <Ionicons
                name={isFocused ? tab.iconFocused : tab.icon}
                size={22}
                color={isFocused ? colors.info : colors.text.secondary}
              />
            </View>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                marginTop: 1,
                color: isFocused ? colors.info : colors.text.secondary,
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="accounts" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="accounts/[accountId]" options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
      <Tabs.Screen name="organizations" options={{ href: null }} />
      <Tabs.Screen
        name="organizations/[organizationId]"
        options={{ href: null }}
      />
      <Tabs.Screen name="parties" options={{ href: null }} />
      <Tabs.Screen name="parties/new" options={{ href: null }} />
      <Tabs.Screen name="parties/[partyId]" options={{ href: null }} />
      <Tabs.Screen name="parties/[partyId]/edit" options={{ href: null }} />
      <Tabs.Screen name="parties/[partyId]/ledger" options={{ href: null }} />
      <Tabs.Screen name="invoices" options={{ href: null }} />
      <Tabs.Screen name="invoices/new" options={{ href: null }} />
      <Tabs.Screen name="invoices/[invoiceId]" options={{ href: null }} />
      <Tabs.Screen name="import" options={{ href: null }} />
    </Tabs>
  );
}
