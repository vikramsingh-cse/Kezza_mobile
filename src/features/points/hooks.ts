import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { commissionKeys } from '@/features/commissions/hooks';
import { referralKeys } from '@/features/referrals/hooks';
import type {
  PatientWalletInfo,
  TreatmentPaymentCreateBody,
  TreatmentPaymentResponse,
} from './types';

export const pointsKeys = {
  wallet: ['wallet', 'patient'] as const,
};

/** Patient fetches their points balance and wallet ledger */
export function usePatientWallet() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: pointsKeys.wallet,
    queryFn: async () => {
      const res = await api.get<PatientWalletInfo>('/wallet/patient');
      return res.data;
    },
    enabled: role === 'patient',
  });
}

/** Patient purchases a treatment — generates points reward and agent commission */
export function usePurchaseTreatment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: TreatmentPaymentCreateBody): Promise<TreatmentPaymentResponse> => {
      const res = await api.post<TreatmentPaymentResponse>('/payments/purchase-treatment', body);
      return res.data;
    },
    onSuccess: () => {
      // Invalidate patient wallet
      qc.invalidateQueries({ queryKey: pointsKeys.wallet });
      // Invalidate agent earnings & referrals in case user is testing both
      qc.invalidateQueries({ queryKey: commissionKeys.earnings });
      qc.invalidateQueries({ queryKey: referralKeys.agentList() });
      qc.invalidateQueries({ queryKey: referralKeys.agentCode() });
    },
  });
}
