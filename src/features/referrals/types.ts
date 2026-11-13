export type ReferralStatus =
  | 'registered'
  | 'contacted'
  | 'consultation_booked'
  | 'converted'
  | 'not_converted'
  | 'rejected';

export interface Referral {
  id: string;
  patient_name: string;
  patient_phone_e164: string;
  referring_agent_id: string;
  status: ReferralStatus;
  service_interest: string | null;
  created_at: string;
  converted_at: string | null;
}

export interface CreateReferralLeadBody {
  patient_name: string;
  patient_phone_e164: string;
  preferred_branch_id?: string;
  service_interest?: string;
}

export interface AgentReferralCodeInfo {
  agent_code: string;
  referral_link: string;
  total_referrals: number;
  converted_count: number;
}

export interface PatientAttributionInfo {
  has_referral: boolean;
  referring_agent_code?: string;
  status?: string;
  converted_at?: string | null;
  message?: string;
}
