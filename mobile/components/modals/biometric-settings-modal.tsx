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
import { useTheme } from "@/hooks/useTheme";

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
  const { colors } = useTheme();
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
          status.biometricType,
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
        ],
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
            status?.biometricType || "none",
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
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <View
            className="rounded-t-3xl p-6 max-h-[80%]"
            style={{ backgroundColor: colors.bg.primary }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center gap-3">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.info + "15" }}
                >
                  <Ionicons
                    name={biometricIcon}
                    size={24}
                    color={colors.info}
                  />
                </View>
                <View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {biometricName} Login
                  </Text>
                  <Text
                    className="text-sm"
                    style={{ color: colors.text.secondary }}
                  >
                    Quick and secure access
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                className="p-2 rounded-full"
                style={{ backgroundColor: colors.bg.tertiary }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {isLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="large" color={colors.info} />
                  <Text
                    className="mt-4"
                    style={{ color: colors.text.secondary }}
                  >
                    Checking biometric availability...
                  </Text>
                </View>
              ) : !status?.isAvailable ? (
                /* Biometric not available */
                <View
                  className="rounded-2xl p-6 items-center"
                  style={{ backgroundColor: colors.warning + "15" }}
                >
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: colors.warning + "30" }}
                  >
                    <Ionicons
                      name="warning-outline"
                      size={32}
                      color={colors.warning}
                    />
                  </View>
                  <Text
                    className="text-lg font-bold text-center mb-2"
                    style={{ color: colors.text.primary }}
                  >
                    Biometric Not Available
                  </Text>
                  <Text
                    className="text-center"
                    style={{ color: colors.text.secondary }}
                  >
                    Your device does not support biometric authentication or no
                    biometrics are enrolled. Please set up fingerprint or Face
                    ID in your device settings.
                  </Text>
                </View>
              ) : showPasswordInput ? (
                /* Password input for enabling biometric */
                <View className="gap-4">
                  <View
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: colors.info + "15" }}
                  >
                    <View className="flex-row items-start gap-3">
                      <Ionicons
                        name="information-circle"
                        size={20}
                        color={colors.info}
                      />
                      <Text
                        className="text-sm flex-1"
                        style={{ color: colors.text.primary }}
                      >
                        Enter your password to enable {biometricName} login.
                        Your credentials will be stored securely on this device.
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text
                      className="font-medium mb-2"
                      style={{ color: colors.text.primary }}
                    >
                      Email
                    </Text>
                    <View
                      className="rounded-xl p-4"
                      style={{ backgroundColor: colors.bg.tertiary }}
                    >
                      <Text style={{ color: colors.text.secondary }}>
                        {userEmail}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text
                      className="font-medium mb-2"
                      style={{ color: colors.text.primary }}
                    >
                      Password
                    </Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      secureTextEntry
                      autoCapitalize="none"
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: colors.bg.tertiary,
                        color: colors.text.primary,
                      }}
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>

                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={() => {
                        setShowPasswordInput(false);
                        setPassword("");
                      }}
                      className="flex-1 rounded-xl py-4"
                      style={{ backgroundColor: colors.bg.tertiary }}
                      disabled={isSubmitting}
                    >
                      <Text
                        className="font-bold text-center"
                        style={{ color: colors.text.primary }}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleEnableBiometric}
                      disabled={isSubmitting || !password.trim()}
                      className="flex-1 rounded-xl py-4"
                      style={{
                        backgroundColor: colors.info,
                        opacity: isSubmitting || !password.trim() ? 0.6 : 1,
                      }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text
                          className="font-bold text-center"
                          style={{ color: "#fff" }}
                        >
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
                    className="rounded-2xl p-5"
                    style={{
                      backgroundColor: status.isEnabled
                        ? colors.success + "15"
                        : colors.bg.tertiary,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-4 flex-1">
                        <View
                          className="w-14 h-14 rounded-full items-center justify-center"
                          style={{
                            backgroundColor: status.isEnabled
                              ? colors.success + "30"
                              : colors.bg.secondary,
                          }}
                        >
                          <Ionicons
                            name={biometricIcon}
                            size={28}
                            color={
                              status.isEnabled
                                ? colors.success
                                : colors.text.secondary
                            }
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="font-bold text-lg"
                            style={{ color: colors.text.primary }}
                          >
                            {biometricName}
                          </Text>
                          <Text
                            className="text-sm"
                            style={{ color: colors.text.secondary }}
                          >
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
                        trackColor={{
                          false: colors.border,
                          true: colors.success,
                        }}
                        thumbColor={status.isEnabled ? "#fff" : "#f4f4f5"}
                      />
                    </View>
                  </View>

                  {/* Info section */}
                  <View
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: colors.info + "15" }}
                  >
                    <View className="flex-row items-start gap-3">
                      <Ionicons
                        name="shield-checkmark"
                        size={20}
                        color={colors.info}
                      />
                      <View className="flex-1">
                        <Text
                          className="font-medium mb-1"
                          style={{ color: colors.text.primary }}
                        >
                          Secure & Convenient
                        </Text>
                        <Text
                          className="text-sm"
                          style={{ color: colors.text.secondary }}
                        >
                          Your credentials are stored securely on this device
                          using encrypted storage. Only your registered
                          biometrics can unlock them.
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Features list */}
                  <View className="gap-3 mt-2">
                    <Text
                      className="font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      Benefits:
                    </Text>
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.success + "15" }}
                      >
                        <Ionicons
                          name="flash-outline"
                          size={16}
                          color={colors.success}
                        />
                      </View>
                      <Text
                        className="flex-1"
                        style={{ color: colors.text.secondary }}
                      >
                        Instant login without typing password
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.info + "15" }}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={16}
                          color={colors.info}
                        />
                      </View>
                      <Text
                        className="flex-1"
                        style={{ color: colors.text.secondary }}
                      >
                        Credentials encrypted with device security
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.info + "15" }}
                      >
                        <Ionicons
                          name="people-outline"
                          size={16}
                          color={colors.info}
                        />
                      </View>
                      <Text
                        className="flex-1"
                        style={{ color: colors.text.secondary }}
                      >
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
