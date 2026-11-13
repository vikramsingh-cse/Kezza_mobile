/**
 * Profile screen — accessible from any tab via the header button.
 *
 * Shows the signed-in user's details and provides a sign-out action.
 * Phase 3: wire the sign-out button to DELETE /api/v1/auth/token (revoke).
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';
import { Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuthStore();

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        {/* ── Avatar placeholder ── */}
        <View style={[styles.avatar, { backgroundColor: '#3C9FFE' }]}>
          <Text style={styles.avatarInitial}>
            {user?.fullName?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>

        {/* ── User info ── */}
        <Text style={[styles.name, { color: theme.text }]}>
          {user?.fullName ?? '—'}
        </Text>
        <Text style={[styles.phone, { color: theme.textSecondary }]}>
          {user?.phone ?? '—'}
        </Text>

        <View style={[styles.roleBadge, { backgroundColor: theme.backgroundElement }]}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
            {user?.role === 'agent' ? '🏷️ Agent' : '🏥 Patient'}
          </Text>
        </View>

        {/* ── Spacer ── */}
        <View style={{ flex: 1 }} />

        {/* ── Sign out ── */}
        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '700' },
  phone: { fontSize: 15 },
  roleBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 20,
  },
  signOut: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
