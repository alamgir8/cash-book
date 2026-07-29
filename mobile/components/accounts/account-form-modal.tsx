/**
 * AccountFormModal
 *
 * Bottom-sheet modal for creating or editing an account.
 */
import { Text, TextInput, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { FormSheetModal } from "@/components/form-sheet-modal";
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
      { shouldDirty: true },
    );
    setValue("description", transcript, { shouldDirty: true });
  };

  return (
    <FormSheetModal
      visible={visible}
      onClose={onClose}
      title={editingAccount ? t("editAccount") : t("newAccount")}
      subtitle={
        editingAccount
          ? t("updateAccountDetails")
          : t("createAccountSubtitle")
      }
      submitLabel={
        editingAccount ? t("updateAccountBtn") : t("createAccountBtn")
      }
      submitIcon={editingAccount ? "checkmark-circle" : "add-circle"}
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      submittingLabel={t("saving")}
    >
      <View className="gap-5">
        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
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
                style={{
                  backgroundColor: colors.bg.tertiary,
                  color: colors.text.primary,
                  borderColor: errors.name ? colors.error : colors.border,
                }}
                className="px-4 py-3 rounded-xl border"
              />
            )}
          />
          {errors.name ? (
            <Text className="text-sm mt-1" style={{ color: colors.error }}>
              {errors.name.message}
            </Text>
          ) : null}
        </View>

        <View>
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
            {t("accountDescriptionLabel")}{" "}
            <Text style={{ color: colors.text.tertiary, fontWeight: "400" }}>
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
                style={{
                  backgroundColor: colors.bg.tertiary,
                  color: colors.text.primary,
                  borderColor: colors.border,
                }}
                className="px-4 py-3 rounded-xl border min-h-[80px]"
                multiline
                textAlignVertical="top"
              />
            )}
          />
        </View>

        <VoiceInputButton onResult={handleVoiceResult} />
      </View>
    </FormSheetModal>
  );
}
