/**
 * Root layout — providers, splash overlay, and auth-aware routing.
 *
 * Authentication flow (Expo Router protected-route pattern):
 *   • `useProtectedRoute` watches the Zustand auth store.
 *   • Unauthenticated users are pushed to /(auth) account selection.
 *   • Authenticated users who land on an auth screen are pushed to the app.
 *   • Navigation only fires once the router is ready AND auth state is hydrated,
 *     so there is never a flash of the wrong screen.
 *
 * NOTE: Client-side redirects here are UX convenience only.
 *       Every sensitive endpoint on the backend MUST still verify the JWT.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useRouter, useSegments } from 'expo-router';
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
  const { isAuthenticated, isHydrated, user } = useAuthStore();

  useEffect(() => {
    // Wait until SecureStore hydration is complete before redirecting.
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';

    if (!isAuthenticated && !inAuthGroup) {
      // Keep the admin entry point when access to its route expires.
      router.replace(
        inAdminGroup
          ? { pathname: '/(auth)/login', params: { admin: '1' } }
          : '/(auth)',
      );
    } else if (isAuthenticated && user?.role === 'admin' && !inAdminGroup) {
      router.replace('/(admin)');
    } else if (
      isAuthenticated &&
      user?.role !== 'admin' &&
      (inAuthGroup || inAdminGroup)
    ) {
      // Non-admin users cannot enter the admin group.
      router.replace('/(app)/(tabs)');
    }
  }, [isAuthenticated, isHydrated, user?.role, segments, router]);
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
