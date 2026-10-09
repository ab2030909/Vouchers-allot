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
  const cleanContent = stripBOM(csvContent).trim();
  if (!cleanContent) {
    return { totalRows: 0, validRows: [], errorRows: [], duplicatesInFileCount: 0 };
  }

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
    const rowNum = idx + 2;
    let name = (
      row['name'] ||
      row['full_name'] ||
      row['attendee_name'] ||
      row['attendee'] ||
      ''
    ).trim();

    let rawPhone = (
      row['whatsapp_number'] ||
      row['whatsapp'] ||
      row['phone'] ||
      row['mobile'] ||
      row['phone_number'] ||
      row['contact'] ||
      ''
    ).trim();

    // Fallback: search values if keys are unmapped
    if (!name || !rawPhone) {
      const vals = Object.values(row).map((v) => (v || '').trim()).filter(Boolean);
      for (const val of vals) {
        if (!rawPhone && normalizeWhatsAppNumber(val)) {
          rawPhone = val;
        } else if (!name && !normalizeWhatsAppNumber(val)) {
          name = val;
        }
      }
    }

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
 * Supports:
 * - URLs with headers (redeem_url, url, voucher, link, code, etc.)
 * - Raw URL lists with NO header line (automatically detected!)
 * - Automatic protocol prepending if missing (e.g. kiro.dev/redeem/... -> https://kiro.dev/redeem/...)
 */
export function parseVoucherCSV(csvContent: string): VoucherImportPreview {
  const cleanContent = stripBOM(csvContent).trim();
  if (!cleanContent) {
    return { totalRows: 0, validRows: [], errorRows: [], duplicatesInFileCount: 0 };
  }

  // Check if first non-empty line looks like a URL (starts with http://, https://, or contains kiro.dev)
  const lines = cleanContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || '';
  const firstLineIsUrl =
    /^https?:\/\//i.test(firstLine) ||
    /^kiro\.dev/i.test(firstLine) ||
    /^www\./i.test(firstLine) ||
    firstLine.includes('/redeem/');

  let rawRows: Array<{ rowNum: number; data: Record<string, string> }> = [];

  if (firstLineIsUrl) {
    // No header line! Treat every line as a voucher URL
    lines.forEach((line, idx) => {
      rawRows.push({
        rowNum: idx + 1,
        data: { _url: line },
      });
    });
  } else {
    // Has header line
    const parsed = Papa.parse<Record<string, string>>(cleanContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, '_'),
    });

    rawRows = parsed.data.map((row, idx) => ({
      rowNum: idx + 2,
      data: row,
    }));
  }

  const validRows: ParsedVoucherRow[] = [];
  const errorRows: ParsedVoucherRow[] = [];
  const seenUrls = new Set<string>();
  let duplicatesInFileCount = 0;

  rawRows.forEach(({ rowNum, data }) => {
    let candidate = (
      data['_url'] ||
      data['redeem_url'] ||
      data['url'] ||
      data['voucher_url'] ||
      data['link'] ||
      data['redemption_link'] ||
      data['voucher'] ||
      data['vouchers'] ||
      data['code'] ||
      ''
    ).trim();

    if (!candidate) {
      // Search all values in the row object for any string resembling a URL or redemption link
      for (const val of Object.values(data)) {
        const v = (val || '').trim();
        if (/^https?:\/\//i.test(v) || /^kiro\.dev/i.test(v) || /^www\./i.test(v) || v.includes('/redeem/')) {
          candidate = v;
          break;
        }
      }
    }

    if (!candidate) {
      errorRows.push({
        rowNumber: rowNum,
        redeemUrl: '[Missing]',
        isValid: false,
        error: 'Redemption URL is missing or empty.',
      });
      return;
    }

    // Auto-fix missing protocol if string starts with domain pattern like kiro.dev or www.
    if (/^(kiro\.dev|www\.)/i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
      candidate = 'https://' + candidate;
    }

    // Validate URL syntax
    try {
      const urlObj = new URL(candidate);
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        errorRows.push({
          rowNumber: rowNum,
          redeemUrl: candidate,
          isValid: false,
          error: 'URL must use HTTP or HTTPS protocol.',
        });
        return;
      }
    } catch (e) {
      errorRows.push({
        rowNumber: rowNum,
        redeemUrl: candidate,
        isValid: false,
        error: `Invalid URL format: "${candidate}".`,
      });
      return;
    }

    if (seenUrls.has(candidate)) {
      duplicatesInFileCount++;
      errorRows.push({
        rowNumber: rowNum,
        redeemUrl: candidate,
        isValid: false,
        error: `Duplicate redemption URL within the uploaded file.`,
      });
      return;
    }

    seenUrls.add(candidate);
    validRows.push({
      rowNumber: rowNum,
      redeemUrl: candidate,
      isValid: true,
    });
  });

  return {
    totalRows: rawRows.length,
    validRows,
    errorRows,
    duplicatesInFileCount,
  };
}
