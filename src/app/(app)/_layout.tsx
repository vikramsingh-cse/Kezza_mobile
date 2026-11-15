/**
 * Protected app group layout.
 *
 * Acts as the second line of defence against unauthenticated access:
 * if the root layout redirect hasn't fired yet (edge case on slow devices),
 * this layout also redirects to login.
 *
 * Contains a Stack that hosts:
 *  • (tabs)  — the three main tabs
 *  • profile — the profile screen (pushed modally from any tab)
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function AppLayout() {
  const { isAuthenticated, isHydrated, user } = useAuthStore();

  // Still loading from SecureStore — render nothing to avoid a flash.
  if (!isHydrated) return null;

  // Belt-and-suspenders redirect (the root layout does this too).
  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }
  if (user?.role === 'admin') {
    return <Redirect href="/(admin)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Transparent group: (tabs) renders the tab bar */}
      <Stack.Screen name="(tabs)" />
      {/* Profile is pushed as a card over the tabs */}
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          title: 'Profile',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
