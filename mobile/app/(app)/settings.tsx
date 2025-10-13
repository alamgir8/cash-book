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
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 pt-16 pb-6 border-b border-gray-100">
        <Text className="text-3xl font-bold text-gray-900">Settings</Text>
        <Text className="text-gray-600 text-base mt-1">
          Manage your profile and app preferences
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        {/* Profile Section */}
        <View className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center">
              <Ionicons name="person" size={28} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-sm font-medium uppercase tracking-wide">Profile</Text>
              <Text className="text-gray-900 text-xl font-bold mt-1">
                {state.status === 'authenticated' ? state.user.name : 'Unknown User'}
              </Text>
            </View>
          </View>
          
          {state.status === 'authenticated' ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <Ionicons name="mail" size={18} color="#6b7280" />
                <Text className="text-gray-700 flex-1">{state.user.email}</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Ionicons name="call" size={18} color="#6b7280" />
                <Text className="text-gray-700 flex-1">{state.user.phone}</Text>
              </View>
            </View>
          ) : null}
          
          <TouchableOpacity
            onPress={refreshProfile}
            className="flex-row gap-2 items-center justify-center bg-blue-50 rounded-xl py-3 mt-4"
          >
            <Ionicons name="refresh" size={18} color="#3b82f6" />
            <Text className="text-blue-700 font-semibold">Refresh Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Data Export Section */}
        <View className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center">
              <Ionicons name="document-text" size={24} color="#10b981" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-lg font-bold">Data Export</Text>
              <Text className="text-gray-600 text-sm mt-1">
                Export complete PDF report of all transactions
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting}
            className="bg-green-500 rounded-xl py-4 items-center shadow-sm"
            style={{
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2">
              {exporting ? (
                <>
                  <Ionicons name="download" size={20} color="white" />
                  <Text className="text-white font-bold">Exporting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-download" size={20} color="white" />
                  <Text className="text-white font-bold">Export All as PDF</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center">
              <Ionicons name="information-circle" size={24} color="#8b5cf6" />
            </View>
            <Text className="text-gray-900 text-lg font-bold">App Information</Text>
          </View>
          
          <View className="gap-3">
            <View className="flex-row items-center gap-3 py-2">
              <Ionicons name="server" size={18} color="#6b7280" />
              <View className="flex-1">
                <Text className="text-gray-600 text-sm">API Endpoint</Text>
                <Text className="text-gray-900 text-sm font-mono">{baseURL}</Text>
              </View>
            </View>
            
            <View className="flex-row items-center gap-3 py-2">
              <Ionicons name="code-working" size={18} color="#6b7280" />
              <View className="flex-1">
                <Text className="text-gray-600 text-sm">App Version</Text>
                <Text className="text-gray-900 text-sm font-mono">
                  {Constants.expoConfig?.version || '1.0.0'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sign Out Section */}
        <View className="bg-white rounded-2xl p-6 border border-red-100 shadow-sm">
          <TouchableOpacity
            onPress={signOut}
            className="flex-row gap-3 items-center justify-center bg-red-50 border-2 border-red-200 rounded-xl py-4"
          >
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            <Text className="text-red-600 font-bold text-base">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing for safe area */}
        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
