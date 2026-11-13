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

export interface TreatmentPaymentCreateBody {
  treatment_name: string;
  amount_rands: number;
  payment_reference?: string;
  branch_id?: string;
  patient_id?: string;
}

export interface TreatmentPaymentResponse {
  payment_id: string;
  treatment_name: string;
  amount_rands: number;
  status: string;
  points_earned: number;
  new_points_balance: number;
  agent_commission_rands: number | null;
  referral_converted: boolean;
}
