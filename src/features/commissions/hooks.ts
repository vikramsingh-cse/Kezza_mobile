import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { AgentEarningsInfo } from './types';

export const commissionKeys = {
  all: ['commissions'] as const,
  earnings: () => [...commissionKeys.all, 'earnings'] as const,
};

/** Agent retrieves commission tier, earnings breakdown, and ledger */
export function useAgentEarnings() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: commissionKeys.earnings(),
    queryFn: async () => {
      const res = await api.get<AgentEarningsInfo>('/wallet/agent');
      return res.data;
    },
    enabled: role === 'agent',
  });
}
