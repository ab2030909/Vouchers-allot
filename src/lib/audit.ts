import { query } from './db';

export async function recordAuditLog(
  action: string,
  details: Record<string, any> = {},
  ipAddress?: string | null
): Promise<void> {
  try {
    // Sanitize any potential sensitive data before logging
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.token;
    delete safeDetails.sessionSecret;

    await query(
      `INSERT INTO audit_logs (action, details, ip_address) VALUES ($1, $2, $3)`,
      [action, JSON.stringify(safeDetails), ipAddress || null]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
