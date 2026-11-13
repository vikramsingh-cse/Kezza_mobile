export interface CommissionLedgerEntry {
  id: string;
  tier_percent: number;
  amount_rands: number;
  status: string;
  created_at: string;
  treatment_name: string | null;
}

export interface AgentEarningsInfo {
  agent_code: string;
  commission_tier: string;
  tier_percent: number;
  pending_rands: number;
  approved_rands: number;
  paid_rands: number;
  total_earned_rands: number;
  ledger: CommissionLedgerEntry[];
}
