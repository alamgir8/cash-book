import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";
import { useTheme } from "../hooks/useTheme";

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
  const { colors } = useTheme();

  return (
    <View className={`${containerClassName}`}>
      <Text
        style={{ color: colors.text.primary }}
        className={`mb-3 text-base font-medium ${labelClassName}`}
      >
        {label}
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.bg.secondary,
          color: colors.text.primary,
          borderColor: colors.border,
        }}
        className="px-4 py-4 rounded-2xl border text-base shadow-sm"
        placeholderTextColor={colors.text.tertiary}
        {...props}
      />
      {error && (
        <Text style={{ color: colors.error }} className="text-sm mt-2">
          {error}
        </Text>
      )}
    </View>
  );
};
