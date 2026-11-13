/**
 * Tab navigator layout for the three main app tabs.
 *
 * Tab visibility can be made role-aware here — e.g. hide the
 * Referrals tab for patients — by reading from the auth store.
 */

import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/auth-store';

export default function TabsLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const role = useAuthStore((s) => s.user?.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3C9FFE',
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
      }}
    >
      {/* ── Home / Dashboard ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            // SymbolView not available here without native view context;
            // replace with expo-symbols <SymbolView> once screens are built.
            null
          ),
        }}
      />

      {/* ── Referrals (agents + patients) ── */}
      <Tabs.Screen
        name="referrals"
        options={{
          title: 'Referrals',
          // Agents see their referral pipeline; patients see their own status.
        }}
      />

      {/* ── Wallet / Points ── */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: role === 'agent' ? 'Earnings' : 'Wallet',
        }}
      />
    </Tabs>
  );
}
