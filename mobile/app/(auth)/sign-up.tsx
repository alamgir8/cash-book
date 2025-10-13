import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Toast from "react-native-toast-message";
import { useAuth } from "../../hooks/useAuth";
import { CustomInput } from "../../components/CustomInput";
import { CustomButton } from "../../components/CustomButton";

const schema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().min(6, "Enter a valid phone number"),
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
      // Type assertion to ensure values match the required SignupPayload type
      await signUp(values as Required<Omit<FormValues, "confirmPassword">>);
      router.replace("/(app)");
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Sign-up failed",
        text2: "Please review your details and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50 px-6"
      contentContainerStyle={{ paddingVertical: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-8">
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
                  value={value}
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
        </View>

        <View className="flex-row justify-center items-center gap-2 mt-6">
          <Text className="text-slate-600 text-base">Already registered?</Text>
          <Link
            href="/(auth)/sign-in"
            className="text-blue-600 font-semibold text-base"
          >
            Sign in
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
