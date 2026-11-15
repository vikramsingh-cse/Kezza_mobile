export interface AdminPatientSearchResult {
  patient_id: string;
  full_name: string;
  phone_e164: string;
  total_points: number;
  credit_minor_units: number;
}

export interface PendingCommission {
  commission_id: string;
  agent_name: string;
  agent_phone_e164: string;
  agent_code: string;
  patient_name: string;
  patient_phone_e164: string;
  treatment_name: string;
  amount_minor_units: number;
  currency: string;
  tier_name: string;
  tier_percent: number;
  created_at: string;
}

export interface AdminPointGrantResult {
  ledger_id: string;
  patient_id: string;
  points_added: number;
  total_points: number;
  credit_minor_units: number;
  reason: string;
  created_by_user_id: string;
  created_at: string;
}

export interface CommissionApprovalResult {
  commission_id: string;
  status: 'approved';
  approved_at: string;
  approved_by_user_id: string;
}
