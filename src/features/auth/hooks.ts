/**
 * Auth feature — React Query hooks.
 * Phase 3: implement these when OTP endpoints are live.
 */

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { AuthTokenResponse, OtpRequestBody, OtpVerifyBody } from './types';

/** Step 1: Request an OTP for the given phone number. */
export function useRequestOtp() {
  return useMutation({
    mutationFn: (body: OtpRequestBody) =>
      api.post('/auth/otp/request', body),
  });
}

/** Step 2: Verify the OTP and receive tokens. */
export function useVerifyOtp() {
  const signIn = useAuthStore((s) => s.signIn);

  return useMutation({
    mutationFn: (body: OtpVerifyBody) =>
      api.post<AuthTokenResponse>('/auth/otp/verify', body).then((r) => r.data),
    onSuccess: async (data) => {
      await signIn({
        accessToken: data.access_token,
        user: {
          id: data.user.id,
          fullName: data.user.full_name,
          phone: data.user.phone_e164,
          role: data.user.role,
          agentCode: data.user.agent_code,
        },
      });
    },
  });
}
