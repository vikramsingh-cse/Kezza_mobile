import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { usePatientAttribution, useAgentReferralCode, useAgentReferrals } from '@/features/referrals/hooks';
import type { ReferralStatus } from '@/features/referrals/types';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

const statusLabel: Record<ReferralStatus, string> = {
  registered: 'Registered',
  contacted: 'Contacted',
  consultation_booked: 'Consultation booked',
  converted: 'Treatment purchased',
  not_converted: 'Not converted',
  rejected: 'Closed',
};

function ActionButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, secondary && styles.secondaryButton, pressed && styles.pressed]}>
      <Text style={[styles.actionLabel, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export default function ReferralsTab() {
  const theme = useTheme();
  const isAgent = useAuthStore((state) => state.user?.role === 'agent');
  const code = useAgentReferralCode();
  const referrals = useAgentReferrals();
  const attribution = usePatientAttribution();
  const [copied, setCopied] = useState(false);
  const isRefreshing = isAgent ? (code.isRefetching || referrals.isRefetching) : attribution.isRefetching;

  async function copyLink() {
    if (!code.data?.referral_link) return;
    await Clipboard.setStringAsync(code.data.referral_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareLink() {
    if (!code.data?.referral_link) return;
    await Share.share({
      message: `Join Kezza with my referral link: ${code.data.referral_link}`,
      url: code.data.referral_link,
    });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => {
          if (isAgent) { void code.refetch(); void referrals.refetch(); }
          else void attribution.refetch();
        }} />}
      >
        <Text style={[styles.title, { color: theme.text }]}>{isAgent ? 'Your referrals' : 'Your referral'}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isAgent ? 'Invite patients and follow their treatment journey.' : 'See the agent connected to your Kezza account.'}
        </Text>

        {isAgent ? (
          <>
            <View style={[styles.inviteCard, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>YOUR PERSONAL LINK</Text>
              <Text selectable style={[styles.code, { color: theme.text }]}>{code.data?.agent_code ?? 'Loading…'}</Text>
              <Text selectable style={[styles.link, { color: theme.textSecondary }]}>{code.data?.referral_link ?? ''}</Text>
              <View style={styles.buttonRow}>
                <ActionButton label={copied ? 'Copied' : 'Copy link'} onPress={copyLink} />
                <ActionButton label="Share link" onPress={shareLink} secondary />
              </View>
              {code.data ? (
                <Text style={[styles.summary, { color: theme.textSecondary }]}>
                  {code.data.total_referrals} referrals · {code.data.converted_count} converted
                </Text>
              ) : null}
            </View>

            <Text style={[styles.sectionTitle, { color: theme.text }]}>Referral activity</Text>
            {referrals.isLoading ? <ActivityIndicator color="#3C9FFE" /> : null}
            {referrals.isError || code.isError ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>We could not load your referral details. Pull down to retry.</Text>
            ) : null}
            {referrals.data?.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Your first referral starts here</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Share your personal link. New patients can verify their mobile and sign up with your code.</Text>
              </View>
            ) : referrals.data?.map((referral) => (
              <View key={referral.id} style={[styles.referralCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.patientHeading}>
                  <Text style={[styles.patientName, { color: theme.text }]}>{referral.patient_name}</Text>
                  <Text style={styles.status}>{statusLabel[referral.status]}</Text>
                </View>
                <Text style={[styles.detail, { color: theme.textSecondary }]}>{referral.patient_phone_e164}</Text>
                {referral.service_interest ? <Text style={[styles.detail, { color: theme.textSecondary }]}>{referral.service_interest}</Text> : null}
                {referral.converted_at ? <Text style={[styles.detail, { color: theme.textSecondary }]}>Converted {new Date(referral.converted_at).toLocaleDateString()}</Text> : null}
              </View>
            ))}
          </>
        ) : (
          attribution.isLoading ? <ActivityIndicator color="#3C9FFE" /> : attribution.isError ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Could not load your referral details. Pull down to retry.</Text>
            </View>
          ) : attribution.data?.has_referral ? (
            <View style={[styles.inviteCard, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>REFERRED BY</Text>
              <Text style={[styles.code, { color: theme.text }]}>{attribution.data.referring_agent_code}</Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>Your referral attribution is locked to this agent.</Text>
              <Text style={styles.status}>{statusLabel[(attribution.data.status as ReferralStatus) ?? 'registered']}</Text>
              {attribution.data.converted_at ? <Text style={[styles.detail, { color: theme.textSecondary }]}>Treatment recorded {new Date(attribution.data.converted_at).toLocaleDateString()}</Text> : null}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No referral linked</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Your account was created without an agent referral.</Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: -Spacing.two },
  inviteCard: { borderRadius: 20, padding: Spacing.four, gap: Spacing.two },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  code: { fontSize: 24, fontWeight: '800' },
  link: { fontSize: 13, lineHeight: 19 },
  buttonRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  actionButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#3C9FFE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3C9FFE' },
  actionLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryLabel: { color: '#3C9FFE' },
  pressed: { opacity: 0.75 },
  summary: { fontSize: 13, marginTop: Spacing.one },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.one },
  emptyCard: { borderRadius: 18, padding: Spacing.four, gap: Spacing.two },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20 },
  referralCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  patientHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, alignItems: 'center' },
  patientName: { fontSize: 16, fontWeight: '700', flex: 1 },
  status: { color: '#18794E', backgroundColor: '#DDF5E8', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, fontSize: 11, fontWeight: '700' },
  detail: { fontSize: 13 },
});
