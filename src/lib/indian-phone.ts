const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

/** Keep phone fields limited to an Indian ten-digit national number. */
export function getIndianMobileDigits(input: string): string {
  let digits = input.replace(/\D/g, '');

  // Also accept a full Indian number pasted from contacts or another app.
  if (digits.startsWith('0091') && digits.length > 10) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function isValidIndianMobile(phone: string): boolean {
  return INDIAN_MOBILE_PATTERN.test(phone);
}

export function isValidIndianE164(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

export function toIndianE164(phone: string): string {
  return `+91${phone}`;
}
