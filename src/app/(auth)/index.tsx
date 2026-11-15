import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AccountOptionProps = {
  accent: string;
  description: string;
  icon: string;
  onPress: () => void;
  title: string;
};

function AccountOption({ accent, description, icon, onPress, title }: AccountOptionProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
        <Text style={[styles.icon, { color: accent }]}>{icon}</Text>
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Text style={[styles.arrow, { color: accent }]}>›</Text>
    </Pressable>
  );
}

export default function AccountTypeScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ ref?: string }>();
  const referralCode = typeof params.ref === 'string' ? params.ref : '';

  function openSignIn(role: 'patient' | 'agent') {
    router.push({ pathname: '/(auth)/login', params: { role, ref: referralCode } });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandInitial}>K</Text></View>
          <Text style={[styles.brandName, { color: theme.text }]}>Kezza</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>WELCOME</Text>
          <Text style={[styles.title, { color: theme.text }]}>How will you use Kezza?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose the account that matches you. Sign in or create an account with your mobile number.
          </Text>
        </View>

        <View style={styles.options}>
          <AccountOption
            accent="#2563EB"
            icon="✦"
            title="Patient"
            description="Earn treatment credit and keep track of your rewards."
            onPress={() => openSignIn('patient')}
          />
          <AccountOption
            accent="#0F766E"
            icon="↗"
            title="Agent / Partner"
            description="Refer patients, grow your network and follow your earnings."
            onPress={() => openSignIn('agent')}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerHint, { color: theme.textSecondary }]}>Kezza team member?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { admin: '1' } })}
            hitSlop={8}
          >
            <Text style={styles.adminLink}>Administrator sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.four },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  brandInitial: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  brandName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  intro: { gap: Spacing.two, marginTop: Spacing.two },
  eyebrow: { color: '#2563EB', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 31, fontWeight: '800', lineHeight: 38, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 23 },
  options: { gap: Spacing.two },
  option: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: 18 },
  iconWrap: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 25, fontWeight: '700' },
  optionCopy: { flex: 1, gap: 5 },
  optionTitle: { fontSize: 17, fontWeight: '800' },
  optionDescription: { fontSize: 13, lineHeight: 19 },
  arrow: { fontSize: 28, fontWeight: '500' },
  footer: { alignItems: 'center', gap: Spacing.one, paddingTop: Spacing.two },
  footerHint: { fontSize: 13 },
  adminLink: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
