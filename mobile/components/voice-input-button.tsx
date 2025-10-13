import { useEffect, useState } from "react";
import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import * as Speech from "expo-speech";

type Props = {
  onResult: (transcript: string) => void;
};

export const VoiceInputButton = ({ onResult }: Props) => {
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleResults = (event: SpeechResultsEvent) => {
      const [result] = event.value ?? [];
      if (result) {
        onResult(result);
      }
      setIsListening(false);
      setLoading(false);
    };

    const handleError = (event: SpeechErrorEvent) => {
      console.warn("Voice recognition error", event.error);
      setIsListening(false);
      setLoading(false);
    };

    Voice.onSpeechResults = handleResults;
    Voice.onSpeechError = handleError;

    return () => {
      Voice.destroy().catch(() => {});
      Voice.removeAllListeners();
    };
  }, [onResult]);

  const startListening = async () => {
    try {
      setLoading(true);
      await Voice.start("en-US");
      setIsListening(true);
    } catch (error) {
      console.warn("Failed to start voice recognition", error);
      setLoading(false);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.warn("Failed to stop voice recognition", error);
    } finally {
      setIsListening(false);
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={isListening ? stopListening : startListening}
      className={`mt-4 w-full py-3 rounded-2xl border border-slate-700 flex-row gap-2 items-center justify-center ${
        isListening ? "bg-emerald-500/20 border-emerald-400" : "bg-slate-900/60"
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#38bdf8" />
      ) : (
        <Text className="text-slate-200 font-semibold">
          {isListening
            ? "Listening... tap to finish"
            : "Add details using voice"}
        </Text>
      )}
    </TouchableOpacity>
  );
};
