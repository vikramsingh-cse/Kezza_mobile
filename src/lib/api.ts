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

import axios from 'axios';
import { useAuthStore } from '@/store/auth-store';

// Set EXPO_PUBLIC_API_URL in your .env file, e.g.:
//   EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export const api = axios.create({
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
