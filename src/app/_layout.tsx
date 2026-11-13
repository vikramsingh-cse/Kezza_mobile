/**
 * Root layout — providers, splash overlay, and auth-aware routing.
 *
 * Authentication flow (Expo Router protected-route pattern):
 *   • `useProtectedRoute` watches the Zustand auth store.
 *   • Unauthenticated users are pushed to /(auth)/login.
 *   • Authenticated users who land on an auth screen are pushed to the app.
 *   • Navigation only fires once the router is ready AND auth state is hydrated,
 *     so there is never a flash of the wrong screen.
 *
 * NOTE: Client-side redirects here are UX convenience only.
 *       Every sensitive endpoint on the backend MUST still verify the JWT.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth-store';

SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Hook: redirect based on auth state
// ---------------------------------------------------------------------------
function useProtectedRoute() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    // Wait until SecureStore hydration is complete before redirecting.
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Not signed in → send to login.
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Already signed in → skip auth screens.
      router.replace('/(app)/(tabs)');
    }
  }, [isAuthenticated, isHydrated, segments, router]);
}

// ---------------------------------------------------------------------------
// Root layout component
// ---------------------------------------------------------------------------
export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Hydrate auth state from SecureStore on first mount.
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  // Wire up route protection.
  useProtectedRoute();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {/* Slot renders whichever child route is active */}
        <Slot />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
