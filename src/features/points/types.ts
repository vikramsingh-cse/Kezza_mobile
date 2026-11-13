/**
 * Points feature — shared types.
 * Phase 5: patient wallet — balance, ledger, redemptions.
 */

export interface PointsBalance {
  totalPoints: number;
  /** Monetary value of points (e.g. 1 pt = R 1) */
  creditRands: number;
}

export type LedgerEntryType = 'earn' | 'redeem' | 'reverse' | 'expire';

export interface PointsLedgerEntry {
  id: string;
  type: LedgerEntryType;
  points: number;
  description: string;
  createdAt: string;
}

export interface RedeemPointsBody {
  points: number;
  branch_id: string;
  note?: string;
}
