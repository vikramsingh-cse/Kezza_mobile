/**
 * Home / Dashboard tab.
 *
 * Renders different content based on the authenticated user's role:
 *  • patient — shows their points balance and recent activity
 *  • agent   — shows their referral summary and earnings snapshot
 *
 * Phase 7: replace placeholder text with real components connected to the API.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';
import { Spacing } from '@/constants/theme';

export default function HomeTab() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <Text style={[styles.greeting, { color: theme.text }]}>
          Hi, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
        </Text>
        <Text style={[styles.role, { color: theme.textSecondary }]}>
          {user?.role === 'agent' ? 'Agent dashboard' : 'Patient dashboard'}
        </Text>

        {/* ── Placeholder cards (Phase 7: replace with real components) ── */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
            {user?.role === 'agent' ? 'Total referrals' : 'Points balance'}
          </Text>
          <Text style={[styles.cardValue, { color: theme.text }]}>
            — connecting…
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
            {user?.role === 'agent' ? 'Pending commission' : 'Redeemable credit'}
          </Text>
          <Text style={[styles.cardValue, { color: theme.text }]}>
            — connecting…
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  greeting: { fontSize: 26, fontWeight: '700' },
  role: { fontSize: 14, marginTop: -Spacing.two },
  card: {
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  cardLabel: { fontSize: 13, fontWeight: '500' },
  cardValue: { fontSize: 28, fontWeight: '700' },
});
