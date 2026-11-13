import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { PatientWalletInfo } from './types';

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
