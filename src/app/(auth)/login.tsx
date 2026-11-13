/**
 * Login screen — Step 1 of 2 in the mobile-number OTP flow.
 *
 * The user enters their phone number in E.164 format.
 * On submit, the app calls POST /api/v1/auth/otp/request and navigates
 * to the verify-otp screen, passing the phone number as a search param.
 *
 * Phase 3 hook: wire `requestOtp` to the real API once auth endpoints exist.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
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

import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

// ── Validation schema ──────────────────────────────────────────────────────
const schema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(
      /^\+[1-9]\d{7,14}$/,
      'Enter a valid phone number starting with + (e.g. +27821234567)',
    ),
});

type FormValues = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const theme = useTheme();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
  });

  async function onSubmit({ phone }: FormValues) {
    // TODO Phase 3: call POST /api/v1/auth/otp/request
    // await api.post('/auth/otp/request', { phone_e164: phone });

    // Navigate to OTP verification, carrying the phone number.
    router.push({ pathname: '/(auth)/verify-otp', params: { phone } });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Welcome to Kezza
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter your mobile number to sign in or create an account.
            </Text>
          </View>

          {/* ── Phone input ── */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.text }]}>
              Mobile number
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

          {/* ── Submit ── */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send code</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
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
  title: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  fieldGroup: { gap: Spacing.one },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  errorText: { fontSize: 13, color: '#E53E3E' },
  button: {
    height: 52,
    backgroundColor: '#3C9FFE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
