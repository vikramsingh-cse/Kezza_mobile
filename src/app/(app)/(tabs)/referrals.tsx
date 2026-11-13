import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  useAgentReferralCode,
  useAgentReferrals,
  useCreateReferralLead,
  usePatientAttribution,
} from '@/features/referrals/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

export default function ReferralsScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === 'agent';

  // Agent data
  const agentCodeQuery = useAgentReferralCode();
  const agentReferralsQuery = useAgentReferrals();
  const createLeadMutation = useCreateReferralLead();

  // Patient data
  const patientAttrQuery = usePatientAttribution();

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('+2782');
  const [serviceInterest, setServiceInterest] = useState('Teeth Whitening');
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    if (agentCodeQuery.data?.referral_link) {
      await Clipboard.setStringAsync(agentCodeQuery.data.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleCreateLead() {
    if (!patientName.trim()) {
      setFormError('Patient name is required');
      return;
    }
    if (!patientPhone.trim() || patientPhone.length < 8) {
      setFormError('Valid mobile number is required');
      return;
    }
    setFormError(null);

    try {
      await createLeadMutation.mutateAsync({
        patient_name: patientName.trim(),
        patient_phone_e164: patientPhone.trim(),
        service_interest: serviceInterest,
      });
      setPatientName('');
      setPatientPhone('+2782');
      setShowAddForm(false);
      Alert.alert('Referral Lead Added', `${patientName} has been added to your pipeline!`);
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Failed to add referral lead.');
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'converted':
        return { bg: '#DEF7EC', text: '#03543F', label: '✓ CONVERTED' };
      case 'contacted':
        return { bg: '#FEF08A', text: '#854D0E', label: 'CONTACTED' };
      case 'consultation_booked':
        return { bg: '#E0E7FF', text: '#3730A3', label: 'CONSULTATION' };
      default:
        return { bg: '#DBEAFE', text: '#1E40AF', label: 'REGISTERED' };
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Referral Network</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isAgent
              ? 'Manage your patient pipeline and track conversion commissions.'
              : 'Your referral status and clinic attribution details.'}
          </Text>
        </View>

        {isAgent ? (
          <View style={styles.section}>
            {/* Referral Link & Share Card */}
            <View style={styles.shareCard}>
              <View style={styles.shareCardTop}>
                <View>
                  <Text style={styles.shareLabel}>YOUR REFERRAL CODE</Text>
                  <Text style={styles.shareCode}>
                    {agentCodeQuery.data?.agent_code || user?.agentCode || '...'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.copyBtn, copied && styles.copyBtnActive]}
                  onPress={handleCopyLink}
                >
                  <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
                </Pressable>
              </View>
              <Text style={styles.linkText} numberOfLines={1}>
                {agentCodeQuery.data?.referral_link}
              </Text>
            </View>

            {/* Add Lead Action Button */}
            <View style={styles.actionRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Referred Patients ({agentReferralsQuery.data?.length ?? 0})
              </Text>
              <Pressable
                style={styles.addLeadBtn}
                onPress={() => setShowAddForm(!showAddForm)}
              >
                <Text style={styles.addLeadBtnText}>
                  {showAddForm ? '✕ Close' : '+ Add Patient'}
                </Text>
              </Pressable>
            </View>

            {/* Add Lead Form */}
            {showAddForm && (
              <View style={[styles.formCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.formTitle, { color: theme.text }]}>
                  Pre-register Patient Lead
                </Text>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.text }]}>Patient Full Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                    placeholder="e.g. Michael Scott"
                    placeholderTextColor={theme.textSecondary}
                    value={patientName}
                    onChangeText={setPatientName}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.text }]}>Mobile Phone (E.164)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                    placeholder="+27 82 000 0000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    value={patientPhone}
                    onChangeText={setPatientPhone}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.text }]}>Treatment Interest</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                    placeholder="e.g. Teeth Whitening, Aligners"
                    placeholderTextColor={theme.textSecondary}
                    value={serviceInterest}
                    onChangeText={setServiceInterest}
                  />
                </View>

                {formError && <Text style={styles.errorText}>{formError}</Text>}

                <Pressable
                  style={styles.submitBtn}
                  onPress={handleCreateLead}
                  disabled={createLeadMutation.isPending}
                >
                  {createLeadMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save Patient Lead</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* Referrals Pipeline List */}
            {agentReferralsQuery.isLoading ? (
              <ActivityIndicator color="#3C9FFE" style={{ marginTop: Spacing.four }} />
            ) : agentReferralsQuery.data && agentReferralsQuery.data.length > 0 ? (
              <View style={styles.list}>
                {agentReferralsQuery.data.map((ref) => {
                  const tag = getStatusStyle(ref.status);
                  return (
                    <View
                      key={ref.id}
                      style={[styles.referralCard, { backgroundColor: theme.backgroundElement }]}
                    >
                      <View style={styles.cardMain}>
                        <View style={styles.cardInfo}>
                          <Text style={[styles.patientName, { color: theme.text }]}>
                            {ref.patient_name}
                          </Text>
                          <Text style={[styles.patientPhone, { color: theme.textSecondary }]}>
                            {ref.patient_phone_e164}
                          </Text>
                          {ref.service_interest && (
                            <Text style={styles.interestText}>
                              Interested in: {ref.service_interest}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.statusTag, { backgroundColor: tag.bg }]}>
                          <Text style={[styles.statusText, { color: tag.text }]}>
                            {tag.label}
                          </Text>
                        </View>
                      </View>
                      {ref.converted_at && (
                        <Text style={styles.convertedDate}>
                          🎉 Converted on {new Date(ref.converted_at).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptyBox, { backgroundColor: theme.backgroundElement }]}>
                <Text style={{ fontSize: 32 }}>👥</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  No referrals yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Share your referral link with patients or add them manually to begin tracking commissions.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Patient Referral Status View */
          <View style={styles.section}>
            <View style={[styles.patientAttributionCard, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Your Referral Attribution
              </Text>
              {patientAttrQuery.data?.has_referral ? (
                <View style={styles.attrDetails}>
                  <Text style={{ fontSize: 16, color: '#38A169', fontWeight: '700' }}>
                    ✓ Locked to Agent ({patientAttrQuery.data.referring_agent_code})
                  </Text>
                  <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                    Status:{' '}
                    <Text style={{ fontWeight: '700', color: theme.text }}>
                      {patientAttrQuery.data.status?.toUpperCase()}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
                    Whenever you complete verified treatments at Kezza clinics, your rewards and referral benefits are automatically processed.
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                  You created this account directly. You still earn 10% treatment credit on all purchases!
                </Text>
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

  shareCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  shareCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shareLabel: { color: '#93C5FD', fontSize: 11, fontWeight: '700' },
  shareCode: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  copyBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyBtnActive: { backgroundColor: '#10B981' },
  copyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  linkText: { color: '#BFDBFE', fontSize: 12 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  addLeadBtn: {
    backgroundColor: '#3C9FFE',
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addLeadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  formCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTitle: { fontSize: 16, fontWeight: '700' },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  errorText: { color: '#E53E3E', fontSize: 13 },
  submitBtn: {
    height: 44,
    backgroundColor: '#38A169',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  list: { gap: Spacing.two },
  referralCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: 6,
  },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { gap: 2, flex: 1 },
  patientName: { fontSize: 16, fontWeight: '700' },
  patientPhone: { fontSize: 13 },
  interestText: { fontSize: 12, color: '#3C9FFE', fontWeight: '600', marginTop: 2 },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  convertedDate: { fontSize: 12, color: '#38A169', fontWeight: '600' },

  emptyBox: {
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  patientAttributionCard: {
    padding: Spacing.four,
    borderRadius: 16,
    gap: Spacing.two,
  },
  attrDetails: { gap: 6 },
});
