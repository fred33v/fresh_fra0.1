import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/contexts/AuthContext';
import { TrainingProvider } from '@/contexts/TrainingContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen
        name="section/[id]"
        options={{ title: 'Section' }}
      />
      <Stack.Screen
        name="quiz/[sectionId]"
        options={{ title: 'Knowledge Check' }}
      />
      <Stack.Screen
        name="scenario"
        options={{ title: 'The Suspicious Invoice' }}
      />
      <Stack.Screen
        name="action-plan"
        options={{ title: 'Your Action Plan' }}
      />
      <Stack.Screen
        name="certificate"
        options={{ headerShown: false }}
      />
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
        <AuthProvider>
          <TrainingProvider>
            <GestureHandlerRootView>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </TrainingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
