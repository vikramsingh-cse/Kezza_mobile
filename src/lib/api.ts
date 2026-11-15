/**
 * Axios API client for the Kezza backend.
 *
 * Base URL is read from EXPO_PUBLIC_API_URL (set in .env).
 *
 * Request interceptor — attaches the JWT access token from the auth store
 * to every request automatically.
 *
 * Response interceptor — catches 401 responses.  In Phase 3, this is where
 * token refresh logic will live.  For now it clears the auth state so the
 * user is redirected to the login screen.
 *
 * Usage
 * ─────
 *  import { api } from '@/lib/api';
 *  const { data } = await api.get<Referral[]>('/referrals');
 */

import { create } from 'axios';
import { useAuthStore } from '@/store/auth-store';

// Android devices must use the Mac's LAN address, never the device's localhost.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!BASE_URL) {
  throw new Error('Set EXPO_PUBLIC_API_URL in .env to the reachable Kezza API URL.');
}
const baseHost = BASE_URL.match(/^https?:\/\/([^/:?#]+)/i)?.[1];
if (!baseHost || /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)$/i.test(baseHost)) {
  throw new Error('EXPO_PUBLIC_API_URL must use a reachable host, such as the Mac Wi-Fi IP, not localhost.');
}

export const api = create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach token ────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — handle 401 ─────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      // Phase 3: attempt token refresh here before signing out.
      await useAuthStore.getState().signOut();
      // The root layout's useProtectedRoute will redirect to login.
    }

    return Promise.reject(error);
  },
);
