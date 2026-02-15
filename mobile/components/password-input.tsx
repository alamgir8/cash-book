import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";

interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> {
  label: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  testID?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  error,
  containerClassName = "",
  labelClassName = "",
  inputClassName = "",
  value,
  onChangeText,
  testID,
  ...props
}) => {
  const { colors } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className={`${containerClassName}`}>
      <Text
        style={{ color: colors.text.primary }}
        className={`mb-3 text-base font-medium ${labelClassName}`}
      >
        {label}
      </Text>
      <View className="relative">
        <TextInput
          style={{
            backgroundColor: colors.bg.secondary,
            color: colors.text.primary,
            borderColor: colors.border,
          }}
          className="px-4 py-4 pr-12 rounded-2xl border text-base shadow-sm"
          placeholderTextColor={colors.text.tertiary}
          secureTextEntry={!showPassword}
          value={value}
          onChangeText={onChangeText}
          testID={testID}
          {...props}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2"
          testID={`${testID}-toggle`}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPassword ? "eye" : "eye-off"}
            size={20}
            color={colors.text.secondary}
          />
        </TouchableOpacity>
      </View>
      {error && (
        <Text style={{ color: colors.error }} className="text-sm mt-2">
          {error}
        </Text>
      )}
    </View>
  );
};
