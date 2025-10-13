import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TabIcon = ({
  icon,
  label,
  focused
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}) => (
  <View className="items-center">
    <Ionicons name={icon} size={24} color={focused ? '#3b82f6' : '#9ca3af'} />
    <Text className={`text-xs mt-1 font-medium ${focused ? 'text-blue-600' : 'text-gray-500'}`}>{label}</Text>
  </View>
);

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          paddingVertical: 8,
          height: 80,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="speedometer" label="Home" focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ focused }) => <TabIcon icon="wallet" label="Accounts" focused={focused} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabIcon icon="settings" label="More" focused={focused} />
        }}
      />
    </Tabs>
  );
}
