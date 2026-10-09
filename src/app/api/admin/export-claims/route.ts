import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { query } from '@/lib/db';
import Papa from 'papaparse';
import { recordAuditLog } from '@/lib/audit';

export async function GET() {
  const isAuthorized = await verifyAdminSession();
  if (!isAuthorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const claims = await query<{
      claim_id: string;
      attendee_name: string;
      whatsapp_number: string;
      redeem_url: string;
      claimed_at: string;
      ip_address: string;
    }>(`
      SELECT
        c.id AS claim_id,
        a.name AS attendee_name,
        a.whatsapp_number,
        v.redeem_url,
        c.claimed_at,
        c.ip_address
      FROM claims c
      JOIN attendees a ON c.attendee_id = a.id
      JOIN vouchers v ON c.voucher_id = v.id
      ORDER BY c.claimed_at DESC
    `);

    const exportRows = claims.map((c) => ({
      'Claim ID': c.claim_id,
      'Attendee Name': c.attendee_name,
      'WhatsApp Number': c.whatsapp_number,
      'Voucher URL': c.redeem_url,
      'Claimed At (UTC)': new Date(c.claimed_at).toISOString(),
      'IP Address': c.ip_address || 'N/A',
    }));

    const csvContent = Papa.unparse(exportRows);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `hacktoberfest_kiro_claims_${timestamp}.csv`;

    await recordAuditLog('CLAIMS_EXPORTED', { totalRecords: claims.length });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate claims CSV export.' },
      { status: 500 }
    );
  }
}
