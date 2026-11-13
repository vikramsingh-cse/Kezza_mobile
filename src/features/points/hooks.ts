/**
 * Points feature — React Query hooks.
 * Phase 5: implement when wallet endpoints are live.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PointsBalance, PointsLedgerEntry, RedeemPointsBody } from './types';

export const pointsKeys = {
  balance: ['points', 'balance'] as const,
  ledger: ['points', 'ledger'] as const,
};

export function usePointsBalance() {
  return useQuery({
    queryKey: pointsKeys.balance,
    queryFn: () =>
      api.get<PointsBalance>('/wallet/balance').then((r) => r.data),
  });
}

export function usePointsLedger() {
  return useQuery({
    queryKey: pointsKeys.ledger,
    queryFn: () =>
      api.get<PointsLedgerEntry[]>('/wallet/ledger').then((r) => r.data),
  });
}

export function useRedeemPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RedeemPointsBody) =>
      api.post('/wallet/redeem', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pointsKeys.balance });
      qc.invalidateQueries({ queryKey: pointsKeys.ledger });
    },
  });
}
