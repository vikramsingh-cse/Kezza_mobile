/**
 * Auth store — single source of truth for authentication state.
 *
 * Uses Zustand for reactive state and expo-secure-store for persistence
 * across app launches.  Web falls back to localStorage since SecureStore
 * is native-only.
 *
 * Keys
 * ────
 *  kezza_access_token  — JWT access token
 *  kezza_user          — serialised User object
 *
 * Usage
 * ─────
 *  const { isAuthenticated, user } = useAuthStore();
 *  const signIn = useAuthStore((s) => s.signIn);
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────────────────────

export type UserRole = 'patient' | 'agent';

export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  /** Optional — present once the agent profile is confirmed */
  agentCode?: string;
}

export interface SignInPayload {
  accessToken: string;
  user: AuthUser;
}

interface AuthState {
  /** True once hydrate() has finished reading from SecureStore */
  isHydrated: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  user: AuthUser | null;

  /** Read persisted auth from SecureStore on app launch */
  hydrate: () => Promise<void>;
  /** Store tokens and user; called after a successful OTP verify */
  signIn: (payload: SignInPayload) => Promise<void>;
  /** Clear tokens and user; called on sign-out */
  signOut: () => Promise<void>;
}

// ── Secure storage helpers ─────────────────────────────────────────────────

const KEYS = {
  token: 'kezza_access_token',
  user: 'kezza_user',
} as const;

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  return SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  return SecureStore.deleteItemAsync(key);
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  isAuthenticated: false,
  accessToken: null,
  user: null,

  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        secureGet(KEYS.token),
        secureGet(KEYS.user),
      ]);

      if (token && userJson) {
        const user: AuthUser = JSON.parse(userJson);
        set({ isAuthenticated: true, accessToken: token, user });
      }
    } catch {
      // Corrupted storage — treat as signed out.
    } finally {
      set({ isHydrated: true });
    }
  },

  signIn: async ({ accessToken, user }) => {
    await Promise.all([
      secureSet(KEYS.token, accessToken),
      secureSet(KEYS.user, JSON.stringify(user)),
    ]);
    set({ isAuthenticated: true, accessToken, user });
  },

  signOut: async () => {
    await Promise.all([
      secureDelete(KEYS.token),
      secureDelete(KEYS.user),
    ]);
    set({ isAuthenticated: false, accessToken: null, user: null });
  },
}));
