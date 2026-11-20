import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/database.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../auth.ts';

const router = Router();

router.use(requireAuth, requireRole('provider', 'admin'));

const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Display name is required.').max(80),
  businessName: z.string().trim().min(2, 'Business name is required.').max(100),
  headline: z.string().trim().min(5, 'Short headline is required.').max(140),
  bio: z.string().trim().min(10, 'Bio must be at least 10 characters.').max(1200),
  serviceArea: z.string().trim().min(2, 'Service area is required.').max(180),
  city: z.string().trim().min(2, 'City is required.').max(80),
  serviceMode: z.enum(['in_person', 'remote', 'both']),
  yearsExperience: z.number().int().min(0).max(70),
});

const serviceSchema = z.object({
  categoryId: z.number().int().positive('Please select a category.'),
  title: z.string().trim().min(3, 'Service title must be at least 3 characters.').max(100),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(600),
  priceDollars: z.number().min(50, 'Price must be at least ₹50.').max(200000),
  durationMinutes: z.number().int().min(15).max(480),
  serviceMode: z.enum(['in_person', 'remote', 'both']),
});

const createSlotsSchema = z.object({
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD.'),
  windows: z
    .array(
      z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM.'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM.'),
      })
    )
    .min(1, 'At least one time slot is required.'),
});

function getOrCreateProviderProfile(userId: number) {
  const db = getDb();
  let profile = db.prepare('SELECT * FROM provider_profiles WHERE user_id = ?').get(userId) as
    | { id: number; [key: string]: unknown }
    | undefined;

  if (!profile) {
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string };
    const info = db
      .prepare(`
        INSERT INTO provider_profiles (
          user_id, display_name, business_name, headline, bio,
          service_area, city, service_mode, years_experience, avatar_url, is_active
        ) VALUES (?, ?, ?, 'Local service specialist', 'ServiceMate provider profile.', 'Bengaluru Metro', 'Bengaluru, KA', 'in_person', 1, '', 1)
      `)
      .run(userId, user.name, `${user.name} Services`);
    profile = db.prepare('SELECT * FROM provider_profiles WHERE id = ?').get(Number(info.lastInsertRowid)) as {
      id: number;
      [key: string]: unknown;
    };
  }
  return profile;
}

router.get('/dashboard', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);

  const services = db
    .prepare(`
      SELECT s.*, c.name AS category_name
      FROM services s
      JOIN categories c ON c.id = s.category_id
      WHERE s.provider_id = ?
      ORDER BY s.is_active DESC, s.id DESC
    `)
    .all(profile.id);

  const slots = db
    .prepare(`
      SELECT
        av.*,
        b.reference_code AS booking_reference,
        b.status AS booking_status
      FROM availability_slots av
      LEFT JOIN bookings b ON b.slot_id = av.id AND b.status IN ('pending', 'confirmed')
      WHERE av.provider_id = ?
      ORDER BY av.slot_date ASC, av.start_time ASC
    `)
    .all(profile.id);

  const bookings = db
    .prepare(`
      SELECT
        b.*,
        s.title AS service_title,
        s.duration_minutes AS service_duration
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.provider_id = ?
      ORDER BY b.booking_date DESC, b.start_time DESC, b.id DESC
    `)
    .all(profile.id);

  res.json({ profile, services, slots, bookings });
});

router.put('/profile', (req: AuthenticatedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile data.' });
    return;
  }

  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);
  const d = parsed.data;

  db.prepare(`
    UPDATE provider_profiles
    SET display_name = ?, business_name = ?, headline = ?, bio = ?,
        service_area = ?, city = ?, service_mode = ?, years_experience = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(d.displayName, d.businessName, d.headline, d.bio, d.serviceArea, d.city, d.serviceMode, d.yearsExperience, profile.id);

  const updated = db.prepare('SELECT * FROM provider_profiles WHERE id = ?').get(profile.id);
  res.json({ profile: updated });
});

router.post('/services', (req: AuthenticatedRequest, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid service details.' });
    return;
  }

  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);
  const d = parsed.data;

  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND is_active = 1').get(d.categoryId);
  if (!category) {
    res.status(400).json({ error: 'Selected category is invalid or inactive.' });
    return;
  }

  const info = db
    .prepare(`
      INSERT INTO services (provider_id, category_id, title, description, price_cents, duration_minutes, service_mode, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `)
    .run(profile.id, d.categoryId, d.title, d.description, Math.round(d.priceDollars * 100), d.durationMinutes, d.serviceMode);

  const service = db
    .prepare(`
      SELECT s.*, c.name AS category_name
      FROM services s
      JOIN categories c ON c.id = s.category_id
      WHERE s.id = ?
    `)
    .get(Number(info.lastInsertRowid));

  res.status(201).json({ service });
});

router.put('/services/:id', (req: AuthenticatedRequest, res) => {
  const serviceId = Number(req.params.id);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    res.status(400).json({ error: 'Invalid service ID.' });
    return;
  }

  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid service details.' });
    return;
  }

  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);
  const existing = db.prepare('SELECT id FROM services WHERE id = ? AND provider_id = ?').get(serviceId, profile.id);
  if (!existing) {
    res.status(404).json({ error: 'Service not found for your provider account.' });
    return;
  }

  const d = parsed.data;
  db.prepare(`
    UPDATE services
    SET category_id = ?, title = ?, description = ?, price_cents = ?, duration_minutes = ?, service_mode = ?
    WHERE id = ? AND provider_id = ?
  `).run(d.categoryId, d.title, d.description, Math.round(d.priceDollars * 100), d.durationMinutes, d.serviceMode, serviceId, profile.id);

  const updated = db
    .prepare('SELECT s.*, c.name AS category_name FROM services s JOIN categories c ON c.id = s.category_id WHERE s.id = ?')
    .get(serviceId);

  res.json({ service: updated });
});

router.delete('/services/:id', (req: AuthenticatedRequest, res) => {
  const serviceId = Number(req.params.id);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    res.status(400).json({ error: 'Invalid service ID.' });
    return;
  }

  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);

  const existing = db.prepare('SELECT id FROM services WHERE id = ? AND provider_id = ?').get(serviceId, profile.id);
  if (!existing) {
    res.status(404).json({ error: 'Service not found for your provider account.' });
    return;
  }

  // Soft-deactivate if referenced by existing bookings so booking history stays intact
  const usedInBooking = db.prepare('SELECT id FROM bookings WHERE service_id = ? LIMIT 1').get(serviceId);
  if (usedInBooking) {
    db.prepare('UPDATE services SET is_active = 0 WHERE id = ? AND provider_id = ?').run(serviceId, profile.id);
    res.json({ deleted: true, softDeactivated: true });
    return;
  }

  db.prepare('DELETE FROM services WHERE id = ? AND provider_id = ?').run(serviceId, profile.id);
  res.json({ deleted: true, softDeactivated: false });
});

router.post('/availability', (req: AuthenticatedRequest, res) => {
  const parsed = createSlotsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid availability input.' });
    return;
  }

  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);
  const { slotDate, windows } = parsed.data;

  for (const w of windows) {
    if (w.endTime <= w.startTime) {
      res.status(400).json({ error: `End time (${w.endTime}) must be after start time (${w.startTime}).` });
      return;
    }
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO availability_slots (provider_id, slot_date, start_time, end_time, is_booked, is_blocked)
    VALUES (?, ?, ?, ?, 0, 0)
  `);

  let addedCount = 0;
  const tx = db.transaction(() => {
    for (const w of windows) {
      const info = insertStmt.run(profile.id, slotDate, w.startTime, w.endTime);
      addedCount += info.changes;
    }
  });
  tx();

  const slots = db
    .prepare('SELECT * FROM availability_slots WHERE provider_id = ? AND slot_date = ? ORDER BY start_time ASC')
    .all(profile.id, slotDate);

  res.status(201).json({ addedCount, slots });
});

router.patch('/availability/:id', (req: AuthenticatedRequest, res) => {
  const slotId = Number(req.params.id);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    res.status(400).json({ error: 'Invalid slot ID.' });
    return;
  }

  const isBlocked = Boolean(req.body?.isBlocked);
  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);

  const slot = db
    .prepare('SELECT * FROM availability_slots WHERE id = ? AND provider_id = ?')
    .get(slotId, profile.id) as { id: number; is_booked: number } | undefined;

  if (!slot) {
    res.status(404).json({ error: 'Time slot not found.' });
    return;
  }

  if (slot.is_booked === 1) {
    res.status(409).json({ error: 'Booked time slots cannot be modified directly. Manage the booking instead.' });
    return;
  }

  db.prepare('UPDATE availability_slots SET is_blocked = ? WHERE id = ?').run(isBlocked ? 1 : 0, slotId);
  const updated = db.prepare('SELECT * FROM availability_slots WHERE id = ?').get(slotId);
  res.json({ slot: updated });
});

router.delete('/availability/:id', (req: AuthenticatedRequest, res) => {
  const slotId = Number(req.params.id);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    res.status(400).json({ error: 'Invalid slot ID.' });
    return;
  }

  const db = getDb();
  const profile = getOrCreateProviderProfile(req.user!.id);
  const slot = db
    .prepare('SELECT * FROM availability_slots WHERE id = ? AND provider_id = ?')
    .get(slotId, profile.id) as { id: number; is_booked: number } | undefined;

  if (!slot) {
    res.status(404).json({ error: 'Time slot not found.' });
    return;
  }

  if (slot.is_booked === 1) {
    res.status(409).json({ error: 'Cannot delete a time slot with an active booking.' });
    return;
  }

  db.prepare('DELETE FROM availability_slots WHERE id = ? AND provider_id = ?').run(slotId, profile.id);
  res.json({ deleted: true });
});

export default router;
