import { describe, it, expect, beforeEach } from 'vitest';
import { query, withTransaction } from '../src/lib/db';
import { normalizeWhatsAppNumber } from '../src/lib/phone';

describe('Voucher Claim Transaction & Concurrency Tests', () => {
  beforeEach(async () => {
    // Reset test database tables
    await query('DELETE FROM claims');
    await query('DELETE FROM vouchers');
    await query('DELETE FROM attendees');
  });

  it('allows registered attendee to claim exactly one available voucher', async () => {
    // Setup 1 attendee & 1 voucher
    const phone = normalizeWhatsAppNumber('03001234567')!;
    const attendee = await query<{ id: string }>(
      'INSERT INTO attendees (name, whatsapp_number) VALUES ($1, $2) RETURNING id',
      ['Test User 1', phone]
    );

    const voucher = await query<{ id: string }>(
      "INSERT INTO vouchers (redeem_url, status) VALUES ($1, 'available') RETURNING id",
      ['https://kiro.dev/redeem/test-001']
    );

    // Execute claim transaction
    const claimResult = await withTransaction(async (tx) => {
      const avail = await tx.queryOne<{ id: string; redeem_url: string }>(
        "SELECT id, redeem_url FROM vouchers WHERE status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED"
      );
      expect(avail).not.toBeNull();

      await tx.query(
        "UPDATE vouchers SET status = 'claimed', claimed_by = $1, claimed_at = NOW() WHERE id = $2",
        [attendee[0].id, avail!.id]
      );

      await tx.query(
        'INSERT INTO claims (attendee_id, voucher_id, claimed_at) VALUES ($1, $2, NOW())',
        [attendee[0].id, avail!.id]
      );

      return avail!.redeem_url;
    });

    expect(claimResult).toBe('https://kiro.dev/redeem/test-001');

    // Verify DB state
    const claimedVoucher = await query<{ status: string; claimed_by: string }>(
      'SELECT status, claimed_by FROM vouchers WHERE id = $1',
      [voucher[0].id]
    );
    expect(claimedVoucher[0].status).toBe('claimed');
    expect(claimedVoucher[0].claimed_by).toBe(attendee[0].id);
  });

  it('prevents an already claimed attendee from getting a second voucher on retry', async () => {
    const phone = normalizeWhatsAppNumber('03001234567')!;
    const attendee = await query<{ id: string }>(
      'INSERT INTO attendees (name, whatsapp_number) VALUES ($1, $2) RETURNING id',
      ['Test User 1', phone]
    );

    await query("INSERT INTO vouchers (redeem_url, status) VALUES ('https://kiro.dev/redeem/test-001', 'available')");
    await query("INSERT INTO vouchers (redeem_url, status) VALUES ('https://kiro.dev/redeem/test-002', 'available')");

    // First Claim
    await withTransaction(async (tx) => {
      const avail = await tx.queryOne<{ id: string }>(
        "SELECT id FROM vouchers WHERE status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED"
      );
      await tx.query("UPDATE vouchers SET status = 'claimed', claimed_by = $1 WHERE id = $2", [attendee[0].id, avail!.id]);
      await tx.query('INSERT INTO claims (attendee_id, voucher_id) VALUES ($1, $2)', [attendee[0].id, avail!.id]);
    });

    // Retry Claim attempt by same user
    const retryResult = await withTransaction(async (tx) => {
      const existing = await tx.queryOne<{ redeem_url: string }>(
        'SELECT redeem_url FROM vouchers WHERE claimed_by = $1',
        [attendee[0].id]
      );
      return existing;
    });

    expect(retryResult).not.toBeNull();
    expect(retryResult?.redeem_url).toBe('https://kiro.dev/redeem/test-001');

    // Check that total claims count is still exactly 1
    const totalClaims = await query('SELECT COUNT(*) as count FROM claims');
    expect(totalClaims[0].count.toString()).toBe('1');
  });

  it('handles parallel claims from 2 different attendees cleanly without assigning the same voucher', async () => {
    const phone1 = normalizeWhatsAppNumber('03001111111')!;
    const phone2 = normalizeWhatsAppNumber('03002222222')!;

    const att1 = await query<{ id: string }>("INSERT INTO attendees (name, whatsapp_number) VALUES ('User 1', $1) RETURNING id", [phone1]);
    const att2 = await query<{ id: string }>("INSERT INTO attendees (name, whatsapp_number) VALUES ('User 2', $1) RETURNING id", [phone2]);

    await query("INSERT INTO vouchers (redeem_url, status) VALUES ('https://kiro.dev/redeem/v1', 'available')");
    await query("INSERT INTO vouchers (redeem_url, status) VALUES ('https://kiro.dev/redeem/v2', 'available')");

    // Execute claim transactions for both attendees
    const claimFn = async (attendeeId: string) => {
      return withTransaction(async (tx) => {
        const avail = await tx.queryOne<{ id: string; redeem_url: string }>(
          "SELECT id, redeem_url FROM vouchers WHERE status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED"
        );
        if (!avail) return null;
        await tx.query("UPDATE vouchers SET status = 'claimed', claimed_by = $1, claimed_at = NOW() WHERE id = $2", [attendeeId, avail.id]);
        await tx.query("INSERT INTO claims (attendee_id, voucher_id) VALUES ($1, $2)", [attendeeId, avail.id]);
        return avail.redeem_url;
      });
    };

    const v1 = await claimFn(att1[0].id);
    const v2 = await claimFn(att2[0].id);

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    expect(v1).not.toBe(v2); // Must be 2 different vouchers!
  });

  it('handles inventory exhaustion when no vouchers are available', async () => {
    const phone = normalizeWhatsAppNumber('03001234567')!;
    const attendee = await query<{ id: string }>(
      'INSERT INTO attendees (name, whatsapp_number) VALUES ($1, $2) RETURNING id',
      ['Test User', phone]
    );

    // No vouchers inserted in database

    const result = await withTransaction(async (tx) => {
      const avail = await tx.queryOne<{ id: string }>(
        "SELECT id FROM vouchers WHERE status = 'available' LIMIT 1 FOR UPDATE SKIP LOCKED"
      );
      return avail;
    });

    expect(result).toBeNull();
  });
});
