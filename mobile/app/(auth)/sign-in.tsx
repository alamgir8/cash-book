import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { View, Text } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../hooks/useAuth";
import { CustomInput } from "../../components/custom-input";
import { CustomButton } from "../../components/custom-button";

const schema = z.object({
  identifier: z.string().min(2, "Enter your email or phone"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true);
      setFormError(null);
      // Type assertion to ensure values match the required Credentials type
      await signIn(values as Required<FormValues>);
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
    <View className="flex-1 bg-slate-50 px-6 justify-center gap-8">
      <View className="items-center mb-8">
        <Text className="text-4xl font-bold text-slate-900 mb-3">
          Welcome Back
        </Text>
        <Text className="text-lg text-slate-600 text-center leading-6">
          Manage your debit and credit accounts effortlessly.
        </Text>
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

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <CustomInput
              label="Password"
              value={value}
              onChangeText={onChange}
              placeholder="••••••••"
              autoCapitalize="none"
              secureTextEntry
              error={errors.password?.message}
            />
          )}
        />

        <CustomButton
          title="Sign In"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          containerClassName="mt-4"
        />
        {formError ? (
          <Text className="text-rose-500 text-sm text-center mt-3">
            {formError}
          </Text>
        ) : null}
      </View>

      <View className="flex-row justify-center items-center gap-2 mt-8">
        <Text className="text-slate-600 text-base">New here?</Text>
        <Link
          href="/(auth)/sign-up"
          className="text-blue-600 font-semibold text-base"
        >
          Create an account
        </Link>
      </View>
    </View>
  );
}
