/**
 * Referrals feature — React Query hooks.
 * Phase 4: implement when referral endpoints are live.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateReferralBody, Referral } from './types';

export const referralKeys = {
  all: ['referrals'] as const,
  list: () => [...referralKeys.all, 'list'] as const,
  detail: (id: string) => [...referralKeys.all, id] as const,
};

/** Fetch all referrals for the current agent. */
export function useReferrals() {
  return useQuery({
    queryKey: referralKeys.list(),
    queryFn: () =>
      api.get<Referral[]>('/referrals').then((r) => r.data),
  });
}

/** Create a new patient referral. */
export function useCreateReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReferralBody) =>
      api.post<Referral>('/referrals', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: referralKeys.list() });
    },
  });
}
