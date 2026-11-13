import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useAuthStore } from '@/store/auth-store';

const schema = z.object({
  phone: z
    .string()
    .min(8, 'Phone number is required')
    .regex(
      /^\+[1-9]\d{7,14}$/,
      'Enter phone with country code (e.g. +27821234567)',
    ),
  referralCode: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ ref?: string }>();
  const setPendingReferralCode = useAuthStore((s) => s.setPendingReferralCode);
  const requestOtpMutation = useRequestOtp();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: '+2782',
      referralCode: params.ref ?? '',
    },
  });

  useEffect(() => {
    if (params.ref) {
      setValue('referralCode', params.ref);
      setPendingReferralCode(params.ref);
    }
  }, [params.ref, setValue, setPendingReferralCode]);

  async function onSubmit(data: FormValues) {
    setErrorMessage(null);
    if (data.referralCode) {
      setPendingReferralCode(data.referralCode.trim().toUpperCase());
    }

    try {
      const otpResult = await requestOtpMutation.mutateAsync({ phone_e164: data.phone });
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: data.phone,
          ref: data.referralCode ?? '',
          devCode: otpResult.dev_code ?? '',
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to send verification code. Please try again.';
      setErrorMessage(msg);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>K</Text>
              </View>
              <Text style={[styles.brandTitle, { color: theme.text }]}>Kezza</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              Welcome to Kezza
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Patient rewards & referral earnings made simple. Enter your mobile number to get started.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Phone Input */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                Mobile Number (E.164)
              </Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: errors.phone ? '#E53E3E' : theme.backgroundElement,
                        backgroundColor: theme.backgroundElement,
                        color: theme.text,
                      },
                    ]}
                    placeholder="+27 82 123 4567"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone.message}</Text>
              )}
            </View>

            {/* Referral Code (Optional / Deep-linked) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Referral Code
                </Text>
                <Text style={[styles.optionalTag, { color: theme.textSecondary }]}>
                  Optional
                </Text>
              </View>
              <Controller
                control={control}
                name="referralCode"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: theme.backgroundElement,
                        backgroundColor: theme.backgroundElement,
                        color: theme.text,
                      },
                    ]}
                    placeholder="e.g. AGT-B492E1"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="characters"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {params.ref && (
                <Text style={styles.refDetectedText}>
                  ✓ Referred by Agent ({params.ref})
                </Text>
              )}
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
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </Pressable>

            <Text style={[styles.demoNote, { color: theme.textSecondary }]}>
              💡 Development mode: Use code <Text style={{ fontWeight: '700' }}>123456</Text> to verify instantly.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '600' },
  optionalTag: { fontSize: 12 },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  refDetectedText: { fontSize: 13, color: '#38A169', fontWeight: '600' },
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
});
