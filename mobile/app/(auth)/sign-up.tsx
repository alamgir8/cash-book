import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../hooks/useAuth';

const schema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().min(6, 'Enter a valid phone number'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match'
  });

type FormValues = z.infer<typeof schema>;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async ({ confirmPassword, ...values }: FormValues) => {
    try {
      setLoading(true);
      await signUp(values);
      router.replace('/(app)');
    } catch (error) {
      console.error(error);
      Toast.show({
        type: 'error',
        text1: 'Sign-up failed',
        text2: 'Please review your details and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-primary px-6" contentContainerStyle={{ paddingVertical: 48 }}>
      <View className="gap-6">
        <View>
          <Text className="text-4xl font-bold text-white">Create Account</Text>
          <Text className="text-base text-slate-300 mt-2">
            Sign up with your email or phone number to get started.
          </Text>
        </View>

        <View className="gap-4">
          {(['name', 'email', 'phone'] as const).map((field) => (
            <Controller
              key={field}
              control={control}
              name={field}
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text className="text-slate-200 mb-2 capitalize">{field}</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder={field === 'phone' ? 'Phone number' : `Your ${field}`}
                    placeholderTextColor="#94a3b8"
                    autoCapitalize={field === 'email' ? 'none' : 'words'}
                    keyboardType={field === 'phone' ? 'phone-pad' : 'default'}
                    className="bg-slate-900/60 text-white px-4 py-3 rounded-xl border border-slate-700"
                  />
                  {errors[field] && (
                    <Text className="text-red-400 text-sm mt-1">{errors[field]?.message}</Text>
                  )}
                </View>
              )}
            />
          ))}

          {(['password', 'confirmPassword'] as const).map((field) => (
            <Controller
              key={field}
              control={control}
              name={field}
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text className="text-slate-200 mb-2">
                    {field === 'confirmPassword' ? 'Confirm password' : 'Password'}
                  </Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    secureTextEntry
                    className="bg-slate-900/60 text-white px-4 py-3 rounded-xl border border-slate-700"
                  />
                  {errors[field] && (
                    <Text className="text-red-400 text-sm mt-1">{errors[field]?.message}</Text>
                  )}
                </View>
              )}
            />
          ))}

          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            className="bg-accent rounded-xl py-3 mt-2 items-center flex-row justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text className="text-primary font-semibold text-base">Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 justify-center">
          <Text className="text-slate-400">Already registered?</Text>
          <Link href="/(auth)/sign-in" className="text-accent font-semibold">
            Sign in
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
