import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type {
  AgentReferralCodeInfo,
  CreateReferralLeadBody,
  PatientAttributionInfo,
  Referral,
} from './types';

export const referralKeys = {
  all: ['referrals'] as const,
  agentCode: () => [...referralKeys.all, 'my-code'] as const,
  agentList: () => [...referralKeys.all, 'list'] as const,
  attribution: () => [...referralKeys.all, 'attribution'] as const,
};

/** Agent retrieves their referral code, link, and counts */
export function useAgentReferralCode() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: referralKeys.agentCode(),
    queryFn: async () => {
      const res = await api.get<AgentReferralCodeInfo>('/referrals/my-code');
      return res.data;
    },
    enabled: role === 'agent',
  });
}

/** Agent retrieves list of referred patients */
export function useAgentReferrals() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: referralKeys.agentList(),
    queryFn: async () => {
      const res = await api.get<Referral[]>('/referrals');
      return res.data;
    },
    enabled: role === 'agent',
  });
}

/** Agent creates a new patient lead */
export function useCreateReferralLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReferralLeadBody) => {
      const res = await api.post<Referral>('/referrals/lead', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: referralKeys.agentList() });
      qc.invalidateQueries({ queryKey: referralKeys.agentCode() });
    },
  });
}

/** Patient checks which agent referred them */
export function usePatientAttribution() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: referralKeys.attribution(),
    queryFn: async () => {
      const res = await api.get<PatientAttributionInfo>('/referrals/patient-attribution');
      return res.data;
    },
    enabled: role === 'patient',
  });
}
