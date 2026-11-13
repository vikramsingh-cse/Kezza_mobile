import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAgentEarnings } from '@/features/commissions/hooks';
import { usePatientWallet } from '@/features/points/hooks';
import { useAgentReferralCode } from '@/features/referrals/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: theme.text }]}>{value}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

function QueryNote({ loading, error }: { loading: boolean; error: boolean }) {
  const theme = useTheme();
  if (!loading && !error) return null;
  return (
    <Text style={[styles.note, { color: theme.textSecondary }]}>
      {loading ? 'Refreshing your Kezza account…' : 'Could not load your latest account details. Open Wallet or Referrals and pull down to retry.'}
    </Text>
  );
}

export default function HomeTab() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAgent = user?.role === 'agent';
  const referrals = useAgentReferralCode();
  const earnings = useAgentEarnings();
  const wallet = usePatientWallet();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <Text style={[styles.greeting, { color: theme.text }]}>Hi, {user?.fullName?.split(' ')[0] ?? 'there'} 👋</Text>
        <Text style={[styles.role, { color: theme.textSecondary }]}>
          {isAgent ? 'Your referral activity and earnings' : 'Your treatment rewards and credit'}
        </Text>

        {isAgent ? (
          <>
            <MetricCard label="Referrals" value={referrals.data ? `${referrals.data.total_referrals}` : '—'} hint={referrals.data ? `${referrals.data.converted_count} converted` : undefined} />
            <MetricCard label="Total earned" value={earnings.data ? `R ${earnings.data.total_earned_rands.toFixed(2)}` : '—'} hint={earnings.data?.commission_tier} />
            <MetricCard label="Referral code" value={referrals.data?.agent_code ?? user?.agentCode ?? '—'} hint="Share your link from the Referrals tab" />
            <QueryNote loading={referrals.isLoading || earnings.isLoading} error={referrals.isError || earnings.isError} />
          </>
        ) : (
          <>
            <MetricCard label="Reward points" value={wallet.data ? wallet.data.total_points.toLocaleString() : '—'} hint="Earned from verified treatment payments" />
            <MetricCard label="Treatment credit" value={wallet.data ? `R ${wallet.data.credit_rands.toFixed(2)}` : '—'} hint="Available points converted to treatment credit" />
            <QueryNote loading={wallet.isLoading} error={wallet.isError} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  greeting: { fontSize: 28, fontWeight: '800' },
  role: { fontSize: 15, marginTop: -Spacing.two, marginBottom: Spacing.two },
  card: { borderRadius: 18, padding: Spacing.four, gap: Spacing.one },
  cardLabel: { fontSize: 13, fontWeight: '600' },
  cardValue: { fontSize: 28, fontWeight: '800' },
  hint: { fontSize: 13 },
  note: { fontSize: 13, textAlign: 'center' },
});
