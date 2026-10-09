import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeWhatsAppNumber } from '@/lib/phone';
import { withTransaction, queryOne } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

const claimSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  whatsappNumber: z.string().trim().min(1, 'WhatsApp number is required').max(30),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check (10 requests per minute per IP)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const rateLimit = checkRateLimit(`claim_${clientIp}`, 10, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many claim requests. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    // 2. Validate input format using Zod
    const body = await req.json().catch(() => ({}));
    const parseResult = claimSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_INPUT',
          message: 'Invalid input. Please provide a valid name and WhatsApp number.',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, whatsappNumber } = parseResult.data;

    // 3. Normalize WhatsApp phone number
    const normalizedPhone = normalizeWhatsAppNumber(whatsappNumber);
    if (!normalizedPhone) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_PHONE_FORMAT',
          message: 'Please enter a valid WhatsApp phone number (e.g. 03001234567 or +923001234567).',
        },
        { status: 400 }
      );
    }

    // 4. Verify attendee registration in DB
    const attendee = await queryOne<{ id: string; name: string; whatsapp_number: string }>(
      `SELECT id, name, whatsapp_number FROM attendees WHERE whatsapp_number = $1`,
      [normalizedPhone]
    );

    if (!attendee) {
      return NextResponse.json(
        {
          success: false,
          code: 'NOT_REGISTERED',
          message: 'This WhatsApp number is not registered for Hacktoberfest Islamabad.',
        },
        { status: 404 }
      );
    }

    // Optional subtle check: name similarity (for organizer verification warning/log, but phone is canonical)
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // 5. Execute Atomic Claim Transaction
    const claimResult = await withTransaction(async (tx) => {
      // Check if attendee already claimed a voucher
      const existingVoucher = await tx.queryOne<{ redeem_url: string; claimed_at: string }>(
        `SELECT redeem_url, claimed_at FROM vouchers WHERE claimed_by = $1`,
        [attendee.id]
      );

      if (existingVoucher) {
        return {
          alreadyClaimed: true,
          redeemUrl: existingVoucher.redeem_url,
          claimedAt: existingVoucher.claimed_at,
        };
      }

      // Lock and select exactly one available voucher atomically (FOR UPDATE SKIP LOCKED)
      const availableVoucher = await tx.queryOne<{ id: string; redeem_url: string }>(
        `SELECT id, redeem_url FROM vouchers WHERE status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED`
      );

      if (!availableVoucher) {
        return {
          exhausted: true,
        };
      }

      // Update voucher state
      await tx.query(
        `UPDATE vouchers SET status = 'claimed', claimed_by = $1, claimed_at = NOW() WHERE id = $2`,
        [attendee.id, availableVoucher.id]
      );

      // Create claim audit record
      await tx.query(
        `INSERT INTO claims (attendee_id, voucher_id, claimed_at, ip_address, user_agent) VALUES ($1, $2, NOW(), $3, $4)`,
        [attendee.id, availableVoucher.id, clientIp, userAgent]
      );

      return {
        alreadyClaimed: false,
        exhausted: false,
        redeemUrl: availableVoucher.redeem_url,
      };
    });

    // 6. Formulate Response
    if (claimResult.alreadyClaimed) {
      return NextResponse.json({
        success: true,
        alreadyClaimed: true,
        redeemUrl: claimResult.redeemUrl,
        message: 'You have already claimed your Kiro voucher. Here is your redemption link:',
      });
    }

    if (claimResult.exhausted) {
      return NextResponse.json(
        {
          success: false,
          code: 'VOUCHERS_EXHAUSTED',
          message: 'All available Kiro vouchers have already been claimed.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyClaimed: false,
      redeemUrl: claimResult.redeemUrl,
      message: 'Congratulations! Your Kiro voucher has been successfully issued.',
    });

  } catch (error: any) {
    console.error('Voucher claim error:', error);

    // Check for PostgreSQL unique constraint violation (e.g., concurrent duplicate claim attempt)
    if (error.code === '23505') {
      // Fetch the existing voucher for this user if concurrent request won
      try {
        const body = await req.json().catch(() => ({}));
        const normalizedPhone = normalizeWhatsAppNumber(body.whatsappNumber);
        if (normalizedPhone) {
          const attendee = await queryOne<{ id: string }>(
            `SELECT id FROM attendees WHERE whatsapp_number = $1`,
            [normalizedPhone]
          );
          if (attendee) {
            const voucher = await queryOne<{ redeem_url: string }>(
              `SELECT redeem_url FROM vouchers WHERE claimed_by = $1`,
              [attendee.id]
            );
            if (voucher) {
              return NextResponse.json({
                success: true,
                alreadyClaimed: true,
                redeemUrl: voucher.redeem_url,
                message: 'You have already claimed your Kiro voucher.',
              });
            }
          }
        }
      } catch (e) {
        // Fallback to error response
      }
    }

    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing your claim request. Please try again.',
      },
      { status: 500 }
    );
  }
}
