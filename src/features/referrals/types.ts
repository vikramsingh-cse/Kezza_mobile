/**
 * Referrals feature — shared types.
 * Mirrors the backend Referral model; extended in Phase 4.
 */

export type ReferralStatus =
  | 'registered'
  | 'contacted'
  | 'consultation_booked'
  | 'converted'
  | 'not_converted'
  | 'rejected';

export interface Referral {
  id: string;
  patientName: string;
  patientPhone: string;
  status: ReferralStatus;
  serviceInterest: string | null;
  preferredBranchId: string | null;
  createdAt: string;
  convertedAt: string | null;
}

export interface CreateReferralBody {
  patient_name: string;
  patient_phone_e164: string;
  preferred_branch_id?: string;
  service_interest?: string;
}
