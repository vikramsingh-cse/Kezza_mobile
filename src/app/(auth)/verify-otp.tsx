import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useRegisterUser, useVerifyOtp } from '@/features/auth/hooks';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const theme = useTheme();
  const { phone, ref } = useLocalSearchParams<{ phone: string; ref?: string }>();
  const pendingReferralCode = useAuthStore((s) => s.pendingReferralCode);

  const verifyOtpMutation = useVerifyOtp();
  const registerUserMutation = useRegisterUser();

  const [otp, setOtp] = useState('123456'); // Pre-fill with dev OTP for instant testing
  const [error, setError] = useState<string | null>(null);

  // Registration state if user is new
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'patient' | 'agent'>('patient');
  const [referralCode, setReferralCode] = useState(ref || pendingReferralCode || '');

  const inputRef = useRef<TextInput>(null);

  async function handleVerify() {
    if (otp.length !== OTP_LENGTH) return;
    setError(null);

    try {
      const result = await verifyOtpMutation.mutateAsync({
        phone_e164: phone ?? '',
        otp_code: otp,
      });

      if (result.status === 'needs_registration') {
        setNeedsRegistration(true);
      } else {
        // User logged in, useProtectedRoute in RootLayout will redirect to /(app)/(tabs)
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid verification code.');
    }
  }

  async function handleRegister() {
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    setError(null);

    try {
      await registerUserMutation.mutateAsync({
        phone_e164: phone ?? '',
        full_name: fullName.trim(),
        role: role,
        referral_code: referralCode.trim() || undefined,
      });
      // User registered & authenticated, will redirect automatically
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.');
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          {!needsRegistration ? (
            /* Step 2: OTP Verification */
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Enter Code</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  We sent a 6-digit code to{' '}
                  <Text style={{ fontWeight: '700', color: theme.text }}>{phone}</Text>
                </Text>
              </View>

              {/* OTP Boxes */}
              <View style={styles.boxRow}>
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <Pressable key={i} onPress={() => inputRef.current?.focus()}>
                    <View
                      style={[
                        styles.box,
                        {
                          borderColor:
                            otp.length === i ? '#3C9FFE' : theme.backgroundElement,
                          backgroundColor: theme.backgroundElement,
                        },
                      ]}
                    >
                      <Text style={[styles.boxDigit, { color: theme.text }]}>
                        {otp[i] ?? ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <TextInput
                  ref={inputRef}
                  style={styles.hiddenInput}
                  value={otp}
                  onChangeText={(val) => setOtp(val.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  autoFocus
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  (otp.length < OTP_LENGTH || verifyOtpMutation.isPending) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleVerify}
                disabled={otp.length < OTP_LENGTH || verifyOtpMutation.isPending}
              >
                {verifyOtpMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Continue</Text>
                )}
              </Pressable>

              <Text style={[styles.devHint, { color: theme.textSecondary }]}>
                (Standard test code <Text style={{ fontWeight: '700' }}>123456</Text> is active)
              </Text>
            </View>
          ) : (
            /* Step 3: Fast Inline Registration */
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Almost Done!</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Please choose your account type and tell us your name.
                </Text>
              </View>

              {/* Role Selection */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>I am registering as a:</Text>
                <View style={styles.roleToggleRow}>
                  <Pressable
                    style={[
                      styles.roleButton,
                      role === 'patient' && styles.roleButtonActive,
                    ]}
                    onPress={() => setRole('patient')}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        role === 'patient' && styles.roleButtonTextActive,
                      ]}
                    >
                      🏥 Patient
                    </Text>
                    <Text style={styles.roleSubtext}>Earn Treatment Credit</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleButton,
                      role === 'agent' && styles.roleButtonActive,
                    ]}
                    onPress={() => setRole('agent')}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        role === 'agent' && styles.roleButtonTextActive,
                      ]}
                    >
                      🏷️ Agent
                    </Text>
                    <Text style={styles.roleSubtext}>Earn Referral Commission</Text>
                  </Pressable>
                </View>
              </View>

              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundElement,
                      color: theme.text,
                    },
                  ]}
                  placeholder="e.g. Sarah Jenkins"
                  placeholderTextColor={theme.textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Referral Code (if patient) */}
              {role === 'patient' && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    Agent Referral Code (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundElement,
                        color: theme.text,
                      },
                    ]}
                    placeholder="e.g. AGT-B492E1"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="characters"
                    value={referralCode}
                    onChangeText={setReferralCode}
                  />
                  {referralCode ? (
                    <Text style={styles.attributionNotice}>
                      🔒 Attribution will lock to Agent ({referralCode.toUpperCase()})
                    </Text>
                  ) : null}
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  registerUserMutation.isPending && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleRegister}
                disabled={registerUserMutation.isPending}
              >
                {registerUserMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Complete Registration</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    padding: Spacing.four,
    justifyContent: 'center',
    minHeight: '100%',
  },
  backButton: { marginBottom: Spacing.three },
  backText: { color: '#3C9FFE', fontSize: 16, fontWeight: '600' },
  content: { gap: Spacing.four },
  header: { gap: Spacing.two },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  boxRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: Spacing.two,
  },
  box: {
    width: 46,
    height: 54,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDigit: { fontSize: 24, fontWeight: '700' },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },
  devHint: { textAlign: 'center', fontSize: 13 },
  fieldGroup: { gap: Spacing.one },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  roleToggleRow: { flexDirection: 'row', gap: Spacing.two },
  roleButton: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    gap: 4,
  },
  roleButtonActive: {
    borderColor: '#3C9FFE',
    backgroundColor: '#EFF6FF',
  },
  roleButtonText: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  roleButtonTextActive: { color: '#2563EB' },
  roleSubtext: { fontSize: 11, color: '#94A3B8' },
  attributionNotice: { fontSize: 13, color: '#38A169', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#E53E3E', textAlign: 'center' },
  button: {
    height: 52,
    backgroundColor: '#3C9FFE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
