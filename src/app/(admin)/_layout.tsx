import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function AdminLayout() {
  const { isAuthenticated, isHydrated, user } = useAuthStore();

  if (!isHydrated) return null;
  if (!isAuthenticated) {
    return <Redirect href={{ pathname: '/(auth)/login', params: { admin: '1' } }} />;
  }
  if (user?.role !== 'admin') {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
