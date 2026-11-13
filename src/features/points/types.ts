export interface PointsLedgerEntry {
  id: string;
  points: number;
  balance_after: number;
  event_type: string;
  description: string;
  created_at: string;
}
export interface PatientWalletInfo {
  total_points: number;
  credit_rands: number;
  points_rate_description: string;
  ledger: PointsLedgerEntry[];
}
