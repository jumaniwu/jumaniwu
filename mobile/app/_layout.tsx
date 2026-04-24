import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../services/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30000 } },
});

function AuthBootstrap() {
  const { setTokens, setUser, clearAuth } = useAuthStore();

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (!token) return;
        const { data } = await usersApi.getMe();
        setUser(data.data);
      } catch {
        await clearAuth();
      }
    })();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="property/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="assets-overview" options={{ presentation: 'card' }} />
          <Stack.Screen name="yield-reports" options={{ presentation: 'card' }} />
          <Stack.Screen name="withdrawals" options={{ presentation: 'card' }} />
          <Stack.Screen name="referrals" options={{ presentation: 'card' }} />
          <Stack.Screen name="top-referrers" options={{ presentation: 'card' }} />
          <Stack.Screen name="my-profile" options={{ presentation: 'card' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
