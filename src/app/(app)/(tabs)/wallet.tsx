import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAgentEarnings } from '@/features/commissions/hooks';
import { usePatientWallet } from '@/features/points/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

export default function WalletScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === 'agent';

  // Agent queries
  const agentEarningsQuery = useAgentEarnings();

  // Patient queries
  const patientWalletQuery = usePatientWallet();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            {isAgent ? 'Commission Earnings' : 'Treatment Wallet'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isAgent
              ? 'Track referral commissions, approved earnings, and payout ledger.'
              : 'Your treatment credits, reward points balance, and transaction history.'}
          </Text>
        </View>

        {isAgent ? (
          /* ------------------------------------------------------------- */
          /* AGENT COMMISSIONS VIEW                                        */
          /* ------------------------------------------------------------- */
          <View style={styles.section}>
            {/* Total Balance Card */}
            <View style={styles.agentBalanceCard}>
              <Text style={styles.balanceLabel}>TOTAL EARNED COMMISSION</Text>
              <Text style={styles.balanceValue}>
                R {(agentEarningsQuery.data?.total_earned_rands ?? 0).toFixed(2)}
              </Text>
              <View style={styles.tierPill}>
                <Text style={styles.tierPillText}>
                  🎯 {agentEarningsQuery.data?.commission_tier ?? 'Standard Tier (10%)'}
                </Text>
              </View>
            </View>

            {/* Breakdown Cards */}
            <View style={styles.breakdownRow}>
              <View style={[styles.breakdownCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
                  Approved
                </Text>
                <Text style={[styles.breakdownValue, { color: '#38A169' }]}>
                  R {(agentEarningsQuery.data?.approved_rands ?? 0).toFixed(2)}
                </Text>
              </View>

              <View style={[styles.breakdownCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
                  Pending
                </Text>
                <Text style={[styles.breakdownValue, { color: '#D97706' }]}>
                  R {(agentEarningsQuery.data?.pending_rands ?? 0).toFixed(2)}
                </Text>
              </View>

              <View style={[styles.breakdownCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
                  Paid Out
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.text }]}>
                  R {(agentEarningsQuery.data?.paid_rands ?? 0).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Commission Ledger */}
            <View style={styles.ledgerSection}>
              <Text style={[styles.ledgerTitle, { color: theme.text }]}>
                Commission History
              </Text>

              {agentEarningsQuery.isLoading ? (
                <ActivityIndicator color="#3C9FFE" style={{ marginVertical: Spacing.four }} />
              ) : agentEarningsQuery.data && agentEarningsQuery.data.ledger.length > 0 ? (
                <View style={styles.ledgerList}>
                  {agentEarningsQuery.data.ledger.map((entry) => (
                    <View
                      key={entry.id}
                      style={[styles.ledgerCard, { backgroundColor: theme.backgroundElement }]}
                    >
                      <View style={styles.ledgerCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.ledgerTreatment, { color: theme.text }]}>
                            {entry.treatment_name || 'Clinic Treatment'}
                          </Text>
                          <Text style={[styles.ledgerDate, { color: theme.textSecondary }]}>
                            {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                          </Text>
                        </View>
                        <Text style={styles.ledgerAmount}>
                          +R {entry.amount_rands.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.ledgerCardBottom}>
                        <Text style={[styles.tierInfo, { color: theme.textSecondary }]}>
                          Commission: {entry.tier_percent}% tier
                        </Text>
                        <View style={styles.approvedTag}>
                          <Text style={styles.approvedTagText}>
                            {entry.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyBox, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={{ fontSize: 28 }}>💰</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No commission recorded yet. Refer a patient and have them purchase a treatment to earn!
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* ------------------------------------------------------------- */
          /* PATIENT WALLET VIEW                                           */
          /* ------------------------------------------------------------- */
          <View style={styles.section}>
            {/* Treatment Credit Balance Card */}
            <View style={styles.patientBalanceCard}>
              <Text style={styles.balanceLabel}>AVAILABLE TREATMENT CREDIT</Text>
              <Text style={styles.balanceValue}>
                R {(patientWalletQuery.data?.credit_rands ?? 0).toFixed(2)}
              </Text>
              <Text style={styles.pointsBadgeText}>
                ⭐ {patientWalletQuery.data?.total_points ?? 0} reward points
              </Text>
              <Text style={styles.patientSubnote}>
                Points can be redeemed against any treatment, consultation, or dental product at Kezza clinics.
              </Text>
            </View>

            {/* Points Ledger */}
            <View style={styles.ledgerSection}>
              <Text style={[styles.ledgerTitle, { color: theme.text }]}>
                Points & Rewards History
              </Text>

              {patientWalletQuery.isLoading ? (
                <ActivityIndicator color="#0D9488" style={{ marginVertical: Spacing.four }} />
              ) : patientWalletQuery.data && patientWalletQuery.data.ledger.length > 0 ? (
                <View style={styles.ledgerList}>
                  {patientWalletQuery.data.ledger.map((entry) => (
                    <View
                      key={entry.id}
                      style={[styles.ledgerCard, { backgroundColor: theme.backgroundElement }]}
                    >
                      <View style={styles.ledgerCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.ledgerTreatment, { color: theme.text }]}>
                            {entry.description}
                          </Text>
                          <Text style={[styles.ledgerDate, { color: theme.textSecondary }]}>
                            {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                          </Text>
                        </View>
                        <Text style={[styles.pointsEarnedText, { color: '#0D9488' }]}>
                          +{entry.points} pts
                        </Text>
                      </View>

                      <View style={styles.ledgerCardBottom}>
                        <Text style={[styles.tierInfo, { color: theme.textSecondary }]}>
                          Balance after: {entry.balance_after} pts (R {entry.balance_after.toFixed(2)})
                        </Text>
                        <View style={[styles.approvedTag, { backgroundColor: '#DEF7EC' }]}>
                          <Text style={[styles.approvedTagText, { color: '#03543F' }]}>
                            REWARDED
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyBox, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={{ fontSize: 28 }}>🎁</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No treatment rewards yet. Purchase a treatment from the Home tab to earn your first points!
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.four, gap: Spacing.four },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  section: { gap: Spacing.three },

  // Agent Card
  agentBalanceCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 20,
    padding: Spacing.four,
    gap: 8,
  },
  balanceLabel: { color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  balanceValue: { color: '#FFFFFF', fontSize: 40, fontWeight: '900' },
  tierPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tierPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // Breakdown
  breakdownRow: { flexDirection: 'row', gap: Spacing.two },
  breakdownCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
  },
  breakdownLabel: { fontSize: 12, fontWeight: '600' },
  breakdownValue: { fontSize: 16, fontWeight: '800' },

  // Patient Card
  patientBalanceCard: {
    backgroundColor: '#0D9488',
    borderRadius: 20,
    padding: Spacing.four,
    gap: 8,
  },
  pointsBadgeText: { color: '#CCFBF1', fontSize: 15, fontWeight: '700' },
  patientSubnote: { color: '#F0FDFA', fontSize: 12, lineHeight: 16, marginTop: 4 },

  // Ledger Section
  ledgerSection: { gap: Spacing.two, marginTop: Spacing.two },
  ledgerTitle: { fontSize: 18, fontWeight: '700' },
  ledgerList: { gap: Spacing.two },
  ledgerCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: 8,
  },
  ledgerCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ledgerTreatment: { fontSize: 15, fontWeight: '700' },
  ledgerDate: { fontSize: 12, marginTop: 2 },
  ledgerAmount: { fontSize: 17, fontWeight: '800', color: '#2563EB' },
  pointsEarnedText: { fontSize: 17, fontWeight: '800' },
  ledgerCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierInfo: { fontSize: 12 },
  approvedTag: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  approvedTagText: { color: '#1E40AF', fontSize: 10, fontWeight: '800' },

  emptyBox: {
    padding: Spacing.four,
    borderRadius: 14,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
