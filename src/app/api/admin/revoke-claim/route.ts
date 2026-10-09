import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { withTransaction, queryOne } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const isAuthorized = await verifyAdminSession();
  if (!isAuthorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { claimId, reason } = await req.json().catch(() => ({}));
    if (!claimId) {
      return NextResponse.json({ success: false, message: 'Claim ID is required.' }, { status: 400 });
    }

    // 1. Verify claim existence
    const claim = await queryOne<{
      id: string;
      attendee_id: string;
      voucher_id: string;
      attendee_name: string;
      whatsapp_number: string;
      redeem_url: string;
    }>(
      `
      SELECT
        c.id,
        c.attendee_id,
        c.voucher_id,
        a.name AS attendee_name,
        a.whatsapp_number,
        v.redeem_url
      FROM claims c
      JOIN attendees a ON c.attendee_id = a.id
      JOIN vouchers v ON c.voucher_id = v.id
      WHERE c.id = $1
    `,
      [claimId]
    );

    if (!claim) {
      return NextResponse.json({ success: false, message: 'Claim record not found.' }, { status: 404 });
    }

    // 2. Perform revocation transactionally
    await withTransaction(async (tx) => {
      // Delete claim record
      await tx.query(`DELETE FROM claims WHERE id = $1`, [claim.id]);

      // Reset voucher to available
      await tx.query(
        `UPDATE vouchers SET status = 'available', claimed_by = NULL, claimed_at = NULL WHERE id = $1`,
        [claim.voucher_id]
      );
    });

    // 3. Record Audit Log
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    await recordAuditLog(
      'CLAIM_REVOKED',
      {
        claimId: claim.id,
        attendeeId: claim.attendee_id,
        attendeeName: claim.attendee_name,
        whatsappNumber: claim.whatsapp_number,
        voucherId: claim.voucher_id,
        reason: reason || 'Administrative revocation',
      },
      clientIp
    );

    return NextResponse.json({
      success: true,
      message: `Claim for ${claim.attendee_name} (${claim.whatsapp_number}) successfully revoked. Voucher has been returned to available inventory.`,
    });
  } catch (error) {
    console.error('Revoke claim error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to revoke claim.' },
      { status: 500 }
    );
  }
}
