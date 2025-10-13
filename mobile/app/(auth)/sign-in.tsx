import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';

const schema = z.object({
  identifier: z.string().min(2, 'Enter your email or phone'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: '',
      password: ''
    }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true);
      await signIn(values);
      router.replace('/(app)');
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Sign-in failed',
        text2: 'Check your credentials and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-primary px-6 justify-center gap-6">
      <View>
        <Text className="text-4xl font-bold text-white">Welcome Back</Text>
        <Text className="text-base text-slate-300 mt-2">
          Manage your debit and credit accounts effortlessly.
        </Text>
      </View>

      <View className="gap-4">
        <Controller
          control={control}
          name="identifier"
          render={({ field: { onChange, value } }) => (
            <View>
              <Text className="text-slate-200 mb-2">Email or phone</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Email or phone number"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                className="bg-slate-900/60 text-white px-4 py-3 rounded-xl border border-slate-700"
              />
              {errors.identifier && (
                <Text className="text-red-400 text-sm mt-1">{errors.identifier.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <View>
              <Text className="text-slate-200 mb-2">Password</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                secureTextEntry
                className="bg-slate-900/60 text-white px-4 py-3 rounded-xl border border-slate-700"
              />
              {errors.password && (
                <Text className="text-red-400 text-sm mt-1">{errors.password.message}</Text>
              )}
            </View>
          )}
        />

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
          className="bg-accent rounded-xl py-3 mt-2 items-center flex-row justify-center"
        >
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text className="text-primary font-semibold text-base">Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-2">
        <Text className="text-slate-400">New here?</Text>
        <Link href="/(auth)/sign-up" className="text-accent font-semibold">
          Create an account
        </Link>
      </View>
    </View>
  );
}
