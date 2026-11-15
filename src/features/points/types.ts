export interface PointsLedgerEntry {
  id: string;
  points: number;
  balance_after: number;
  event_type: string;
  description: string;
  policy_version: string;
  reversal_of_id: string | null;
  created_at: string;
}
export interface PatientWalletInfo {
  total_points: number;
  credit_minor_units: number;
  currency: string;
  legacy_zar_points: number;
  legacy_zar_credit_minor_units: number;
  points_rate_description: string;
  ledger: PointsLedgerEntry[];
}
