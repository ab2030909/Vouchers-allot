import { describe, it, expect } from 'vitest';
import { parseAttendeeCSV, parseVoucherCSV } from '../src/lib/csv';

describe('CSV Parsing & Validation Unit Tests', () => {
  describe('Attendee CSV Parsing', () => {
    it('parses valid attendee CSV with UTF-8 BOM and headers', () => {
      const csv = '\uFEFFname,whatsapp_number\nAli Khan,03001234567\nSara Ahmed,+923011234567';
      const preview = parseAttendeeCSV(csv);

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows.length).toBe(2);
      expect(preview.errorRows.length).toBe(0);
      expect(preview.validRows[0].normalizedPhone).toBe('923001234567');
      expect(preview.validRows[1].normalizedPhone).toBe('923011234567');
    });

    it('rejects duplicate phone numbers within the file', () => {
      const csv = 'name,whatsapp_number\nAli Khan,03001234567\nDuplicate Ali,+923001234567';
      const preview = parseAttendeeCSV(csv);

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows.length).toBe(1);
      expect(preview.errorRows.length).toBe(1);
      expect(preview.duplicatesInFileCount).toBe(1);
      expect(preview.errorRows[0].error).toContain('Duplicate phone number');
    });

    it('handles missing names or invalid phone numbers', () => {
      const csv = 'name,whatsapp_number\n,03001234567\nBad Phone,invalid_num';
      const preview = parseAttendeeCSV(csv);

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows.length).toBe(0);
      expect(preview.errorRows.length).toBe(2);
    });
  });

  describe('Voucher CSV Parsing', () => {
    it('parses valid voucher CSV links', () => {
      const csv = 'redeem_url\nhttps://kiro.dev/redeem/link1\nhttps://kiro.dev/redeem/link2';
      const preview = parseVoucherCSV(csv);

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows.length).toBe(2);
      expect(preview.errorRows.length).toBe(0);
    });

    it('rejects duplicate voucher links within the file', () => {
      const csv = 'redeem_url\nhttps://kiro.dev/redeem/link1\nhttps://kiro.dev/redeem/link1';
      const preview = parseVoucherCSV(csv);

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows.length).toBe(1);
      expect(preview.errorRows.length).toBe(1);
      expect(preview.duplicatesInFileCount).toBe(1);
    });

    it('rejects invalid non-HTTP/HTTPS URLs', () => {
      const csv = 'redeem_url\nftp://invalid.com/link\nnot-a-url';
      const preview = parseVoucherCSV(csv);

      expect(preview.validRows.length).toBe(0);
      expect(preview.errorRows.length).toBe(2);
    });
  });
});
