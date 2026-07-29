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
  style,
  ...props
}) => {
  const { colors } = useTheme();
  const borderColor = error ? colors.error : colors.border;

  return (
    <View className={`${containerClassName}`}>
      <Text
        style={{ color: colors.text.primary }}
        className={`mb-2 text-sm font-semibold ${labelClassName}`}
      >
        {label}
      </Text>
      <TextInput
        style={[
          {
            backgroundColor: colors.bg.tertiary,
            color: colors.text.primary,
            borderColor,
            minHeight: props.multiline ? undefined : 48,
          },
          style,
        ]}
        className={`px-4 py-3 rounded-xl border text-base ${inputClassName}`}
        placeholderTextColor={colors.text.tertiary}
        {...props}
      />
      {error ? (
        <Text style={{ color: colors.error }} className="text-sm mt-1">
          {error}
        </Text>
      ) : null}
    </View>
  );
};
