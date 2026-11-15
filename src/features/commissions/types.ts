export interface CommissionLedgerEntry {
  id: string;
  tier_name: string | null;
  eligible_direct_agents: number | null;
  tier_percent: number;
  amount_minor_units: number;
  currency: string;
  status: string;
  reversal_of_id: string | null;
  created_at: string;
  treatment_name: string | null;
}

export interface CommissionCurrencyTotals {
  pending_minor_units: number;
  approved_minor_units: number;
  paid_minor_units: number;
  total_earned_minor_units: number;
}

export interface AgentEarningsInfo {
  agent_code: string;
  commission_tier: string;
  tier_percent: number;
  eligible_direct_agents: number;
  pending_minor_units: number;
  approved_minor_units: number;
  paid_minor_units: number;
  total_earned_minor_units: number;
  earnings_by_currency: Record<string, CommissionCurrencyTotals>;
  ledger: CommissionLedgerEntry[];
}
