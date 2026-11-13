import { Tabs } from 'expo-router';
import { Text, useColorScheme } from 'react-native';

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
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundElement,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />

      <Tabs.Screen
        name="referrals"
        options={{
          title: 'Referrals',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👥</Text>,
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: role === 'agent' ? 'Earnings' : 'Wallet',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>{role === 'agent' ? '💰' : '🎁'}</Text>
          ),
        }}
      />
    </Tabs>
  );
}
