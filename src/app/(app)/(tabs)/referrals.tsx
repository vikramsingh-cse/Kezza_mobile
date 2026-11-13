/**
 * Referrals tab.
 *
 * Agent view  — list of referred patients and their pipeline status.
 * Patient view — the agent who referred them and their own referral status.
 *
 * Phase 4: connect to GET /api/v1/referrals and POST /api/v1/referrals.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';
import { Spacing } from '@/constants/theme';

export default function ReferralsTab() {
  const theme = useTheme();
  const role = useAuthStore((s) => s.user?.role);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>Referrals</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {role === 'agent'
            ? 'Patients you have referred appear here.'
            : 'Your referral status appears here.'}
        </Text>

        {/* Phase 4: replace with <ReferralList /> component */}
        <View style={[styles.empty, { backgroundColor: theme.backgroundElement }]}>
          <Text style={{ color: theme.textSecondary }}>
            Coming in Phase 4 — Referral Management
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  empty: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
