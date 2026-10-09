import { parsePhoneNumberWithError, ParseError } from 'libphonenumber-js';

/**
 * Normalizes a WhatsApp phone number into a canonical string format.
 * Defaults to Pakistan ('PK') region if no country code is specified.
 * Canonical format for PK numbers: "923XXXXXXXXX" (12 digits without +).
 * Canonical format for international numbers: E.164 without leading + (e.g., "14155552671").
 * 
 * @param input Raw phone number input from user or CSV
 * @returns Normalized phone number string, or null if invalid
 */
export function normalizeWhatsAppNumber(input: string | null | undefined): string | null {
  if (!input) return null;

  // 1. Clean whitespace, dashes, parens, and leading double zeros (e.g. 0092 -> +92)
  let cleaned = input.trim();
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // Quick check: if string contains invalid characters (letters etc), strip non-digit except leading +
  const sanitized = cleaned.replace(/[^\d+]/g, '');
  if (!sanitized || sanitized.length < 7) return null;

  // 2. Try parsing with libphonenumber-js using default country 'PK'
  try {
    const phoneNumber = parsePhoneNumberWithError(sanitized, 'PK');
    if (phoneNumber && phoneNumber.isValid()) {
      // E.164 format comes as "+923001234567". Strip the leading "+" to get "923001234567".
      return phoneNumber.format('E.164').replace(/^\+/, '');
    }
  } catch (e) {
    // Fallback to strict custom Pakistani mobile number normalizer if libphonenumber fails on edge case
  }

  // 3. Fallback Pakistani Mobile Normalizer
  // Pakistani mobile numbers: 
  // - Local: 03XX XXXXXXX (11 digits starting with 03) -> 923XXXXXXXXX
  // - Short: 3XX XXXXXXX (10 digits starting with 3) -> 923XXXXXXXXX
  // - International with 92: 923XX XXXXXXX (12 digits starting with 923)
  const digitsOnly = sanitized.replace(/\D/g, '');

  if (/^03\d{9}$/.test(digitsOnly)) {
    return '92' + digitsOnly.slice(1);
  }

  if (/^3\d{9}$/.test(digitsOnly)) {
    return '92' + digitsOnly;
  }

  if (/^923\d{9}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  // If digits fits international mobile range (e.g., 10-15 digits), return digitsOnly
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return digitsOnly;
  }

  return null;
}

/**
 * Validates whether a phone number is valid after normalization.
 */
export function isValidWhatsAppNumber(input: string | null | undefined): boolean {
  return normalizeWhatsAppNumber(input) !== null;
}

/**
 * Formats a normalized phone number for display (e.g., "+92 300 1234567").
 */
export function formatPhoneForDisplay(normalized: string): string {
  if (!normalized) return '';
  if (normalized.startsWith('92') && normalized.length === 12) {
    return `+92 ${normalized.slice(2, 5)} ${normalized.slice(5)}`;
  }
  return `+${normalized}`;
}
