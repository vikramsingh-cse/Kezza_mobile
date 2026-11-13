/**
 * Auth feature — shared types.
 * Expanded in Phase 3 when real auth endpoints are built.
 */

export interface OtpRequestBody {
  phone_e164: string;
}

export interface OtpVerifyBody {
  phone_e164: string;
  otp_code: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: {
    id: string;
    full_name: string;
    phone_e164: string;
    role: 'patient' | 'agent';
    agent_code?: string;
  };
}
