import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, createAdminSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { recordAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    
    // Rate limit login attempts (5 attempts per minute per IP)
    const rateLimit = checkRateLimit(`login_${clientIp}`, 5, 60 * 1000);
    if (!rateLimit.success) {
      await recordAuditLog('ADMIN_LOGIN_RATE_LIMITED', { ip: clientIp }, clientIp);
      return NextResponse.json(
        { success: false, message: 'Too many failed login attempts. Please try again in 1 minute.' },
        { status: 429 }
      );
    }

    const { password } = await req.json().catch(() => ({}));
    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Password is required.' },
        { status: 400 }
      );
    }

    const isValid = verifyAdminPassword(password);
    if (!isValid) {
      await recordAuditLog('ADMIN_LOGIN_FAILED', { ip: clientIp }, clientIp);
      return NextResponse.json(
        { success: false, message: 'Invalid admin password.' },
        { status: 401 }
      );
    }

    // Create session and set cookie
    await createAdminSession();
    await recordAuditLog('ADMIN_LOGIN_SUCCESS', { ip: clientIp }, clientIp);

    return NextResponse.json({
      success: true,
      message: 'Login successful.',
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during login.' },
      { status: 500 }
    );
  }
}
