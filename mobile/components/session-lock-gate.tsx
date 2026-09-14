import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useBiometric } from "@/hooks/use-biometric";
import { PasswordInput } from "@/components/password-input";
import { CustomButton } from "@/components/custom-button";
import {
  getLoginModeSync,
  isSessionUnlocked,
  loadLoginMode,
  markSessionUnlocked,
  subscribeLoginMode,
  type LoginMode,
} from "@/lib/auth/login-mode";
import { probeBackendAvailable } from "@/sync/scheduler";

const schema = z.object({
  password: z.string().min(1, "Enter your password or PIN"),
});

type FormValues = z.infer<typeof schema>;

/**
 * When login mode is "every_time", require a credential check once per launch
 * — but only if the device is online and the backend is reachable.
 * Offline / server-down → unlock automatically so the cash book stays usable.
 *
 * Unlock options: password, PIN, or Face ID / biometric (same as sign-in).
 */
export function SessionLockGate({ children }: { children: React.ReactNode }) {
  const { state, signIn } = useAuth();
  const { colors } = useTheme();
  const {
    status: biometricStatus,
    isAuthenticating,
    findBiometricCredentials,
    getBiometricDisplayName,
    getBiometricIconName,
  } = useBiometric();
  const [mode, setMode] = useState<LoginMode>(getLoginModeSync());
  const [checking, setChecking] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBiometricStored, setHasBiometricStored] = useState(false);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    void loadLoginMode().then(setMode);
    return subscribeLoginMode(setMode);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const { getBiometricUsers } = await import("@/services/biometric");
        const users = await getBiometricUsers();
        setHasBiometricStored(users.length > 0);
      } catch {
        setHasBiometricStored(false);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      if (state.status !== "authenticated") {
        if (!cancelled) {
          setNeedsUnlock(false);
          setChecking(false);
        }
        return;
      }

      if (mode === "single" || isSessionUnlocked()) {
        markSessionUnlocked();
        if (!cancelled) {
          setNeedsUnlock(false);
          setChecking(false);
        }
        return;
      }

      setChecking(true);
      try {
        const net = await NetInfo.fetch();
        // Hard disconnect only — iOS often false-reports reachability.
        if (net.isConnected === false) {
          markSessionUnlocked();
          if (!cancelled) setNeedsUnlock(false);
          return;
        }
        const backendOk = await probeBackendAvailable(3500);
        if (!backendOk) {
          markSessionUnlocked();
          if (!cancelled) setNeedsUnlock(false);
          return;
        }
        if (!cancelled) setNeedsUnlock(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void evaluate();
    return () => {
      cancelled = true;
    };
  }, [state.status, mode]);

  const onUnlock = useCallback(
    async (values: FormValues) => {
      if (state.status !== "authenticated") return;
      setBusy(true);
      setError(null);
      try {
        const identifier =
          state.user.email || state.user.phone || state.user.name;
        const trimmed = values.password.trim();
        const isPin = /^[0-9]{5,6}$/.test(trimmed);
        await signIn({
          identifier,
          ...(isPin ? { pin: trimmed } : { password: trimmed }),
        });
        markSessionUnlocked();
        setNeedsUnlock(false);
      } catch (e: any) {
        setError(e?.message || "Could not verify. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [signIn, state],
  );

  const onBiometricUnlock = useCallback(async () => {
    if (state.status !== "authenticated" || busy || isAuthenticating) return;
    setBusy(true);
    setError(null);
    try {
      const credentials = await findBiometricCredentials();
      if (!credentials) {
        setError("No Face ID credentials saved. Use password or PIN.");
        return;
      }
      await signIn({
        identifier: credentials.identifier,
        password: credentials.password,
      });
      markSessionUnlocked();
      setNeedsUnlock(false);
    } catch (e: any) {
      setError(e?.message || "Face ID unlock failed. Try password or PIN.");
    } finally {
      setBusy(false);
    }
  }, [
    state.status,
    busy,
    isAuthenticating,
    findBiometricCredentials,
    signIn,
  ]);

  if (state.status !== "authenticated") {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg.primary,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const showFace =
    hasBiometricStored || Boolean(biometricStatus?.isAvailable);
  const bioName = getBiometricDisplayName(
    biometricStatus?.biometricType ?? "none",
  );

  return (
    <>
      {children}
      <Modal visible={needsUnlock} animationType="fade" transparent={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            backgroundColor: colors.bg.primary,
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 8,
            }}
          >
            Confirm it’s you
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.text.secondary,
              marginBottom: 24,
            }}
          >
            Login every time is on. Unlock with {bioName}, password, or PIN.
            (Skipped automatically when offline.)
          </Text>

          {showFace ? (
            <TouchableOpacity
              onPress={() => void onBiometricUnlock()}
              disabled={busy || isAuthenticating}
              style={{
                backgroundColor: hasBiometricStored
                  ? `${colors.primary}18`
                  : colors.bg.tertiary,
                borderColor: hasBiometricStored
                  ? colors.primary
                  : colors.border,
                opacity: busy || isAuthenticating ? 0.6 : 1,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 16,
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              {isAuthenticating || busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={getBiometricIconName(
                    biometricStatus?.biometricType ?? "none",
                  )}
                  size={26}
                  color={
                    hasBiometricStored
                      ? colors.primary
                      : colors.text.tertiary
                  }
                />
              )}
              <Text
                style={{
                  color: hasBiometricStored
                    ? colors.primary
                    : colors.text.secondary,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                Unlock with {bioName}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <PasswordInput
                label="Password or PIN"
                value={value}
                onChangeText={onChange}
              />
            )}
          />

          {error ? (
            <Text style={{ color: colors.error, marginTop: 8 }}>{error}</Text>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <CustomButton
              title={busy ? "Checking…" : "Unlock"}
              onPress={handleSubmit(onUnlock)}
              disabled={busy}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
