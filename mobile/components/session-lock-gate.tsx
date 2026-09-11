import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
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
 */
export function SessionLockGate({ children }: { children: React.ReactNode }) {
  const { state, signIn } = useAuth();
  const { colors } = useTheme();
  const [mode, setMode] = useState<LoginMode>(getLoginModeSync());
  const [checking, setChecking] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    void loadLoginMode().then(setMode);
    return subscribeLoginMode(setMode);
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
        const online =
          net.isConnected === true && net.isInternetReachable !== false;
        if (!online) {
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
            Login every time is on. Enter your password or PIN to continue.
            (Skipped automatically when offline.)
          </Text>

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
