import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

import type {
  AdminPatientSearchResult,
  AdminPointGrantResult,
  CommissionApprovalResult,
  PendingCommission,
} from './types';

export function usePendingAdminCommissions() {
  return useQuery({
    queryKey: ['admin', 'commissions', 'pending'],
    queryFn: async () => {
      const response = await api.get<PendingCommission[]>('/admin/commissions/pending');
      return response.data;
    },
  });
}

export function useAdminPatientSearch(query: string) {
  const normalized = query.trim();
  return useQuery({
    queryKey: ['admin', 'patients', normalized],
    queryFn: async () => {
      const response = await api.get<AdminPatientSearchResult[]>('/admin/patients/search', {
        params: { query: normalized },
      });
      return response.data;
    },
    enabled: normalized.length >= 2,
  });
}

export function useApproveCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commissionId: string) => {
      const response = await api.post<CommissionApprovalResult>(
        `/admin/commissions/${commissionId}/approve`,
      );
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'commissions'] }),
        queryClient.invalidateQueries({ queryKey: ['commissions'] }),
      ]);
    },
  });
}

export function useGrantPatientPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      points,
      reason,
    }: {
      patientId: string;
      points: number;
      reason: string;
    }) => {
      const response = await api.post<AdminPointGrantResult>(
        `/admin/patients/${patientId}/points`,
        { points, reason },
      );
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'patients'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet', 'patient'] }),
      ]);
    },
  });
}
