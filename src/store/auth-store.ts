import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

export type UserRole = 'patient' | 'agent';

export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  agentCode?: string;
  patientId?: string;
  agentId?: string;
  email?: string;
}

export interface SignInPayload {
  accessToken: string;
  user: AuthUser;
}

interface AuthState {
  isHydrated: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  user: AuthUser | null;
  pendingReferralCode: string | null;

  hydrate: () => Promise<void>;
  signIn: (payload: SignInPayload) => Promise<void>;
  signOut: () => Promise<void>;
  setPendingReferralCode: (code: string | null) => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

const KEYS = {
  token: 'kezza_access_token',
  user: 'kezza_user',
} as const;

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignore storage errors on restricted environments
  }
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrated: false,
  isAuthenticated: false,
  accessToken: null,
  user: null,
  pendingReferralCode: null,

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
      // Corrupted storage — treat as signed out
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

  setPendingReferralCode: (code: string | null) => {
    set({ pendingReferralCode: code });
  },

  updateUser: (updatedFields: Partial<AuthUser>) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...updatedFields };
      set({ user: updated });
      secureSet(KEYS.user, JSON.stringify(updated));
    }
  },
}));
