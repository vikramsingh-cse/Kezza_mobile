import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import {
  useAdminPatientSearch,
  useApproveCommission,
  useGrantPatientPoints,
  usePendingAdminCommissions,
} from '@/features/admin/hooks';
import type { AdminPatientSearchResult } from '@/features/admin/types';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { useAuthStore } from '@/store/auth-store';

function errorMessage(error: unknown): string {
  const responseMessage = (
    error as { response?: { data?: { detail?: string } } }
  )?.response?.data?.detail;
  return responseMessage ?? 'The request failed. Please try again.';
}

export default function AdminConsoleScreen() {
  const theme = useTheme();
  const adminName = useAuthStore((state) => state.user?.fullName ?? 'Administrator');
  const signOut = useAuthStore((state) => state.signOut);
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<AdminPatientSearchResult | null>(null);
  const [pointsToGrant, setPointsToGrant] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const pendingCommissions = usePendingAdminCommissions();
  const patientSearch = useAdminPatientSearch(patientQuery);
  const approveCommission = useApproveCommission();
  const grantPoints = useGrantPatientPoints();

  async function handleApprove(commissionId: string) {
    setFeedback(null);
    try {
      await approveCommission.mutateAsync(commissionId);
      setFeedback('Commission approved. The agent wallet has been refreshed.');
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  async function handleGrantPoints() {
    if (!selectedPatient) return;
    const points = Number(pointsToGrant);
    if (!Number.isInteger(points) || points <= 0) {
      setFeedback('Enter a whole number of points greater than zero.');
      return;
    }
    if (grantReason.trim().length < 3) {
      setFeedback('Enter a reason with at least three characters.');
      return;
    }

    setFeedback(null);
    try {
      const result = await grantPoints.mutateAsync({
        patientId: selectedPatient.patient_id,
        points,
        reason: grantReason.trim(),
      });
      setFeedback(
        `${result.points_added.toLocaleString()} points added. New balance: ${result.total_points.toLocaleString()}.`,
      );
      setPointsToGrant('');
      setGrantReason('');
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.kicker, { color: theme.textSecondary }]}>KEZZA ADMIN</Text>
            <Text style={[styles.title, { color: theme.text }]}>Admin console</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Signed in as {adminName}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await signOut();
              router.replace('/(auth)');
            }}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        {feedback ? (
          <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: theme.text }]}>
            {feedback}
          </Text>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Commission approvals</Text>
          <Text style={[styles.count, { color: theme.textSecondary }]}>
            {pendingCommissions.data?.length ?? 0} pending
          </Text>
        </View>

        {pendingCommissions.isLoading ? (
          <ActivityIndicator color="#3C9FFE" />
        ) : pendingCommissions.isError ? (
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            {errorMessage(pendingCommissions.error)}
          </Text>
        ) : pendingCommissions.data?.length ? (
          pendingCommissions.data.map((commission) => (
            <View key={commission.commission_id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{commission.agent_name}</Text>
                <Text style={[styles.amount, { color: '#15803D' }]}>
                  {formatMoney(commission.amount_minor_units, commission.currency)}
                </Text>
              </View>
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                {commission.agent_code} · {commission.agent_phone_e164}
              </Text>
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                {commission.treatment_name} for {commission.patient_name} ({commission.patient_phone_e164})
              </Text>
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                {commission.tier_name} · {commission.tier_percent}%
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleApprove(commission.commission_id)}
                disabled={approveCommission.isPending}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, approveCommission.isPending && styles.disabled]}
              >
                {approveCommission.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Approve commission</Text>
                )}
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={[styles.note, { color: theme.textSecondary }]}>No commissions are waiting for approval.</Text>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Grant patient points</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.label, { color: theme.text }]}>Search by patient name or phone</Text>
          <TextInput
            accessibilityLabel="Search patients by name or phone"
            value={patientQuery}
            onChangeText={(value) => {
              setPatientQuery(value);
              setSelectedPatient(null);
            }}
            placeholder="Enter at least two characters"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            style={[styles.input, { color: theme.text, borderColor: theme.background, backgroundColor: theme.background }]}
          />

          {patientSearch.isFetching ? <ActivityIndicator color="#3C9FFE" /> : null}
          {patientSearch.isError ? (
            <Text style={[styles.note, { color: '#B91C1C' }]}>{errorMessage(patientSearch.error)}</Text>
          ) : null}
          {patientSearch.data?.map((patient) => (
            <Pressable
              key={patient.patient_id}
              onPress={() => setSelectedPatient(patient)}
              style={({ pressed }) => [
                styles.patientResult,
                { borderColor: selectedPatient?.patient_id === patient.patient_id ? '#3C9FFE' : theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.text }]}>{patient.full_name}</Text>
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                {patient.phone_e164} · {patient.total_points.toLocaleString()} points
              </Text>
            </Pressable>
          ))}

          {selectedPatient ? (
            <View style={styles.grantForm}>
              <Text style={[styles.selectedPatient, { color: theme.text }]}>
                Selected: {selectedPatient.full_name}
              </Text>
              <Text style={[styles.label, { color: theme.text }]}>Points to add</Text>
              <TextInput
                accessibilityLabel="Points to grant"
                value={pointsToGrant}
                onChangeText={(value) => setPointsToGrant(value.replace(/\D/g, '').slice(0, 7))}
                placeholder="e.g. 250"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.input, { color: theme.text, borderColor: theme.background, backgroundColor: theme.background }]}
              />
              <Text style={[styles.label, { color: theme.text }]}>Reason (required for audit)</Text>
              <TextInput
                accessibilityLabel="Reason for granting points"
                value={grantReason}
                onChangeText={setGrantReason}
                placeholder="e.g. Clinic service recovery"
                placeholderTextColor={theme.textSecondary}
                maxLength={220}
                style={[styles.input, styles.reasonInput, { color: theme.text, borderColor: theme.background, backgroundColor: theme.background }]}
              />
              <Pressable
                accessibilityRole="button"
                onPress={handleGrantPoints}
                disabled={grantPoints.isPending}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, grantPoints.isPending && styles.disabled]}
              >
                {grantPoints.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Add points</Text>
                )}
              </Pressable>
            </View>
          ) : null}
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Grants are recorded in the points ledger with your admin account and reason.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  headerCopy: { flex: 1, gap: Spacing.one },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13 },
  signOutButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 10, backgroundColor: '#FEE2E2' },
  signOutText: { color: '#B91C1C', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  count: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  cardTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  amount: { fontSize: 17, fontWeight: '800' },
  note: { fontSize: 13, lineHeight: 18 },
  feedback: { padding: Spacing.two, borderRadius: 10, backgroundColor: '#E0F2FE', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, fontSize: 15 },
  patientResult: { padding: Spacing.two, borderWidth: 1, borderRadius: 10, gap: 3 },
  grantForm: { gap: Spacing.two, paddingTop: Spacing.one },
  selectedPatient: { fontSize: 14, fontWeight: '800' },
  reasonInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: Spacing.two },
  primaryButton: { minHeight: 46, backgroundColor: '#2563EB', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
});
