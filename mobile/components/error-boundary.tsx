import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 bg-gray-50 items-center justify-center p-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-lg">
            <View className="items-center mb-6">
              <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="alert-circle" size={48} color="#ef4444" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </Text>
              <Text className="text-gray-600 text-center text-base">
                An unexpected error occurred. Please try again.
              </Text>
            </View>

            {__DEV__ && this.state.error && (
              <ScrollView
                className="bg-gray-100 rounded-xl p-4 mb-4 max-h-48"
                showsVerticalScrollIndicator
              >
                <Text className="text-xs font-mono text-gray-800">
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text className="text-xs font-mono text-gray-600 mt-2">
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={this.handleReset}
              className="bg-blue-600 rounded-2xl py-4 active:scale-95"
            >
              <Text className="text-white text-center font-bold text-base">
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
