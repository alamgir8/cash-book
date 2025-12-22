import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useBiometric } from "../../hooks/useBiometric";

interface BiometricSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
}

export function BiometricSettingsModal({
  visible,
  onClose,
  userEmail,
}: BiometricSettingsModalProps) {
  // Pass userEmail as userIdentifier for per-user biometric storage
  const {
    status,
    isLoading,
    isEnabling,
    enableBiometric,
    disableBiometric,
    getBiometricDisplayName,
    getBiometricIconName,
  } = useBiometric({ userIdentifier: userEmail });

  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleBiometric = async () => {
    if (!status) return;

    if (status.isEnabled) {
      // Disable biometric
      Alert.alert(
        "Disable Biometric Login",
        `Are you sure you want to disable ${getBiometricDisplayName(
          status.biometricType
        )} login?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              const success = await disableBiometric();
              if (success) {
                Toast.show({
                  type: "success",
                  text1: "Biometric login disabled",
                });
              } else {
                Toast.show({
                  type: "error",
                  text1: "Failed to disable biometric login",
                });
              }
            },
          },
        ]
      );
    } else {
      // Show password input to enable biometric
      setShowPasswordInput(true);
      setPassword("");
    }
  };

  const handleEnableBiometric = async () => {
    if (!userEmail || !password.trim()) {
      Toast.show({
        type: "error",
        text1: "Please enter your password",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const success = await enableBiometric({
        identifier: userEmail,
        password: password.trim(),
      });

      if (success) {
        Toast.show({
          type: "success",
          text1: "Biometric login enabled",
          text2: `You can now login using ${getBiometricDisplayName(
            status?.biometricType || "none"
          )}`,
        });
        setShowPasswordInput(false);
        setPassword("");
      } else {
        Toast.show({
          type: "error",
          text1: "Failed to enable biometric login",
          text2: "Please try again",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowPasswordInput(false);
    setPassword("");
    onClose();
  };

  const biometricIcon = status
    ? getBiometricIconName(status.biometricType)
    : "finger-print";
  const biometricName = status
    ? getBiometricDisplayName(status.biometricType)
    : "Biometric";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center">
                  <Ionicons name={biometricIcon} size={24} color="#8b5cf6" />
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-900">
                    {biometricName} Login
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    Quick and secure access
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                className="p-2 rounded-full bg-gray-100"
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {isLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="large" color="#8b5cf6" />
                  <Text className="text-gray-500 mt-4">
                    Checking biometric availability...
                  </Text>
                </View>
              ) : !status?.isAvailable ? (
                /* Biometric not available */
                <View className="bg-amber-50 rounded-2xl p-6 items-center">
                  <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-4">
                    <Ionicons
                      name="warning-outline"
                      size={32}
                      color="#f59e0b"
                    />
                  </View>
                  <Text className="text-lg font-bold text-gray-900 text-center mb-2">
                    Biometric Not Available
                  </Text>
                  <Text className="text-gray-600 text-center">
                    Your device does not support biometric authentication or no
                    biometrics are enrolled. Please set up fingerprint or Face
                    ID in your device settings.
                  </Text>
                </View>
              ) : showPasswordInput ? (
                /* Password input for enabling biometric */
                <View className="gap-4">
                  <View className="bg-blue-50 rounded-2xl p-4">
                    <View className="flex-row items-start gap-3">
                      <Ionicons
                        name="information-circle"
                        size={20}
                        color="#3b82f6"
                      />
                      <Text className="text-blue-800 text-sm flex-1">
                        Enter your password to enable {biometricName} login.
                        Your credentials will be stored securely on this device.
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className="text-gray-700 font-medium mb-2">
                      Email
                    </Text>
                    <View className="bg-gray-100 rounded-xl p-4">
                      <Text className="text-gray-600">{userEmail}</Text>
                    </View>
                  </View>

                  <View>
                    <Text className="text-gray-700 font-medium mb-2">
                      Password
                    </Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      secureTextEntry
                      autoCapitalize="none"
                      className="bg-gray-100 rounded-xl p-4 text-gray-900"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={() => {
                        setShowPasswordInput(false);
                        setPassword("");
                      }}
                      className="flex-1 bg-gray-100 rounded-xl py-4"
                      disabled={isSubmitting}
                    >
                      <Text className="text-gray-700 font-bold text-center">
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleEnableBiometric}
                      disabled={isSubmitting || !password.trim()}
                      className="flex-1 bg-purple-600 rounded-xl py-4"
                      style={{
                        opacity: isSubmitting || !password.trim() ? 0.6 : 1,
                      }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text className="text-white font-bold text-center">
                          Enable {biometricName}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* Main biometric settings */
                <View className="gap-4">
                  {/* Status card */}
                  <View
                    className={`rounded-2xl p-5 ${
                      status.isEnabled ? "bg-green-50" : "bg-gray-50"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-4 flex-1">
                        <View
                          className={`w-14 h-14 rounded-full items-center justify-center ${
                            status.isEnabled ? "bg-green-100" : "bg-gray-200"
                          }`}
                        >
                          <Ionicons
                            name={biometricIcon}
                            size={28}
                            color={status.isEnabled ? "#16a34a" : "#6b7280"}
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-gray-900 font-bold text-lg">
                            {biometricName}
                          </Text>
                          <Text className="text-gray-600 text-sm">
                            {status.isEnabled
                              ? "Enabled - Login with your biometric"
                              : "Disabled - Tap to enable"}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={status.isEnabled}
                        onValueChange={handleToggleBiometric}
                        disabled={isEnabling}
                        trackColor={{ false: "#d1d5db", true: "#86efac" }}
                        thumbColor={status.isEnabled ? "#16a34a" : "#f4f4f5"}
                      />
                    </View>
                  </View>

                  {/* Info section */}
                  <View className="bg-purple-50 rounded-2xl p-4">
                    <View className="flex-row items-start gap-3">
                      <Ionicons
                        name="shield-checkmark"
                        size={20}
                        color="#8b5cf6"
                      />
                      <View className="flex-1">
                        <Text className="text-purple-800 font-medium mb-1">
                          Secure & Convenient
                        </Text>
                        <Text className="text-purple-700 text-sm">
                          Your credentials are stored securely on this device
                          using encrypted storage. Only your registered
                          biometrics can unlock them.
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Features list */}
                  <View className="gap-3 mt-2">
                    <Text className="text-gray-700 font-bold">Benefits:</Text>
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center">
                        <Ionicons
                          name="flash-outline"
                          size={16}
                          color="#16a34a"
                        />
                      </View>
                      <Text className="text-gray-600 flex-1">
                        Instant login without typing password
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center">
                        <Ionicons
                          name="lock-closed-outline"
                          size={16}
                          color="#3b82f6"
                        />
                      </View>
                      <Text className="text-gray-600 flex-1">
                        Credentials encrypted with device security
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center">
                        <Ionicons
                          name="people-outline"
                          size={16}
                          color="#8b5cf6"
                        />
                      </View>
                      <Text className="text-gray-600 flex-1">
                        Works with all enrolled fingerprints on your device
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
