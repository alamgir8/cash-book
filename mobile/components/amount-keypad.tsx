import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AmountKeypadProps = {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  onDone?: () => void;
  backgroundColor: string;
  keyColor: string;
  keyTextColor: string;
  borderColor: string;
  accentColor: string;
};

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

/**
 * In-app decimal pad for amount fields.
 * Used on Android so third-party IMEs (Avro, etc.) cannot force QWERTY.
 */
export function AmountKeypad({
  onDigit,
  onDecimal,
  onBackspace,
  onDone,
  backgroundColor,
  keyColor,
  keyTextColor,
  borderColor,
  accentColor,
}: AmountKeypadProps) {
  return (
    <View
      style={{
        backgroundColor,
        borderTopWidth: 1,
        borderTopColor: borderColor,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
        gap: 6,
      }}
    >
      {KEYS.map((row) => (
        <View key={row.join("-")} style={{ flexDirection: "row", gap: 6 }}>
          {row.map((key) => {
            const isBack = key === "back";
            return (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  if (isBack) onBackspace();
                  else if (key === ".") onDecimal();
                  else onDigit(key);
                }}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: keyColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isBack ? (
                  <Ionicons
                    name="backspace-outline"
                    size={22}
                    color={keyTextColor}
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "600",
                      color: keyTextColor,
                    }}
                  >
                    {key}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {onDone ? (
        <TouchableOpacity
          onPress={onDone}
          activeOpacity={0.8}
          style={{
            height: 40,
            borderRadius: 10,
            backgroundColor: accentColor,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            Done
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
