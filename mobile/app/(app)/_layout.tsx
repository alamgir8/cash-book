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
    <Ionicons name={icon} size={22} color={focused ? '#38bdf8' : '#94a3b8'} />
    <Text className={`text-xs mt-1 ${focused ? 'text-accent' : 'text-slate-400'}`}>{label}</Text>
  </View>
);

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          paddingVertical: 8,
          height: 72
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
