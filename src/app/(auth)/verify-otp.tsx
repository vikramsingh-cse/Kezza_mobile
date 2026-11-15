// @ts-nocheck
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
import { getApiErrorMessage } from '@/lib/api-error';
import { isValidIndianE164 } from '@/lib/indian-phone';

const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const theme = useTheme();
  const { phone, ref, devCode, adminOnly, role: roleParam } = useLocalSearchParams<{
    phone: string;
    ref?: string;
    devCode?: string;
    adminOnly?: string;
    role?: string;
  }>();
  const isAdminOnly = adminOnly === '1';
  const accountRole = roleParam === 'agent' ? 'agent' : 'patient';
  const accountLabel = accountRole === 'agent' ? 'Agent / Partner' : 'Patient';
  const verifyOtpMutation = useVerifyOtp(isAdminOnly ? 'admin' : accountRole);
  const registerUserMutation = useRegisterUser();

  // The API only returns dev_code in development. Pre-fill that returned code
  // so local admin verification is connected end to end; never guess a code
  // when the backend did not provide one.
  const [otp, setOtp] = useState(() =>
    typeof devCode === 'string' && /^\d{6}$/.test(devCode) ? devCode : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState(false);

  // Registration state if user is new
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState(ref || '');

  const inputRef = useRef<TextInput>(null);

  async function handleVerify() {
    if (otp.length !== OTP_LENGTH) return;
    setError(null);
    setRoleMismatch(false);

    if (!isValidIndianE164(phone ?? '')) {
      setError('This link has an invalid phone number. Go back and enter a 10-digit Indian mobile number.');
      return;
    }

    try {
      const result = await verifyOtpMutation.mutateAsync({
        phone_e164: phone ?? '',
        otp_code: otp,
      });

      if (result.status === 'needs_registration') {
        if (isAdminOnly) {
          setError('No admin account is provisioned for this number. Contact a Kezza system owner.');
        } else {
          setNeedsRegistration(true);
        }
      } else if (isAdminOnly && result.user?.role !== 'admin') {
        setError('This number does not have administrator access.');
      } else if (!isAdminOnly && result.user?.role !== accountRole) {
        const registeredAs = result.user?.role === 'agent' ? 'Agent / Partner' : 'Patient';
        setError(`This mobile number already has a ${registeredAs} account.`);
        setRoleMismatch(true);
      } else {
        // Root routing sends admin users to the admin console and others to the app.
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Invalid verification code.'));
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
        role: accountRole,
        referral_code: referralCode.trim() || undefined,
      });
      // User registered & authenticated, will redirect automatically
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Registration failed. Please try again.'));
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
                <Text style={[styles.title, { color: theme.text }]}>
                  {isAdminOnly ? 'Admin verification' : `Verify ${accountLabel} account`}
                </Text>
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
              {roleMismatch ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace({ pathname: '/(auth)', params: { ref: ref ?? '' } })}
                >
                  <Text style={styles.switchAccountText}>Choose the correct account type</Text>
                </Pressable>
              ) : null}

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

              {devCode ? (
                <Text style={[styles.devHint, { color: theme.textSecondary }]}>
                  Local development code: <Text style={{ fontWeight: '700' }}>{devCode}</Text>
                </Text>
              ) : null}
            </View>
          ) : (
            /* Step 3: Fast Inline Registration */
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Create your {accountLabel} account</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Your mobile number is verified. Add your name to finish setting up your account.
                </Text>
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

              {/* Patient attribution code or partner sponsor code */}
              <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    {accountRole === 'patient' ? 'Agent referral code (optional)' : 'Partner sponsor code (optional)'}
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
                    placeholder="Enter a code if you have one"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="characters"
                    value={referralCode}
                    onChangeText={setReferralCode}
                  />
                  {referralCode ? (
                    <Text style={styles.attributionNotice}>
                      🔒 {accountRole === 'patient' ? 'Attribution locks to Agent' : 'Partner will be linked to sponsor'} ({referralCode.toUpperCase()})
                    </Text>
                  ) : null}
              </View>

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
                  <Text style={styles.buttonText}>Create account</Text>
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
  attributionNotice: { fontSize: 13, color: '#38A169', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#E53E3E', textAlign: 'center' },
  switchAccountText: { color: '#2563EB', fontSize: 14, fontWeight: '700', textAlign: 'center' },
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
