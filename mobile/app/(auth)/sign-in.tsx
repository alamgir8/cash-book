import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useBiometric } from "@/hooks/useBiometric";
import { CustomInput } from "@/components/custom-input";
import { PasswordInput } from "@/components/password-input";
import { CustomButton } from "@/components/custom-button";

const schema = z
  .object({
    identifier: z.string().min(2, "Enter your email or phone"),
    password: z
      .union([
        z.string().min(8, "Password must be at least 8 characters"),
        z.literal(""),
      ])
      .optional(),
    pin: z
      .union([
        z.string().regex(/^[0-9]{5}$/, "PIN must be 5 digits"),
        z.literal(""),
      ])
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasPassword = Boolean(data.password && data.password !== "");
    const hasPin = Boolean(data.pin && data.pin !== "");

    if (!hasPassword && !hasPin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your password or PIN",
        path: ["password"],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your password or PIN",
        path: ["pin"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  // No userIdentifier passed - use findBiometricCredentials for login screen
  const {
    status: biometricStatus,
    isLoading: biometricLoading,
    isAuthenticating,
    findBiometricCredentials,
    getBiometricDisplayName,
    getBiometricIconName,
  } = useBiometric();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [usePinLogin, setUsePinLogin] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      password: "",
      pin: "",
    },
  });

  // Try biometric login on mount if enabled
  // Uses findBiometricCredentials to find any user with biometric enabled on this device
  const handleBiometricLogin = useCallback(async () => {
    if (!biometricStatus?.isEnabled || isAuthenticating) return;

    try {
      setFormError(null);
      const credentials = await findBiometricCredentials();
      if (credentials) {
        setLoading(true);
        await signIn({
          identifier: credentials.identifier,
          password: credentials.password,
        });
        router.replace("/(app)");
      }
    } catch (error) {
      console.error("Biometric login failed:", error);
      if (error instanceof Error && error.message) {
        setFormError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [
    biometricStatus?.isEnabled,
    isAuthenticating,
    findBiometricCredentials,
    signIn,
    router,
  ]);

  // Auto-prompt biometric on mount
  useEffect(() => {
    if (biometricStatus?.isEnabled && !biometricLoading) {
      // Small delay to ensure the screen is fully rendered
      const timer = setTimeout(() => {
        handleBiometricLogin();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [biometricStatus?.isEnabled, biometricLoading]);

  useEffect(() => {
    if (usePinLogin) {
      setValue("password", "");
    } else {
      setValue("pin", "");
    }
  }, [setValue, usePinLogin]);

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true);
      setFormError(null);
      const credentials: {
        identifier: string;
        password?: string;
        pin?: string;
      } = {
        identifier: values.identifier.trim(),
      };

      if (usePinLogin) {
        const pinValue = values.pin?.trim();
        if (pinValue) {
          credentials.pin = pinValue;
        }
      } else if (values.password) {
        credentials.password = values.password;
      }

      await signIn(credentials);
      router.replace("/(app)");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message) {
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const { colors, isDark } = useTheme();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center gap-8 py-12">
          <View className="items-center mb-8">
            <Text
              style={{ color: colors.text.primary }}
              className="text-4xl font-bold mb-3"
            >
              Welcome Back
            </Text>
            <Text
              style={{ color: colors.text.secondary }}
              className="text-lg text-center leading-6"
            >
              Manage your debit and credit accounts effortlessly.
            </Text>
            {/* <Image
              source={require("../../image/logo.png")}
              className="w-64 h-64 mt-6"
              resizeMode="contain"
            /> */}
          </View>

          <View className="gap-6">
            <Controller
              control={control}
              name="identifier"
              render={({ field: { onChange, value } }) => (
                <CustomInput
                  label="Email or phone"
                  value={value}
                  onChangeText={onChange}
                  placeholder="Email or phone number"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={errors.identifier?.message}
                />
              )}
            />

            {usePinLogin ? (
              <Controller
                control={control}
                name="pin"
                render={({ field: { onChange, value } }) => (
                  <PasswordInput
                    label="5-digit PIN"
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="Enter PIN"
                    keyboardType="number-pad"
                    maxLength={5}
                    error={errors.pin?.message}
                  />
                )}
              />
            ) : (
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <PasswordInput
                    label="Password"
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    error={errors.password?.message}
                  />
                )}
              />
            )}

            <TouchableOpacity
              onPress={() => setUsePinLogin((prev) => !prev)}
              className="self-end"
            >
              <Text className="text-blue-600 font-semibold text-sm">
                {usePinLogin ? "Use password instead" : "Use PIN instead"}
              </Text>
            </TouchableOpacity>

            <CustomButton
              title="Sign In"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              containerClassName="mt-4"
            />

            {/* Biometric Login Button */}
            {biometricStatus?.isEnabled && (
              <TouchableOpacity
                onPress={handleBiometricLogin}
                disabled={isAuthenticating || loading}
                style={{
                  backgroundColor: `${colors.primary}15`,
                  borderColor: colors.primary,
                  opacity: isAuthenticating || loading ? 0.6 : 1,
                }}
                className="flex-row items-center justify-center gap-3 border rounded-xl py-4 mt-3"
              >
                {isAuthenticating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={getBiometricIconName(biometricStatus.biometricType)}
                    size={24}
                    color={colors.primary}
                  />
                )}
                <Text
                  style={{ color: colors.primary }}
                  className="font-bold text-base"
                >
                  {isAuthenticating
                    ? "Authenticating..."
                    : `Login with ${getBiometricDisplayName(
                        biometricStatus.biometricType,
                      )}`}
                </Text>
              </TouchableOpacity>
            )}

            {formError ? (
              <Text
                style={{ color: colors.error }}
                className="text-sm text-center mt-3"
              >
                {formError}
              </Text>
            ) : null}
          </View>

          <View className="flex-row justify-center items-center gap-2 mt-8">
            <Text
              style={{ color: colors.text.secondary }}
              className="text-base"
            >
              New here?
            </Text>
            <Link
              href="/(auth)/sign-up"
              style={{ color: colors.primary }}
              className="font-semibold text-base"
            >
              Create an account
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
