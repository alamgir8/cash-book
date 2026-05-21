/**
 * AccountFormModal
 *
 * Bottom-sheet modal for creating or editing an account.
 * Extracted from accounts.tsx to keep the screen file lean.
 */
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  useReanimatedKeyboardAnimation,
  KeyboardAwareScrollView,
} from "react-native-keyboard-controller";
import {
  Dimensions,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionButton } from "@/components/action-button";
import { VoiceInputButton } from "@/components/voice-input-button";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/hooks/use-translation";
import type { Account } from "@/services/accounts";

const schema = z.object({
  name: z.string().min(2, "Account name is required"),
  description: z.string().optional(),
});

export type AccountFormValues = z.infer<typeof schema>;

type Props = {
  visible: boolean;
  editingAccount: Account | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<void>;
};

export function AccountFormModal({
  visible,
  editingAccount,
  isSubmitting,
  onClose,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const sheetAnimStyle = useAnimatedStyle(() => ({
    paddingBottom: -kbHeight.value,
  }));

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  // Populate form when editing
  useEffect(() => {
    if (visible) {
      if (editingAccount) {
        reset({
          name: editingAccount.name,
          description: editingAccount.description ?? "",
        });
      } else {
        reset({ name: "", description: "" });
      }
    }
  }, [visible, editingAccount, reset]);

  const handleVoiceResult = (transcript: string) => {
    const nameMatch = transcript.match(
      /account (?:named|called)? ([a-zA-Z0-9 ]+)/i,
    );
    setValue(
      "name",
      nameMatch
        ? nameMatch[1].trim()
        : transcript.split(" account")[0] || transcript,
      {
        shouldDirty: true,
      },
    );
    setValue("description", transcript, { shouldDirty: true });
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            handleClose();
          }}
          style={{ ...StyleSheet.absoluteFillObject }}
        />

        <Animated.View
          style={[
            {
              height: Dimensions.get("window").height * 0.85,
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 24,
            },
            sheetAnimStyle,
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {editingAccount ? t("editAccount") : t("newAccount")}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.text.secondary,
                  marginTop: 2,
                }}
              >
                {editingAccount
                  ? t("updateAccountDetails")
                  : t("createAccountSubtitle")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: colors.bg.tertiary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <KeyboardAwareScrollView
            bottomOffset={100}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingVertical: 20,
              gap: 20,
            }}
          >
            {/* Account Name */}
            <View>
              <Text style={[styles.label, { color: colors.text.primary }]}>
                {t("accountNameLabel")}
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder={t("accountNamePlaceholder")}
                    placeholderTextColor={colors.text.tertiary}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bg.tertiary,
                        color: colors.text.primary,
                        borderColor: errors.name ? colors.error : colors.border,
                      },
                    ]}
                  />
                )}
              />
              {errors.name && (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {errors.name.message}
                </Text>
              )}
            </View>

            {/* Description */}
            <View>
              <Text style={[styles.label, { color: colors.text.primary }]}>
                {t("accountDescriptionLabel")}{" "}
                <Text
                  style={{ color: colors.text.tertiary, fontWeight: "400" }}
                >
                  {t("accountDescriptionOptional")}
                </Text>
              </Text>
              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange } }) => (
                  <TextInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder={t("accountDescriptionPlaceholder")}
                    placeholderTextColor={colors.text.tertiary}
                    style={[
                      styles.input,
                      styles.inputMultiline,
                      {
                        backgroundColor: colors.bg.tertiary,
                        color: colors.text.primary,
                        borderColor: colors.border,
                      },
                    ]}
                    multiline
                    textAlignVertical="top"
                  />
                )}
              />
            </View>

            <VoiceInputButton onResult={handleVoiceResult} />
          </KeyboardAwareScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <ActionButton
              label={
                editingAccount ? t("updateAccountBtn") : t("createAccountBtn")
              }
              onPress={handleSubmit(onSubmit)}
              isLoading={isSubmitting}
              variant="primary"
              size="medium"
              icon={editingAccount ? "checkmark-circle" : "add-circle"}
              fullWidth
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 80,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
