import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className={`${containerClassName}`}>
      <Text
        className={`text-slate-700 mb-3 text-base font-medium ${labelClassName}`}
      >
        {label}
      </Text>
      <View className="relative">
        <TextInput
          className={`bg-white text-slate-900 px-4 py-4 pr-12 rounded-2xl border border-slate-300 text-base shadow-sm ${inputClassName}`}
          placeholderTextColor="#94a3b8"
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
            color="#64748b"
          />
        </TouchableOpacity>
      </View>
      {error && <Text className="text-red-500 text-sm mt-2">{error}</Text>}
    </View>
  );
};
