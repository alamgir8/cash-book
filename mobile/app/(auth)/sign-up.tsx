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
import { useAuth } from "../../hooks/useAuth";
import { CustomInput } from "../../components/custom-input";
import { CustomButton } from "../../components/custom-button";

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
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      className="bg-slate-50"
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
            <Text className="text-4xl font-bold text-slate-900 mb-3">
              Create Account
            </Text>
            <Text className="text-lg text-slate-600 text-center leading-6">
              Sign up with your email or phone number to get started.
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
                      field === "phone" ? "Phone number" : `Your ${field}`
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
                  <CustomInput
                    label={
                      field === "confirmPassword"
                        ? "Confirm password"
                        : "Password"
                    }
                    value={value}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    secureTextEntry
                    error={errors[field]?.message}
                  />
                )}
              />
            ))}

            <CustomButton
              title="Create Account"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              containerClassName="mt-6"
            />
            {formError ? (
              <Text className="text-rose-500 text-sm text-center mt-3">
                {formError}
              </Text>
            ) : null}
          </View>

          <View className="flex-row justify-center items-center gap-2 mt-6 pb-6">
            <Text className="text-slate-600 text-base">
              Already registered?
            </Text>
            <Link
              href="/(auth)/sign-in"
              className="text-blue-600 font-semibold text-base"
            >
              Sign in
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
