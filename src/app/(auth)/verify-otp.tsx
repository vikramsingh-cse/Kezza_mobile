/**
 * OTP Verification screen — Step 2 of 2 in the sign-in flow.
 *
 * Receives `phone` as a search param from the login screen.
 * The user enters the 6-digit OTP sent by the backend.
 * On success, the token is stored in SecureStore via the auth store
 * and the root layout's useProtectedRoute redirects to the app.
 *
 * Phase 3 hook: wire `verifyOtp` to POST /api/v1/auth/otp/verify.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
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

import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';
import { Spacing } from '@/constants/theme';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpScreen() {
  const theme = useTheme();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const signIn = useAuthStore((s) => s.signIn);

  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<TextInput>(null);

  // Countdown timer for resend button
  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  async function handleVerify() {
    if (otp.length !== OTP_LENGTH) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // TODO Phase 3: call POST /api/v1/auth/otp/verify
      // const { data } = await api.post('/auth/otp/verify', {
      //   phone_e164: phone,
      //   otp_code: otp,
      // });
      // await signIn({ token: data.access_token, user: data.user });

      // ── STUB: simulate a successful login during development ──────────
      await signIn({
        accessToken: '__dev_token__',
        user: { id: '1', fullName: 'Dev User', phone: phone ?? '', role: 'patient' },
      });
      // ─────────────────────────────────────────────────────────────────
    } catch {
      setError('Invalid or expired code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    // TODO Phase 3: call POST /api/v1/auth/otp/request again
    startCooldown();
  }

  // Render OTP digit boxes by overlaying a hidden TextInput
  function renderBoxes() {
    return (
      <View style={styles.boxRow}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
          <Pressable key={i} onPress={() => inputRef.current?.focus()}>
            <View
              style={[
                styles.box,
                {
                  borderColor:
                    otp.length === i
                      ? '#3C9FFE'
                      : theme.backgroundElement,
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
        {/* Hidden full-width input captures keyboard input */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={otp}
          onChangeText={(v) => {
            setOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH));
            if (v.length === OTP_LENGTH) handleVerify();
          }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          autoFocus
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* ── Back ── */}
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={{ color: '#3C9FFE', fontSize: 15 }}>← Back</Text>
          </Pressable>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Enter the code
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              We sent a 6-digit code to{'\n'}
              <Text style={{ fontWeight: '700', color: theme.text }}>
                {phone}
              </Text>
            </Text>
          </View>

          {/* ── OTP boxes ── */}
          {renderBoxes()}

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* ── Confirm button ── */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              otp.length < OTP_LENGTH && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleVerify}
            disabled={isSubmitting || otp.length < OTP_LENGTH}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Confirm</Text>
            )}
          </Pressable>

          {/* ── Resend ── */}
          <Pressable onPress={handleResend} disabled={cooldown > 0}>
            <Text style={[styles.resend, { color: cooldown > 0 ? theme.textSecondary : '#3C9FFE' }]}>
              {cooldown > 0
                ? `Resend code in ${cooldown}s`
                : 'Resend code'}
            </Text>
          </Pressable>
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
  back: { position: 'absolute', top: Spacing.four, left: Spacing.four },
  header: { gap: Spacing.two },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  boxRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    position: 'relative',
  },
  box: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 10,
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
  errorText: { fontSize: 13, color: '#E53E3E', textAlign: 'center' },
  button: {
    height: 52,
    backgroundColor: '#3C9FFE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { textAlign: 'center', fontSize: 14 },
});
