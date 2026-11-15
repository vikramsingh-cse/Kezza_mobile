import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { z } from 'zod';

import { Spacing } from '@/constants/theme';
import { useRequestOtp } from '@/features/auth/hooks';
import { useTheme } from '@/hooks/use-theme';
import { getIndianMobileDigits, isValidIndianMobile, toIndianE164 } from '@/lib/indian-phone';
import { getApiErrorMessage } from '@/lib/api-error';

const schema = z.object({
  phone: z
    .string()
    .refine(isValidIndianMobile, 'Enter a valid 10-digit Indian mobile number.'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ ref?: string; admin?: string; role?: string }>();
  const isAdminLogin = params.admin === '1';
  const accountRole = params.role === 'agent' ? 'agent' : 'patient';
  const isPatientLogin = accountRole === 'patient';
  const requestOtpMutation = useRequestOtp();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: '',
    },
  });

  async function onSubmit(data: FormValues) {
    setErrorMessage(null);

    try {
      const phoneE164 = toIndianE164(data.phone);
      const otpResult = await requestOtpMutation.mutateAsync({ phone_e164: phoneE164 });
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: phoneE164,
          ref: isAdminLogin ? '' : params.ref ?? '',
          devCode: otpResult.dev_code ?? '',
          adminOnly: isAdminLogin ? '1' : '0',
          role: isAdminLogin ? '' : accountRole,
        },
      });
    } catch (err: unknown) {
      setErrorMessage(getApiErrorMessage(err, 'Failed to send verification code. Please try again.'));
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>K</Text>
              </View>
              <Text style={[styles.brandTitle, { color: theme.text }]}>Kezza</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {isAdminLogin
                ? 'Administrator sign in'
                : isPatientLogin
                  ? 'Patient sign in'
                  : 'Agent / Partner sign in'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {isAdminLogin
                ? 'Sign in with the phone number provisioned for your Kezza admin account.'
                : isPatientLogin
                  ? 'Access your treatment rewards and referral credits with your mobile number.'
                  : 'Manage your referrals, partner network and commission earnings with your mobile number.'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Phone Input */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Mobile number</Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.phoneInputWrap,
                      {
                        borderColor: errors.phone ? '#E53E3E' : theme.backgroundElement,
                        backgroundColor: theme.backgroundElement,
                      },
                    ]}
                  >
                    <View style={styles.countryPrefix}>
                      <Text style={styles.countryFlag}>🇮🇳</Text>
                      <Text style={[styles.countryCode, { color: theme.text }]}>+91</Text>
                    </View>
                    <View style={styles.phoneDivider} />
                    <TextInput
                      accessibilityLabel="10-digit Indian mobile number"
                      style={[styles.phoneInput, { color: theme.text }]}
                      placeholder="9876543210"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      onBlur={onBlur}
                      onChangeText={(input) => onChange(getIndianMobileDigits(input))}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone.message}</Text>
              )}
              <Text style={[styles.phoneHint, { color: theme.textSecondary }]}>Enter 10 digits. We’ll add +91 automatically.</Text>
            </View>

            {errorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSubmit(onSubmit)}
              disabled={requestOtpMutation.isPending}
            >
              {requestOtpMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isAdminLogin ? 'Send Admin Verification Code' : 'Continue with mobile number'}
                </Text>
              )}
            </Pressable>

            <Text style={[styles.demoNote, { color: theme.textSecondary }]}>
              We’ll send a one-time verification code to your mobile number.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.replace(
                  isAdminLogin
                    ? '/(auth)'
                    : { pathname: '/(auth)/login', params: { admin: '1' } },
                )
              }
            >
              <Text style={styles.adminLink}>
                {isAdminLogin ? 'Patient or partner sign in' : 'Administrator sign in'}
              </Text>
            </Pressable>
            {!isAdminLogin ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace({ pathname: '/(auth)', params: { ref: params.ref ?? '' } })}
              >
                <Text style={styles.switchAccountLink}>Choose a different account type</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  header: { gap: Spacing.two },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#3C9FFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  brandTitle: { fontSize: 22, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  form: { gap: Spacing.three },
  fieldGroup: { gap: Spacing.one },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  phoneInputWrap: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryPrefix: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 },
  countryFlag: { fontSize: 17 },
  countryCode: { fontSize: 16, fontWeight: '700' },
  phoneDivider: { width: 1, height: 24, backgroundColor: '#94A3B8' },
  phoneInput: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 16 },
  phoneHint: { fontSize: 12 },
  errorText: { fontSize: 13, color: '#E53E3E' },
  errorBanner: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEB2B2',
    padding: Spacing.two,
    borderRadius: 8,
  },
  errorBannerText: { color: '#C53030', fontSize: 13 },
  button: {
    height: 52,
    backgroundColor: '#3C9FFE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  demoNote: { textAlign: 'center', fontSize: 13, marginTop: Spacing.two },
  adminLink: { color: '#3C9FFE', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  switchAccountLink: { color: '#64748B', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
