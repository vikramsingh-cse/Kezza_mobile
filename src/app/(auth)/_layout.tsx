/**
 * Auth group layout — wraps /(auth)/login and /(auth)/verify-otp.
 *
 * Uses a Stack navigator with no visible header so each auth screen can
 * define its own full-screen UI without interference from navigation chrome.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="verify-otp" />
    </Stack>
  );
}
