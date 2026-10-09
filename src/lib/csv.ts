import Papa from 'papaparse';
import { normalizeWhatsAppNumber } from './phone';

export interface ParsedAttendeeRow {
  rowNumber: number;
  name: string;
  rawPhone: string;
  normalizedPhone: string | null;
  isValid: boolean;
  error?: string;
}

export interface AttendeeImportPreview {
  totalRows: number;
  validRows: ParsedAttendeeRow[];
  errorRows: ParsedAttendeeRow[];
  duplicatesInFileCount: number;
}

export interface ParsedVoucherRow {
  rowNumber: number;
  redeemUrl: string;
  isValid: boolean;
  error?: string;
}

export interface VoucherImportPreview {
  totalRows: number;
  validRows: ParsedVoucherRow[];
  errorRows: ParsedVoucherRow[];
  duplicatesInFileCount: number;
}

/**
 * Removes UTF-8 BOM if present.
 */

function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Parses and validates an Attendee CSV input.
 */
export function parseAttendeeCSV(csvContent: string): AttendeeImportPreview {
  const cleanContent = stripBOM(csvContent);
  const parsed = Papa.parse<Record<string, string>>(cleanContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, '_'),
  });

  const rows = parsed.data;
  const validRows: ParsedAttendeeRow[] = [];
  const errorRows: ParsedAttendeeRow[] = [];
  const seenPhones = new Set<string>();
  let duplicatesInFileCount = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-based index including header
    const name = (row['name'] || row['full_name'] || row['attendee_name'] || '').trim();
    const rawPhone = (
      row['whatsapp_number'] ||
      row['whatsapp'] ||
      row['phone'] ||
      row['mobile'] ||
      row['phone_number'] ||
      ''
    ).trim();

    if (!name) {
      errorRows.push({
        rowNumber: rowNum,
        name: name || '[Missing]',
        rawPhone,
        normalizedPhone: null,
        isValid: false,
        error: 'Attendee name is missing or empty.',
      });
      return;
    }

    if (!rawPhone) {
      errorRows.push({
        rowNumber: rowNum,
        name,
        rawPhone: '[Missing]',
        normalizedPhone: null,
        isValid: false,
        error: 'WhatsApp number is missing or empty.',
      });
      return;
    }

    const normalized = normalizeWhatsAppNumber(rawPhone);
    if (!normalized) {
      errorRows.push({
        rowNumber: rowNum,
        name,
        rawPhone,
        normalizedPhone: null,
        isValid: false,
        error: `Invalid phone format: "${rawPhone}". Expected valid Pakistani or international format.`,
      });
      return;
    }

    if (seenPhones.has(normalized)) {
      duplicatesInFileCount++;
      errorRows.push({
        rowNumber: rowNum,
        name,
        rawPhone,
        normalizedPhone: normalized,
        isValid: false,
        error: `Duplicate phone number "${normalized}" within the uploaded file.`,
      });
      return;
    }

    seenPhones.add(normalized);
    validRows.push({
      rowNumber: rowNum,
      name,
      rawPhone,
      normalizedPhone: normalized,
      isValid: true,
    });
  });

  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    duplicatesInFileCount,
  };
}

/**
 * Parses and validates a Voucher CSV input.
 */
export function parseVoucherCSV(csvContent: string): VoucherImportPreview {
  const cleanContent = stripBOM(csvContent);
  const parsed = Papa.parse<Record<string, string>>(cleanContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, '_'),
  });

  const rows = parsed.data;
  const validRows: ParsedVoucherRow[] = [];
  const errorRows: ParsedVoucherRow[] = [];
  const seenUrls = new Set<string>();
  let duplicatesInFileCount = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const redeemUrl = (
      row['redeem_url'] ||
      row['url'] ||
      row['voucher_url'] ||
      row['link'] ||
      row['redemption_link'] ||
      ''
    ).trim();

    if (!redeemUrl) {
      errorRows.push({
        rowNumber: rowNum,
        redeemUrl: '[Missing]',
        isValid: false,
        error: 'Redemption URL is missing or empty.',
      });
      return;
    }

    // Validate URL format
    try {
      const urlObj = new URL(redeemUrl);
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        errorRows.push({
          rowNumber: rowNum,
          redeemUrl,
          isValid: false,
          error: 'URL must use HTTP or HTTPS protocol.',
        });
        return;
      }
    } catch (e) {
      errorRows.push({
        rowNumber: rowNum,
        redeemUrl,
        isValid: false,
        error: `Invalid URL format: "${redeemUrl}".`,
      });
      return;
    }

    if (seenUrls.has(redeemUrl)) {
      duplicatesInFileCount++;
      errorRows.push({
        rowNumber: rowNum,
        redeemUrl,
        isValid: false,
        error: `Duplicate redemption URL within the uploaded file.`,
      });
      return;
    }

    seenUrls.add(redeemUrl);
    validRows.push({
      rowNumber: rowNum,
      redeemUrl,
      isValid: true,
    });
  });

  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    duplicatesInFileCount,
  };
}
