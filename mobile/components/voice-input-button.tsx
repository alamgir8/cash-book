import { useEffect, useState } from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "../hooks/useTheme";

type Props = {
  onResult: (transcript: string) => void;
};

export const VoiceInputButton = ({ onResult }: Props) => {
  const { colors } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Initialize speech recognition for web platform
    if (Platform.OS === "web" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
        setIsListening(false);
        setLoading(false);
      };

      recognitionInstance.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        setLoading(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
        setLoading(false);
      };

      setRecognition(recognitionInstance);
    }
  }, [onResult]);

  const startListening = async () => {
    if (Platform.OS === "web" && recognition) {
      try {
        setLoading(true);
        recognition.start();
        setIsListening(true);
        setLoading(false);
      } catch (error) {
        console.warn("Failed to start speech recognition", error);
        setLoading(false);
      }
    } else {
      // For mobile platforms, show a message that voice input is only available on web
      console.warn("Voice input is only available on web platform");
      // You could show a toast message here or handle this differently
    }
  };

  const stopListening = async () => {
    if (Platform.OS === "web" && recognition) {
      try {
        recognition.stop();
      } catch (error) {
        console.warn("Failed to stop speech recognition", error);
      } finally {
        setIsListening(false);
        setLoading(false);
      }
    }
  };

  // Don't render the button on mobile platforms where it won't work
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={isListening ? stopListening : startListening}
      style={{
        backgroundColor: isListening
          ? colors.success + "20"
          : colors.warning + "20",
        borderColor: isListening ? colors.success : colors.warning,
        shadowColor: isListening ? colors.success : colors.warning,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }}
      className="w-full py-4 rounded-2xl border-2 flex-row gap-3 items-center justify-center"
    >
      {loading ? (
        <ActivityIndicator
          color={isListening ? colors.success : colors.warning}
        />
      ) : (
        <>
          <Text className="text-2xl">{isListening ? "🎤" : "🎙️"}</Text>
          <Text
            style={{
              color: isListening ? colors.success : colors.warning,
            }}
            className="font-bold"
          >
            {isListening
              ? "Listening... tap to finish"
              : "🗣️ Add details using voice"}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};
