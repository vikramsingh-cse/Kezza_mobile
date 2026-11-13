/**
 * Commissions feature — React Query hooks.
 * Phase 6: implement when commission endpoints are live.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AgentNetworkMember,
  CommissionBalance,
  CommissionLedgerEntry,
} from './types';

export const commissionKeys = {
  balance: ['commissions', 'balance'] as const,
  ledger: ['commissions', 'ledger'] as const,
  network: ['commissions', 'network'] as const,
};

export function useCommissionBalance() {
  return useQuery({
    queryKey: commissionKeys.balance,
    queryFn: () =>
      api.get<CommissionBalance>('/commissions/balance').then((r) => r.data),
  });
}

export function useCommissionLedger() {
  return useQuery({
    queryKey: commissionKeys.ledger,
    queryFn: () =>
      api.get<CommissionLedgerEntry[]>('/commissions/ledger').then((r) => r.data),
  });
}

export function useAgentNetwork() {
  return useQuery({
    queryKey: commissionKeys.network,
    queryFn: () =>
      api.get<AgentNetworkMember[]>('/agents/network').then((r) => r.data),
  });
}
