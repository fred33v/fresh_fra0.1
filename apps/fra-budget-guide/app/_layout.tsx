import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppContext } from "@/contexts/AppContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import { colors, darkColors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkColors : colors;

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="package-info" options={{ title: "Professional Package" }} />
      <Stack.Screen name="package-enterprise" options={{ title: "Enterprise Package" }} />
      <Stack.Screen name="payment" options={{ headerShown: false }} />
      <Stack.Screen name="legal" options={{ title: "Legal & Ethical Duties" }} />
      <Stack.Screen name="fraud-basics" options={{ title: "Fraud Basics" }} />
      <Stack.Screen name="scenarios" options={{ title: "Fraud Scenarios" }} />
      <Stack.Screen name="scenario-detail" options={{ title: "Scenario Details" }} />
      <Stack.Screen name="red-flags" options={{ title: "Red Flags Radar" }} />
      <Stack.Screen name="checklists" options={{ title: "Approval Checklists" }} />
      <Stack.Screen name="authority" options={{ title: "Delegated Authority" }} />
      <Stack.Screen name="reporting" options={{ title: "Report Fraud" }} />
      <Stack.Screen name="whistleblower" options={{ title: "Whistleblower Protection" }} />
      <Stack.Screen name="myths" options={{ title: "Myths vs Reality" }} />
      <Stack.Screen name="pledge" options={{ title: "Your Commitment" }} />
      <Stack.Screen name="resources" options={{ title: "Resources & Support" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContext>
          <GestureHandlerRootView>
            <OfflineBanner />
            <RootLayoutNav />
          </GestureHandlerRootView>
        </AppContext>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
