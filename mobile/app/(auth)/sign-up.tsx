import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { CustomInput } from "@/components/custom-input";
import { PasswordInput } from "@/components/password-input";
import { CustomButton } from "@/components/custom-button";
import { useTranslation } from "@/hooks/use-translation";

const schema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z
      .string()
      .trim()
      .min(6, "Enter a valid phone number")
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async ({ confirmPassword, ...values }: FormValues) => {
    try {
      setLoading(true);
      setFormError(null);
      await signUp({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone?.trim() ? values.phone.trim() : undefined,
      });
      router.replace("/(app)");
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message) {
        setFormError(error.message);
      } else {
        setFormError(t("somethingWentWrong"));
      }
    } finally {
      setLoading(false);
    }
  };

  const { colors } = useTheme();
  const { t } = useTranslation();

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
        <View className="gap-8 py-12">
          <View className="items-center mb-4">
            <Text
              style={{ color: colors.text.primary }}
              className="text-4xl font-bold mb-3"
            >
              {t("createAccountTitle")}
            </Text>
            <Text
              style={{ color: colors.text.secondary }}
              className="text-lg text-center leading-6"
            >
              {t("signUpDescription")}
            </Text>
          </View>

          <View className="gap-6">
            {(["name", "email", "phone"] as const).map((field) => (
              <Controller
                key={field}
                control={control}
                name={field}
                render={({ field: { onChange, value } }) => (
                  <CustomInput
                    label={field.charAt(0).toUpperCase() + field.slice(1)}
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder={
                      field === "phone"
                        ? t("phonePlaceholder")
                        : `Your ${field}`
                    }
                    autoCapitalize={field === "email" ? "none" : "words"}
                    keyboardType={
                      field === "phone"
                        ? "phone-pad"
                        : field === "email"
                          ? "email-address"
                          : "default"
                    }
                    error={errors[field]?.message}
                  />
                )}
              />
            ))}

            {(["password", "confirmPassword"] as const).map((field) => (
              <Controller
                key={field}
                control={control}
                name={field}
                render={({ field: { onChange, value } }) => (
                  <PasswordInput
                    label={
                      field === "confirmPassword"
                        ? t("confirmPassword")
                        : t("password")
                    }
                    value={value}
                    onChangeText={onChange}
                    placeholder={t("passwordPlaceholder")}
                    error={errors[field]?.message}
                  />
                )}
              />
            ))}

            <CustomButton
              title={t("createAccountTitle")}
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              containerClassName="mt-6"
            />
            {formError ? (
              <Text
                style={{ color: colors.error }}
                className="text-sm text-center mt-3"
              >
                {formError}
              </Text>
            ) : null}
          </View>

          <View className="flex-row justify-center items-center gap-2 mt-6 pb-6">
            <Text
              style={{ color: colors.text.secondary }}
              className="text-base"
            >
              {t("alreadyRegistered")}
            </Text>
            <Link
              href="/(auth)/sign-in"
              style={{ color: colors.primary }}
              className="font-semibold text-base"
            >
              {t("signInLink")}
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
