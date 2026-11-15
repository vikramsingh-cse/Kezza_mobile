import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuthStore();

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.fullName?.[0]?.toUpperCase() ?? 'K'}
            </Text>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>
            {user?.fullName || 'User'}
          </Text>
          <Text style={[styles.phone, { color: theme.textSecondary }]}>
            {user?.phone}
          </Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Account Role</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                {user?.role === 'agent' ? '🏷️ Agent Partner' : '🏥 Patient Member'}
              </Text>
            </View>
          </View>

          {user?.agentCode && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Agent Code</Text>
              <Text style={[styles.infoValue, { color: '#2563EB', fontWeight: '800' }]}>
                {user.agentCode}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>User ID</Text>
            <Text style={[styles.infoValue, { color: theme.textSecondary }]}>
              {user?.id?.slice(0, 8)}...
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Sign Out */}
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.four, gap: Spacing.four, minHeight: '100%' },
  avatarContainer: { alignItems: 'center', gap: 6, marginVertical: Spacing.two },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3C9FFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800' },
  phone: { fontSize: 14 },

  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '600' },
  rolePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rolePillText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },

  signOutBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
