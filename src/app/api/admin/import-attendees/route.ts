import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { parseAttendeeCSV } from '@/lib/csv';
import { withTransaction, query } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const isAuthorized = await verifyAdminSession();
  if (!isAuthorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let csvText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, message: 'No CSV file uploaded.' }, { status: 400 });
      }
      csvText = await file.text();
    } else {
      const body = await req.json().catch(() => ({}));
      csvText = body.csvText || '';
    }

    if (!csvText.trim()) {
      return NextResponse.json({ success: false, message: 'CSV content is empty.' }, { status: 400 });
    }

    // 1. Parse and validate CSV rows
    const preview = parseAttendeeCSV(csvText);

    if (preview.validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No valid attendee records found in CSV.',
          summary: {
            totalRows: preview.totalRows,
            importedCount: 0,
            skippedCount: 0,
            errors: preview.errorRows,
          },
        },
        { status: 400 }
      );
    }

    // 2. Import into database transactionally
    const importResult = await withTransaction(async (tx) => {
      let importedCount = 0;
      let skippedCount = 0;
      const skippedRows: Array<{ rowNumber: number; phone: string; reason: string }> = [];

      for (const row of preview.validRows) {
        // Use INSERT ON CONFLICT DO NOTHING to detect duplicate registered numbers
        const res = await tx.rawClient.query(
          `INSERT INTO attendees (name, whatsapp_number) VALUES ($1, $2) ON CONFLICT (whatsapp_number) DO NOTHING`,
          [row.name, row.normalizedPhone]
        );

        if ((res.rowCount ?? 0) > 0) {
          importedCount++;
        } else {
          skippedCount++;
          skippedRows.push({
            rowNumber: row.rowNumber,
            phone: row.normalizedPhone!,
            reason: 'Phone number already exists in database.',
          });
        }
      }

      return { importedCount, skippedCount, skippedRows };
    });

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    await recordAuditLog('ATTENDEES_CSV_IMPORTED', {
      totalRows: preview.totalRows,
      importedCount: importResult.importedCount,
      skippedCount: importResult.skippedCount,
      errorCount: preview.errorRows.length,
    }, clientIp);

    return NextResponse.json({
      success: true,
      message: `Attendee CSV import finished. ${importResult.importedCount} imported, ${importResult.skippedCount} skipped.`,
      summary: {
        totalRows: preview.totalRows,
        importedCount: importResult.importedCount,
        skippedCount: importResult.skippedCount,
        duplicatesInFileCount: preview.duplicatesInFileCount,
        skippedRows: importResult.skippedRows,
        validationErrors: preview.errorRows,
      },
    });

  } catch (error) {
    console.error('Attendee CSV import error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during attendee CSV import.' },
      { status: 500 }
    );
  }
}
