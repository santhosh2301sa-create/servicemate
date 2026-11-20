import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../auth.ts';

const router = Router();

const createBookingSchema = z.object({
  providerId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  slotId: z.number().int().positive(),
  serviceMode: z.enum(['in_person', 'remote']),
  serviceAddress: z.string().trim().max(240).optional().default(''),
  customerName: z.string().trim().min(2, 'Contact name is required.').max(100),
  customerEmail: z.string().trim().email('Valid contact email is required.').max(120),
  customerPhone: z.string().trim().min(7, 'Phone number is required.').max(30),
  notes: z.string().trim().max(600).optional().default(''),
});

const rescheduleSchema = z.object({
  slotId: z.number().int().positive('Please choose an available time slot.'),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional().default(''),
});

const statusSchema = z.object({
  status: z.enum(['confirmed', 'declined', 'completed']),
  reason: z.string().trim().max(300).optional().default(''),
});

const reviewSchema = z.object({
  bookingId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5, 'Please write a short review (at least 5 characters).').max(800),
});

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateReferenceCode(): string {
  return `SM-${crypto.randomInt(100000, 999999)}`;
}

router.get('/bookings', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;
  const scope = typeof req.query.scope === 'string' ? req.query.scope : '';

  let where = 'b.customer_id = ?';
  const params: Array<string | number> = [user.id];

  if (user.role === 'admin' && scope === 'all') {
    where = '1 = 1';
    params.length = 0;
  } else if (user.role === 'provider' && scope === 'provider') {
    const profile = db
      .prepare('SELECT id FROM provider_profiles WHERE user_id = ?')
      .get(user.id) as { id: number } | undefined;
    if (!profile) {
      res.json({ bookings: [] });
      return;
    }
    where = 'b.provider_id = ?';
    params[0] = profile.id;
  }

  const bookings = db
    .prepare(`
      SELECT
        b.*,
        p.display_name AS provider_name,
        p.business_name AS provider_business,
        p.avatar_url AS provider_avatar,
        p.city AS provider_city,
        s.title AS service_title,
        s.duration_minutes AS service_duration,
        c.name AS category_name,
        r.id AS review_id,
        r.rating AS review_rating,
        r.comment AS review_comment
      FROM bookings b
      JOIN provider_profiles p ON p.id = b.provider_id
      JOIN services s ON s.id = b.service_id
      JOIN categories c ON c.id = s.category_id
      LEFT JOIN reviews r ON r.booking_id = b.id
      WHERE ${where}
      ORDER BY b.booking_date DESC, b.start_time DESC, b.id DESC
    `)
    .all(...params);

  res.json({ bookings });
});

router.post('/bookings', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid booking request.' });
    return;
  }

  const data = parsed.data;
  if (data.serviceMode === 'in_person' && data.serviceAddress.trim().length < 5) {
    res.status(400).json({ error: 'Please enter a complete service street address for an in-person visit.' });
    return;
  }

  const db = getDb();
  const user = req.user!;
  const today = todayIso();

  const createTx = db.transaction(() => {
    const provider = db
      .prepare('SELECT id, user_id, is_active FROM provider_profiles WHERE id = ?')
      .get(data.providerId) as { id: number; user_id: number; is_active: number } | undefined;

    if (!provider || provider.is_active !== 1) {
      return { status: 404, error: 'Selected provider is not currently available.' } as const;
    }

    if (provider.user_id === user.id) {
      return { status: 400, error: 'You cannot book your own provider listing.' } as const;
    }

    const service = db
      .prepare('SELECT id, provider_id, price_cents, service_mode, is_active FROM services WHERE id = ?')
      .get(data.serviceId) as
      | { id: number; provider_id: number; price_cents: number; service_mode: string; is_active: number }
      | undefined;

    if (!service || service.provider_id !== data.providerId || service.is_active !== 1) {
      return { status: 404, error: 'Selected service is not available for this provider.' } as const;
    }

    if (service.service_mode !== 'both' && service.service_mode !== data.serviceMode) {
      return {
        status: 400,
        error: `This service is only offered ${service.service_mode === 'remote' ? 'remotely' : 'in person'}.`,
      } as const;
    }

    const slot = db
      .prepare('SELECT * FROM availability_slots WHERE id = ? AND provider_id = ?')
      .get(data.slotId, data.providerId) as
      | {
          id: number;
          provider_id: number;
          slot_date: string;
          start_time: string;
          end_time: string;
          is_booked: number;
          is_blocked: number;
        }
      | undefined;

    if (!slot) {
      return { status: 404, error: 'Selected time slot could not be found.' } as const;
    }

    if (slot.slot_date < today) {
      return { status: 400, error: 'Cannot book a time slot in the past.' } as const;
    }

    if (slot.is_blocked === 1) {
      return { status: 409, error: 'That time slot has been marked unavailable by the provider.' } as const;
    }

    if (slot.is_booked === 1) {
      return { status: 409, error: 'That time slot was just booked. Please pick another time.' } as const;
    }

    const existingActive = db
      .prepare(
        "SELECT id FROM bookings WHERE provider_id = ? AND booking_date = ? AND start_time = ? AND status IN ('pending', 'confirmed')"
      )
      .get(data.providerId, slot.slot_date, slot.start_time);

    if (existingActive) {
      return { status: 409, error: 'This provider already has an active booking for that date and time.' } as const;
    }

    let referenceCode = generateReferenceCode();
    while (db.prepare('SELECT id FROM bookings WHERE reference_code = ?').get(referenceCode)) {
      referenceCode = generateReferenceCode();
    }

    const slotUpdate = db
      .prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0 AND is_blocked = 0')
      .run(slot.id);

    if (slotUpdate.changes !== 1) {
      return { status: 409, error: 'That time slot is no longer available.' } as const;
    }

    const addressToSave =
      data.serviceMode === 'remote' ? data.serviceAddress.trim() || 'Remote Video Session' : data.serviceAddress.trim();

    const insertResult = db
      .prepare(`
        INSERT INTO bookings (
          reference_code, customer_id, provider_id, service_id, slot_id,
          booking_date, start_time, end_time, service_mode, service_address,
          customer_name, customer_email, customer_phone, notes, total_price_cents, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `)
      .run(
        referenceCode,
        user.id,
        data.providerId,
        service.id,
        slot.id,
        slot.slot_date,
        slot.start_time,
        slot.end_time,
        data.serviceMode,
        addressToSave,
        data.customerName,
        data.customerEmail,
        data.customerPhone,
        data.notes,
        service.price_cents
      );

    const booking = db
      .prepare(`
        SELECT
          b.*,
          p.display_name AS provider_name,
          p.business_name AS provider_business,
          s.title AS service_title,
          s.duration_minutes AS service_duration
        FROM bookings b
        JOIN provider_profiles p ON p.id = b.provider_id
        JOIN services s ON s.id = b.service_id
        WHERE b.id = ?
      `)
      .get(Number(insertResult.lastInsertRowid));

    return { status: 201, booking } as const;
  });

  const outcome = createTx();
  if ('error' in outcome) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  res.status(201).json({ booking: outcome.booking });
});

router.patch('/bookings/:id/reschedule', requireAuth, (req: AuthenticatedRequest, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    res.status(400).json({ error: 'Invalid booking ID.' });
    return;
  }

  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reschedule request.' });
    return;
  }

  const db = getDb();
  const user = req.user!;
  const today = todayIso();

  const rescheduleTx = db.transaction(() => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as
      | {
          id: number;
          customer_id: number;
          provider_id: number;
          slot_id: number | null;
          status: string;
        }
      | undefined;

    if (!booking) {
      return { status: 404, error: 'Booking not found.' } as const;
    }

    if (booking.customer_id !== user.id && user.role !== 'admin') {
      return { status: 403, error: 'You are not authorized to reschedule this booking.' } as const;
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return { status: 400, error: 'Only pending or confirmed bookings can be rescheduled.' } as const;
    }

    const newSlot = db
      .prepare('SELECT * FROM availability_slots WHERE id = ? AND provider_id = ?')
      .get(parsed.data.slotId, booking.provider_id) as
      | {
          id: number;
          slot_date: string;
          start_time: string;
          end_time: string;
          is_booked: number;
          is_blocked: number;
        }
      | undefined;

    if (!newSlot) {
      return { status: 404, error: 'Selected time slot was not found for this provider.' } as const;
    }

    if (newSlot.slot_date < today) {
      return { status: 400, error: 'Cannot reschedule to a past date.' } as const;
    }

    if (newSlot.is_blocked === 1 || newSlot.is_booked === 1) {
      return { status: 409, error: 'That time slot is no longer available.' } as const;
    }

    // Release previous slot first
    if (booking.slot_id) {
      db.prepare('UPDATE availability_slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id);
    }

    const lock = db
      .prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0 AND is_blocked = 0')
      .run(newSlot.id);
    if (lock.changes !== 1) {
      throw new Error('SLOT_RACE');
    }

    db.prepare(`
      UPDATE bookings
      SET slot_id = ?, booking_date = ?, start_time = ?, end_time = ?,
          status = 'pending', updated_at = datetime('now')
      WHERE id = ?
    `).run(newSlot.id, newSlot.slot_date, newSlot.start_time, newSlot.end_time, booking.id);

    const updated = db
      .prepare(`
        SELECT b.*, p.display_name AS provider_name, p.business_name AS provider_business, s.title AS service_title
        FROM bookings b
        JOIN provider_profiles p ON p.id = b.provider_id
        JOIN services s ON s.id = b.service_id
        WHERE b.id = ?
      `)
      .get(booking.id);

    return { status: 200, booking: updated } as const;
  });

  try {
    const outcome = rescheduleTx();
    if ('error' in outcome) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.json({ booking: outcome.booking });
  } catch {
    res.status(409).json({ error: 'Unable to reschedule to that slot; please pick another time.' });
  }
});

router.patch('/bookings/:id/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    res.status(400).json({ error: 'Invalid booking ID.' });
    return;
  }

  const parsed = cancelSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid cancellation request.' });
    return;
  }

  const db = getDb();
  const user = req.user!;

  const cancelTx = db.transaction(() => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as
      | { id: number; customer_id: number; slot_id: number | null; status: string }
      | undefined;

    if (!booking) {
      return { status: 404, error: 'Booking not found.' } as const;
    }

    if (booking.customer_id !== user.id && user.role !== 'admin') {
      return { status: 403, error: 'You are not authorized to cancel this booking.' } as const;
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return { status: 400, error: 'This booking cannot be cancelled in its current state.' } as const;
    }

    if (booking.slot_id) {
      db.prepare('UPDATE availability_slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id);
    }

    db.prepare(`
      UPDATE bookings
      SET status = 'cancelled', cancellation_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(parsed.data.reason || 'Cancelled by customer', booking.id);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    return { status: 200, booking: updated } as const;
  });

  const outcome = cancelTx();
  if ('error' in outcome) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  res.json({ booking: outcome.booking });
});

router.patch('/bookings/:id/status', requireAuth, (req: AuthenticatedRequest, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    res.status(400).json({ error: 'Invalid booking ID.' });
    return;
  }

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid status update.' });
    return;
  }

  const db = getDb();
  const user = req.user!;

  const updateTx = db.transaction(() => {
    const booking = db
      .prepare(`
        SELECT b.*, p.user_id AS provider_user_id
        FROM bookings b
        JOIN provider_profiles p ON p.id = b.provider_id
        WHERE b.id = ?
      `)
      .get(bookingId) as
      | { id: number; slot_id: number | null; status: string; provider_user_id: number }
      | undefined;

    if (!booking) {
      return { status: 404, error: 'Booking not found.' } as const;
    }

    if (booking.provider_user_id !== user.id && user.role !== 'admin') {
      return { status: 403, error: 'Only the assigned provider or an admin can update booking status.' } as const;
    }

    const nextStatus = parsed.data.status;
    if (nextStatus === 'confirmed' && booking.status !== 'pending') {
      return { status: 400, error: 'Only pending bookings can be accepted.' } as const;
    }
    if (nextStatus === 'declined' && !['pending', 'confirmed'].includes(booking.status)) {
      return { status: 400, error: 'Only pending or confirmed bookings can be declined.' } as const;
    }
    if (nextStatus === 'completed' && booking.status !== 'confirmed') {
      return { status: 400, error: 'Only confirmed bookings can be marked completed.' } as const;
    }

    if (nextStatus === 'declined' && booking.slot_id) {
      db.prepare('UPDATE availability_slots SET is_booked = 0 WHERE id = ?').run(booking.slot_id);
    }

    db.prepare(`
      UPDATE bookings
      SET status = ?, cancellation_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      nextStatus,
      nextStatus === 'declined' ? parsed.data.reason || 'Declined by provider' : '',
      booking.id
    );

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    return { status: 200, booking: updated } as const;
  });

  const outcome = updateTx();
  if ('error' in outcome) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  res.json({ booking: outcome.booking });
});

router.post('/reviews', requireAuth, (req: AuthenticatedRequest, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review input.' });
    return;
  }

  const db = getDb();
  const user = req.user!;
  const data = parsed.data;

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(data.bookingId) as
    | { id: number; customer_id: number; provider_id: number; status: string }
    | undefined;

  if (!booking) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }

  if (booking.customer_id !== user.id) {
    res.status(403).json({ error: 'You can only review your own bookings.' });
    return;
  }

  if (booking.status !== 'completed') {
    res.status(400).json({ error: 'Reviews can only be submitted after a booking is completed.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM reviews WHERE booking_id = ?').get(booking.id);
  if (existing) {
    res.status(409).json({ error: 'You have already submitted a review for this booking.' });
    return;
  }

  const info = db
    .prepare('INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(booking.id, user.id, booking.provider_id, data.rating, data.comment);

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ review });
});

export default router;
