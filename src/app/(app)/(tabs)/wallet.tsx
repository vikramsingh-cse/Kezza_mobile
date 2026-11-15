import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAgentEarnings } from '@/features/commissions/hooks';
import { usePatientWallet } from '@/features/points/hooks';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { useAuthStore } from '@/store/auth-store';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export default function WalletTab() {
  const theme = useTheme();
  const isAgent = useAuthStore((state) => state.user?.role === 'agent');
  const wallet = usePatientWallet();
  const earnings = useAgentEarnings();
  const isRefreshing = isAgent ? earnings.isRefetching : wallet.isRefetching;
  const onRefresh = () => { void (isAgent ? earnings.refetch() : wallet.refetch()); };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.title, { color: theme.text }]}>{isAgent ? 'Earnings' : 'Treatment credit'}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isAgent ? 'Commission from verified patient treatment payments.' : 'Points earned from verified treatment payments.'}
        </Text>

        {isAgent ? (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Total earned</Text>
              <Text style={styles.balanceValue}>{earnings.data ? formatMoney(earnings.data.total_earned_minor_units, 'INR') : '—'}</Text>
              <Text style={styles.balanceHint}>{earnings.data?.commission_tier ?? 'Commission tier'}</Text>
            </View>
            <View style={styles.metricsRow}>
              <Metric label="Approved" value={earnings.data ? formatMoney(earnings.data.approved_minor_units, 'INR') : '—'} />
              <Metric label="Paid" value={earnings.data ? formatMoney(earnings.data.paid_minor_units, 'INR') : '—'} />
            </View>
            {earnings.data?.earnings_by_currency.ZAR?.total_earned_minor_units ? (
              <Text style={[styles.rate, { color: theme.textSecondary }]}>
                Legacy ZAR earnings: {formatMoney(earnings.data.earnings_by_currency.ZAR.total_earned_minor_units, 'ZAR')}
              </Text>
            ) : null}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Commission history</Text>
            {earnings.isLoading ? <ActivityIndicator color="#3C9FFE" /> : null}
            {earnings.isError ? <Text style={[styles.empty, { color: theme.textSecondary }]}>Could not load earnings. Pull down to retry.</Text> : null}
            {earnings.data?.ledger.length === 0 ? <Text style={[styles.empty, { color: theme.textSecondary }]}>No commissions recorded yet. Earnings appear here after a referred patient completes a verified purchase.</Text> : null}
            {earnings.data?.ledger.map((entry) => (
              <View key={entry.id} style={[styles.ledgerRow, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.ledgerCopy}>
                  <Text style={[styles.ledgerTitle, { color: theme.text }]}>{entry.treatment_name ?? 'Treatment commission'}</Text>
                  <Text style={[styles.ledgerMeta, { color: theme.textSecondary }]}>
                    {formatDate(entry.created_at)} · {entry.tier_name ?? 'Legacy tier'} · {entry.tier_percent}% · {entry.status}
                  </Text>
                </View>
                <Text style={styles.ledgerAmount}>{formatMoney(entry.amount_minor_units, entry.currency)}</Text>
              </View>
            ))}
          </>
        ) : (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available treatment credit</Text>
              <Text style={styles.balanceValue}>{wallet.data ? formatMoney(wallet.data.credit_minor_units, wallet.data.currency) : '—'}</Text>
              <Text style={styles.balanceHint}>{wallet.data ? `${wallet.data.total_points.toLocaleString()} points` : 'Points balance'}</Text>
            </View>
            {wallet.data?.legacy_zar_points ? (
              <Text style={[styles.rate, { color: theme.textSecondary }]}>
                Legacy ZAR balance: {wallet.data.legacy_zar_points.toLocaleString()} points · {formatMoney(wallet.data.legacy_zar_credit_minor_units, 'ZAR')}
              </Text>
            ) : null}
            {wallet.data?.points_rate_description ? <Text style={[styles.rate, { color: theme.textSecondary }]}>{wallet.data.points_rate_description}</Text> : null}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Points history</Text>
            {wallet.isLoading ? <ActivityIndicator color="#3C9FFE" /> : null}
            {wallet.isError ? <Text style={[styles.empty, { color: theme.textSecondary }]}>Could not load your wallet. Pull down to retry.</Text> : null}
            {wallet.data?.ledger.length === 0 ? <Text style={[styles.empty, { color: theme.textSecondary }]}>No rewards yet. Points will appear here after a verified treatment payment.</Text> : null}
            {wallet.data?.ledger.map((entry) => (
              <View key={entry.id} style={[styles.ledgerRow, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.ledgerCopy}>
                  <Text style={[styles.ledgerTitle, { color: theme.text }]}>{entry.description}</Text>
                  <Text style={[styles.ledgerMeta, { color: theme.textSecondary }]}>
                    {formatDate(entry.created_at)} · {entry.policy_version === 'inr_v1' ? 'Balance' : 'Legacy balance'} {entry.balance_after} points
                  </Text>
                </View>
                <Text style={[styles.pointsAmount, entry.points < 0 && styles.reversedPoints]}>
                  {entry.points > 0 ? '+' : ''}{entry.points}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: -Spacing.two },
  balanceCard: { borderRadius: 20, padding: Spacing.four, backgroundColor: '#287FCE', gap: Spacing.one },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
  balanceValue: { fontSize: 34, fontWeight: '800', color: '#fff' },
  balanceHint: { color: 'rgba(255,255,255,0.86)', fontSize: 13 },
  metricsRow: { flexDirection: 'row', gap: Spacing.two },
  metric: { flex: 1, borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  metricLabel: { fontSize: 12, fontWeight: '600' },
  metricValue: { fontSize: 18, fontWeight: '700' },
  rate: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.one },
  empty: { fontSize: 14, lineHeight: 20, paddingVertical: Spacing.two },
  ledgerRow: { borderRadius: 15, padding: Spacing.three, flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  ledgerCopy: { flex: 1, gap: Spacing.one },
  ledgerTitle: { fontSize: 14, fontWeight: '600' },
  ledgerMeta: { fontSize: 12 },
  ledgerAmount: { color: '#18794E', fontSize: 15, fontWeight: '800' },
  pointsAmount: { color: '#18794E', fontSize: 16, fontWeight: '800' },
  reversedPoints: { color: '#B42318' },
});
