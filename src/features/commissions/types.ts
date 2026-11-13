/**
 * Commissions feature — shared types.
 * Phase 6: agent network and commission tracking.
 */

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'reversed';

export interface CommissionBalance {
  pendingRands: number;
  approvedRands: number;
  paidRands: number;
}

export interface CommissionLedgerEntry {
  id: string;
  status: CommissionStatus;
  amountRands: number;
  /** Percentage tier at which commission was calculated */
  tierPercent: number;
  referralId: string;
  createdAt: string;
}

export interface AgentNetworkMember {
  id: string;
  fullName: string;
  agentCode: string;
  status: 'active' | 'pending_verification' | 'inactive' | 'suspended';
  referralCount: number;
}
