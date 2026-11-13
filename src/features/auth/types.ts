export interface OtpRequestBody {
  phone_e164: string;
}

export interface OtpVerifyBody {
  phone_e164: string;
  otp_code: string;
}

export interface UserRegisterBody {
  phone_e164: string;
  full_name: string;
  role: 'patient' | 'agent';
  email?: string;
  referral_code?: string;
}

export interface UserProfileResponse {
  id: string;
  phone_e164: string;
  full_name: string;
  email: string | null;
  role: 'patient' | 'agent';
  agent_code: string | null;
  patient_id: string | null;
  agent_id: string | null;
  is_active: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user: UserProfileResponse;
}

export interface OtpVerifyResponse {
  status: 'success' | 'needs_registration';
  access_token?: string;
  token_type?: string;
  user?: UserProfileResponse;
  phone_e164?: string;
  message?: string;
}
