import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';
import { baseURL } from '../../lib/api';
import { exportTransactionsPdf } from '../../services/reports';

export default function SettingsScreen() {
  const { state, signOut, refreshProfile } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportTransactionsPdf({});
      Toast.show({ type: 'success', text1: 'Full report exported' });
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Failed to export full report' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-primary" contentContainerStyle={{ padding: 24, gap: 24 }}>
      <View className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 gap-4">
        <Text className="text-slate-400 text-xs uppercase tracking-wide">Signed in as</Text>
        <Text className="text-white text-2xl font-semibold">{state.status === 'authenticated' ? state.user.name : 'Unknown'}</Text>
        {state.status === 'authenticated' ? (
          <>
            <Text className="text-slate-300">{state.user.email}</Text>
            <Text className="text-slate-300">{state.user.phone}</Text>
          </>
        ) : null}
        <TouchableOpacity
          onPress={refreshProfile}
          className="flex-row gap-2 items-center self-start mt-2"
        >
          <Ionicons name="refresh" size={18} color="#38bdf8" />
          <Text className="text-accent font-medium">Refresh profile</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 gap-4">
        <Text className="text-white text-lg font-semibold">Data export</Text>
        <Text className="text-slate-400 text-sm">
          Export a complete PDF report of your transactions, including all accounts.
        </Text>
        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting}
          className="bg-accent rounded-2xl py-3 items-center"
        >
          <Text className="text-primary font-semibold">
            {exporting ? 'Exporting...' : 'Export all as PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 gap-4">
        <Text className="text-white text-lg font-semibold">App info</Text>
        <Text className="text-slate-400 text-sm">API endpoint: {baseURL}</Text>
        <Text className="text-slate-400 text-sm">
          Version: {Constants.expoConfig?.version}
        </Text>
        <TouchableOpacity
          onPress={signOut}
          className="flex-row gap-2 items-center justify-center border border-rose-500 rounded-2xl py-3"
        >
          <Ionicons name="log-out-outline" size={20} color="#f87171" />
          <Text className="text-rose-400 font-semibold">Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
