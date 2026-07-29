import React from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";
import { useTheme } from "../hooks/use-theme";

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
  const borderColor = error ? colors.error : colors.border;

  return (
    <View className={`${containerClassName}`}>
      <Text
        style={{ color: colors.text.secondary }}
        className={`mb-2 text-sm font-medium ${labelClassName}`}
      >
        {label}
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.bg.secondary,
          color: colors.text.primary,
          borderColor,
        }}
        className="px-4 py-3 rounded-xl border text-base"
        placeholderTextColor={colors.text.tertiary}
        {...props}
      />
      {error && (
        <Text style={{ color: colors.error }} className="text-xs mt-1">
          {error}
        </Text>
      )}
    </View>
  );
};
