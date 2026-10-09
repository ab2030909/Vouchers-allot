import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const isAuthorized = await verifyAdminSession();
  if (!isAuthorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const search = (searchParams.get('search') || '').trim();

    // 1. Fetch metrics
    const statsResult = await queryOne<{
      total_attendees: string;
      total_vouchers: string;
      claimed_vouchers: string;
      remaining_vouchers: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM attendees) AS total_attendees,
        (SELECT COUNT(*) FROM vouchers) AS total_vouchers,
        (SELECT COUNT(*) FROM vouchers WHERE status = 'claimed') AS claimed_vouchers,
        (SELECT COUNT(*) FROM vouchers WHERE status = 'available') AS remaining_vouchers
    `);

    const totalAttendees = parseInt(statsResult?.total_attendees || '0', 10);
    const totalVouchers = parseInt(statsResult?.total_vouchers || '0', 10);
    const claimedVouchers = parseInt(statsResult?.claimed_vouchers || '0', 10);
    const remainingVouchers = parseInt(statsResult?.remaining_vouchers || '0', 10);
    const eligibleUnclaimedAttendees = Math.max(0, totalAttendees - claimedVouchers);

    // 2. Fetch claim history with search
    let claimsQuery = `
      SELECT
        c.id AS claim_id,
        c.claimed_at,
        c.ip_address,
        a.id AS attendee_id,
        a.name AS attendee_name,
        a.whatsapp_number,
        v.id AS voucher_id,
        v.redeem_url
      FROM claims c
      JOIN attendees a ON c.attendee_id = a.id
      JOIN vouchers v ON c.voucher_id = v.id
    `;

    const params: any[] = [];
    if (search) {
      claimsQuery += ` WHERE a.name ILIKE $1 OR a.whatsapp_number LIKE $1 OR v.redeem_url ILIKE $1`;
      params.push(`%${search}%`);
    }

    claimsQuery += ` ORDER BY c.claimed_at DESC LIMIT 200`;

    const claims = await query(claimsQuery, params);

    return NextResponse.json({
      success: true,
      stats: {
        totalAttendees,
        totalVouchers,
        claimedVouchers,
        remainingVouchers,
        eligibleUnclaimedAttendees,
      },
      claims,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch dashboard statistics.' },
      { status: 500 }
    );
  }
}
