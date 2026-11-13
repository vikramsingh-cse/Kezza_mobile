/**
 * Wallet tab.
 *
 * Patient view — treatment credit (points) balance + redemption history.
 * Agent view   — commission earnings: pending, approved, paid.
 *
 * Phase 5 (patients) / Phase 6 (agents): connect to real wallet APIs.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';
import { Spacing } from '@/constants/theme';

export default function WalletTab() {
  const theme = useTheme();
  const role = useAuthStore((s) => s.user?.role);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>
          {role === 'agent' ? 'Earnings' : 'Wallet'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {role === 'agent'
            ? 'Your commission balance and transaction history.'
            : 'Your treatment credit balance and redemption history.'}
        </Text>

        {/* Phase 5/6: replace with real balance card + transaction list */}
        <View style={[styles.balanceCard, { backgroundColor: '#3C9FFE' }]}>
          <Text style={styles.balanceLabel}>
            {role === 'agent' ? 'Available commission' : 'Treatment credit'}
          </Text>
          <Text style={styles.balanceValue}>R 0.00</Text>
        </View>

        <View style={[styles.empty, { backgroundColor: theme.backgroundElement }]}>
          <Text style={{ color: theme.textSecondary }}>
            {role === 'agent'
              ? 'Coming in Phase 6 — Agent Commissions'
              : 'Coming in Phase 5 — Patient Wallet'}
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
  balanceCard: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  balanceValue: { fontSize: 36, fontWeight: '800', color: '#fff' },
  empty: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
});
