import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAgentEarnings } from '@/features/commissions/hooks';
import { usePatientWallet, usePurchaseTreatment } from '@/features/points/hooks';
import {
  useAgentReferralCode,
  usePatientAttribution,
} from '@/features/referrals/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

export default function HomeScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === 'agent';

  // Agent queries
  const agentCodeQuery = useAgentReferralCode();
  const agentEarningsQuery = useAgentEarnings();

  // Patient queries
  const patientWalletQuery = usePatientWallet();
  const patientAttrQuery = usePatientAttribution();
  const purchaseTreatmentMutation = usePurchaseTreatment();

  const [copied, setCopied] = useState(false);
  const [purchaseSuccessMessage, setPurchaseSuccessMessage] = useState<string | null>(null);

  async function handleCopyLink() {
    if (agentCodeQuery.data?.referral_link) {
      await Clipboard.setStringAsync(agentCodeQuery.data.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function handleSimulateTreatment(treatmentName: string, amountRands: number) {
    setPurchaseSuccessMessage(null);
    try {
      const res = await purchaseTreatmentMutation.mutateAsync({
        treatment_name: treatmentName,
        amount_rands: amountRands,
      });

      let msg = `🎉 Treatment verified!\nYou earned +${res.points_earned} reward points!`;
      if (res.agent_commission_rands) {
        msg += `\nAttributed Agent earned R ${res.agent_commission_rands.toFixed(2)} commission!`;
      }
      setPurchaseSuccessMessage(msg);
      Alert.alert('Treatment Completed', msg);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to record treatment.');
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Greeting */}
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.greeting, { color: theme.text }]}>
              Hello, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
            </Text>
            <Text style={[styles.roleSub, { color: theme.textSecondary }]}>
              {isAgent ? 'Referral Agent Partner' : 'Kezza Patient Rewards'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            style={[styles.profilePill, { backgroundColor: theme.backgroundElement }]}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
              {isAgent ? '🏷️ Agent' : '🏥 Patient'}
            </Text>
          </Pressable>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* AGENT DASHBOARD VIEW                                          */}
        {/* ------------------------------------------------------------- */}
        {isAgent ? (
          <View style={styles.sectionGap}>
            {/* Step 1: Referral Code & Link Card */}
            <View style={styles.agentCodeCard}>
              <Text style={styles.cardHeaderSmall}>YOUR UNIQUE REFERRAL CODE</Text>
              <Text style={styles.agentCodeText}>
                {agentCodeQuery.data?.agent_code || user?.agentCode || 'LOADING...'}
              </Text>

              <Text style={styles.shareDesc}>
                Share this link with patients. When they register and purchase treatments, you earn 10% commission automatically!
              </Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.copyButton, copied && styles.copyButtonActive]}
                  onPress={handleCopyLink}
                >
                  <Text style={styles.copyButtonText}>
                    {copied ? '✓ Link Copied!' : '📋 Copy Referral Link'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.leadsButton}
                  onPress={() => router.push('/(app)/(tabs)/referrals')}
                >
                  <Text style={styles.leadsButtonText}>+ Add Patient</Text>
                </Pressable>
              </View>
            </View>

            {/* Performance Stats */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Referrals
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {agentCodeQuery.data?.total_referrals ?? 0}
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Converted
                </Text>
                <Text style={[styles.statValue, { color: '#38A169' }]}>
                  {agentCodeQuery.data?.converted_count ?? 0}
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Approved Earnings
                </Text>
                <Text style={[styles.statValue, { color: '#2563EB' }]}>
                  R {(agentEarningsQuery.data?.approved_rands ?? 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* ------------------------------------------------------------- */
          /* PATIENT DASHBOARD VIEW                                        */
          /* ------------------------------------------------------------- */
          <View style={styles.sectionGap}>
            {/* Step 5: Reward Credit Card */}
            <View style={styles.patientWalletCard}>
              <Text style={styles.cardHeaderSmall}>YOUR TREATMENT CREDIT</Text>
              <Text style={styles.walletAmount}>
                R {(patientWalletQuery.data?.credit_rands ?? 0).toFixed(2)}
              </Text>
              <Text style={styles.pointsCount}>
                ⭐ {patientWalletQuery.data?.total_points ?? 0} reward points accumulated
              </Text>
              <Text style={styles.pointsRule}>
                Earn 1 point per R10 spent. 1 point = R1.00 off treatments at Kezza clinics.
              </Text>
            </View>

            {/* Step 3: Attribution Status */}
            <View style={[styles.attributionBox, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.attributionTitle, { color: theme.text }]}>
                Referral Attribution Status
              </Text>
              {patientAttrQuery.data?.has_referral ? (
                <View style={styles.attrRow}>
                  <Text style={{ fontSize: 14, color: '#38A169', fontWeight: '700' }}>
                    ✓ Locked to Agent ({patientAttrQuery.data.referring_agent_code})
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                    Status: {patientAttrQuery.data.status?.toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  Direct account registration (not referred).
                </Text>
              )}
            </View>

            {/* Step 4: Live Treatment Simulator */}
            <View style={styles.simulationCard}>
              <Text style={[styles.simTitle, { color: theme.text }]}>
                🦷 Purchase Treatment (Live MVP Test)
              </Text>
              <Text style={[styles.simDesc, { color: theme.textSecondary }]}>
                Tap any treatment below to test Step 4, 5 & 6 (Instant treatment verification, rewards credit & agent commission!):
              </Text>

              {purchaseTreatmentMutation.isPending && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#3C9FFE" />
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    Processing payment and calculating rewards...
                  </Text>
                </View>
              )}

              {purchaseSuccessMessage && (
                <View style={styles.successBanner}>
                  <Text style={styles.successText}>{purchaseSuccessMessage}</Text>
                </View>
              )}

              <View style={styles.treatmentList}>
                <Pressable
                  style={({ pressed }) => [styles.treatmentBtn, pressed && styles.btnPressed]}
                  onPress={() => handleSimulateTreatment('Premium Teeth Whitening', 1500.0)}
                  disabled={purchaseTreatmentMutation.isPending}
                >
                  <View>
                    <Text style={styles.treatmentName}>Teeth Whitening</Text>
                    <Text style={styles.treatmentReward}>+150 reward points (R150)</Text>
                  </View>
                  <Text style={styles.treatmentPrice}>R 1,500.00 →</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.treatmentBtn, pressed && styles.btnPressed]}
                  onPress={() => handleSimulateTreatment('Dental Hygiene & Cleaning', 850.0)}
                  disabled={purchaseTreatmentMutation.isPending}
                >
                  <View>
                    <Text style={styles.treatmentName}>Dental Hygiene & Clean</Text>
                    <Text style={styles.treatmentReward}>+85 reward points (R85)</Text>
                  </View>
                  <Text style={styles.treatmentPrice}>R 850.00 →</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.treatmentBtn, pressed && styles.btnPressed]}
                  onPress={() => handleSimulateTreatment('Aesthetic Composite Veneers', 3500.0)}
                  disabled={purchaseTreatmentMutation.isPending}
                >
                  <View>
                    <Text style={styles.treatmentName}>Composite Veneers</Text>
                    <Text style={styles.treatmentReward}>+350 reward points (R350)</Text>
                  </View>
                  <Text style={styles.treatmentPrice}>R 3,500.00 →</Text>
                </Pressable>
              </View>
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 24, fontWeight: '800' },
  roleSub: { fontSize: 13, marginTop: 2 },
  profilePill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 20,
  },
  sectionGap: { gap: Spacing.three },

  // Agent Code Card
  agentCodeCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 18,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardHeaderSmall: { color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  agentCodeText: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: 1.5 },
  shareDesc: { color: '#E0E7FF', fontSize: 13, lineHeight: 18 },
  buttonRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  copyButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonActive: { backgroundColor: '#10B981' },
  copyButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  leadsButton: {
    paddingHorizontal: Spacing.three,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadsButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Stats Grid
  statsGrid: { flexDirection: 'row', gap: Spacing.two },
  statBox: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },

  // Patient Card
  patientWalletCard: {
    backgroundColor: '#0D9488',
    borderRadius: 18,
    padding: Spacing.four,
    gap: 6,
  },
  walletAmount: { color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
  pointsCount: { color: '#CCFBF1', fontSize: 14, fontWeight: '700' },
  pointsRule: { color: '#F0FDFA', fontSize: 12, marginTop: 4 },

  // Attribution
  attributionBox: {
    padding: Spacing.three,
    borderRadius: 14,
    gap: 4,
  },
  attributionTitle: { fontSize: 13, fontWeight: '700' },
  attrRow: { gap: 2 },

  // Simulator
  simulationCard: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  simTitle: { fontSize: 17, fontWeight: '700' },
  simDesc: { fontSize: 13, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: 4 },
  successBanner: {
    backgroundColor: '#DEF7EC',
    borderWidth: 1,
    borderColor: '#31C48D',
    borderRadius: 10,
    padding: Spacing.two,
  },
  successText: { color: '#03543F', fontSize: 13, fontWeight: '600' },
  treatmentList: { gap: Spacing.two, marginTop: 4 },
  treatmentBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  btnPressed: { opacity: 0.75 },
  treatmentName: { fontSize: 15, fontWeight: '700', color: '#1E3A8A' },
  treatmentReward: { fontSize: 12, color: '#059669', fontWeight: '600' },
  treatmentPrice: { fontSize: 15, fontWeight: '800', color: '#2563EB' },
});
