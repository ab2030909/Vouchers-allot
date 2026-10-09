import { describe, it, expect } from 'vitest';
import { normalizeWhatsAppNumber, isValidWhatsAppNumber } from '../src/lib/phone';

describe('WhatsApp Phone Normalization Unit Tests', () => {
  it('normalizes standard Pakistani local 03XX number', () => {
    expect(normalizeWhatsAppNumber('03001234567')).toBe('923001234567');
  });

  it('normalizes Pakistani number with leading +92', () => {
    expect(normalizeWhatsAppNumber('+923001234567')).toBe('923001234567');
  });

  it('normalizes Pakistani number with 92 prefix without +', () => {
    expect(normalizeWhatsAppNumber('923001234567')).toBe('923001234567');
  });

  it('normalizes formatted numbers with dashes, spaces, and double zeros', () => {
    expect(normalizeWhatsAppNumber('0300 123 4567')).toBe('923001234567');
    expect(normalizeWhatsAppNumber('0300-1234567')).toBe('923001234567');
    expect(normalizeWhatsAppNumber('0092-300-1234567')).toBe('923001234567');
  });

  it('normalizes equivalent formats to the EXACT same canonical string', () => {
    const format1 = normalizeWhatsAppNumber('03001234567');
    const format2 = normalizeWhatsAppNumber('+923001234567');
    const format3 = normalizeWhatsAppNumber('00923001234567');
    const format4 = normalizeWhatsAppNumber('0300-1234567');

    expect(format1).toBe('923001234567');
    expect(format2).toBe(format1);
    expect(format3).toBe(format1);
    expect(format4).toBe(format1);
  });

  it('rejects invalid, incomplete, or non-phone inputs', () => {
    expect(normalizeWhatsAppNumber('')).toBeNull();
    expect(normalizeWhatsAppNumber('12345')).toBeNull();
    expect(normalizeWhatsAppNumber('invalid_text')).toBeNull();
    expect(isValidWhatsAppNumber('abc')).toBe(false);
  });
});
