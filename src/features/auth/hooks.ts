import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { UserRole } from '@/store/auth-store';
import type {
  AuthTokenResponse,
  OtpRequestBody,
  OtpVerifyBody,
  OtpVerifyResponse,
  UserProfileResponse,
  UserRegisterBody,
} from './types';

/** Step 1: Request an OTP for the phone number */
export function useRequestOtp() {
  return useMutation({
    mutationFn: async (body: OtpRequestBody) => {
      const response = await api.post('/auth/otp/request', body);
      return response.data;
    },
  });
}

/** Step 2: Verify the OTP */
export function useVerifyOtp(requiredRole?: UserRole) {
  const signIn = useAuthStore((s) => s.signIn);

  return useMutation({
    mutationFn: async (body: OtpVerifyBody): Promise<OtpVerifyResponse> => {
      const response = await api.post<OtpVerifyResponse>('/auth/otp/verify', body);
      return response.data;
    },
    onSuccess: async (data) => {
      if (
        data.status === 'success' &&
        data.access_token &&
        data.user &&
        (!requiredRole || data.user.role === requiredRole)
      ) {
        await signIn({
          accessToken: data.access_token,
          user: {
            id: data.user.id,
            fullName: data.user.full_name,
            phone: data.user.phone_e164,
            role: data.user.role,
            agentCode: data.user.agent_code ?? undefined,
            patientId: data.user.patient_id ?? undefined,
            agentId: data.user.agent_id ?? undefined,
            email: data.user.email ?? undefined,
          },
        });
        useAuthStore.getState().setPendingReferralCode(null);
      }
    },
  });
}

/** Step 3: Register user account (Patient with optional referral code, or Agent) */
export function useRegisterUser() {
  const signIn = useAuthStore((s) => s.signIn);

  return useMutation({
    mutationFn: async (body: UserRegisterBody): Promise<AuthTokenResponse> => {
      const response = await api.post<AuthTokenResponse>('/auth/register', body);
      return response.data;
    },
    onSuccess: async (data) => {
      await signIn({
        accessToken: data.access_token,
        user: {
          id: data.user.id,
          fullName: data.user.full_name,
          phone: data.user.phone_e164,
          role: data.user.role,
          agentCode: data.user.agent_code ?? undefined,
          patientId: data.user.patient_id ?? undefined,
          agentId: data.user.agent_id ?? undefined,
          email: data.user.email ?? undefined,
        },
      });
      useAuthStore.getState().setPendingReferralCode(null);
    },
  });
}

/** Fetch latest profile of authenticated user */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get<UserProfileResponse>('/auth/me');
      return res.data;
    },
    enabled: !!useAuthStore.getState().accessToken,
  });
}
