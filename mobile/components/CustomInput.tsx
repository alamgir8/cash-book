import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";

interface CustomInputProps extends TextInputProps {
  label: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  error,
  containerClassName = "",
  labelClassName = "",
  inputClassName = "",
  ...props
}) => {
  return (
    <View className={`${containerClassName}`}>
      <Text
        className={`text-slate-700 mb-3 text-base font-medium ${labelClassName}`}
      >
        {label}
      </Text>
      <TextInput
        className={`bg-white text-slate-900 px-4 py-4 rounded-2xl border border-slate-300 text-base shadow-sm ${inputClassName}`}
        placeholderTextColor="#94a3b8"
        {...props}
      />
      {error && <Text className="text-red-500 text-sm mt-2">{error}</Text>}
    </View>
  );
};
