import { Linking, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Party, PartyAddress } from "@/types/party";

type PartyContactInfoProps = {
  party: Party;
};

export function PartyContactInfo({ party }: PartyContactInfoProps) {
  const handleCall = () => {
    if (party.phone) {
      Linking.openURL(`tel:${party.phone}`);
    }
  };

  const handleEmail = () => {
    if (party.email) {
      Linking.openURL(`mailto:${party.email}`);
    }
  };

  const formatAddress = (address: PartyAddress | string | undefined) => {
    if (!address) return "Not specified";
    if (typeof address === "string") return address;
    return (
      [
        address.street,
        address.city,
        address.state,
        address.postal_code,
        address.country,
      ]
        .filter(Boolean)
        .join(", ") || "Not specified"
    );
  };

  if (!party.phone && !party.email && !party.address) {
    return null;
  }

  return (
    <View className="bg-white p-4 mt-3 border-y border-gray-100">
      <Text className="text-sm font-semibold text-gray-900 mb-3">
        Contact Information
      </Text>

      {party.phone && (
        <TouchableOpacity
          className="flex-row items-center py-3 border-b border-gray-100"
          onPress={handleCall}
        >
          <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center">
            <Ionicons name="call" size={20} color="#3B82F6" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-sm text-gray-500">Phone</Text>
            <Text className="text-base text-gray-900">{party.phone}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {party.email && (
        <TouchableOpacity
          className="flex-row items-center py-3 border-b border-gray-100"
          onPress={handleEmail}
        >
          <View className="w-10 h-10 bg-purple-100 rounded-xl items-center justify-center">
            <Ionicons name="mail" size={20} color="#8B5CF6" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-sm text-gray-500">Email</Text>
            <Text className="text-base text-gray-900">{party.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {party.address && (
        <View className="flex-row items-center py-3">
          <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center">
            <Ionicons name="location" size={20} color="#10B981" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-sm text-gray-500">Address</Text>
            <Text className="text-base text-gray-900">
              {formatAddress(party.address)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
