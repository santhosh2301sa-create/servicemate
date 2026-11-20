import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/database.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../auth.ts';

const router = Router();

router.use(requireAuth, requireRole('admin'));

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required.').max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens.')
    .optional(),
  description: z.string().trim().max(240).optional().default(''),
  sortOrder: z.number().int().min(0).max(999).optional().default(10),
  isActive: z.boolean().optional().default(true),
});

router.get('/overview', (_req, res) => {
  const db = getDb();

  const stats = {
    totalUsers: (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count,
    totalProviders: (db.prepare('SELECT COUNT(*) AS count FROM provider_profiles').get() as { count: number }).count,
    activeCategories: (db.prepare('SELECT COUNT(*) AS count FROM categories WHERE is_active = 1').get() as { count: number }).count,
    totalBookings: (db.prepare('SELECT COUNT(*) AS count FROM bookings').get() as { count: number }).count,
    activeBookings: (
      db.prepare("SELECT COUNT(*) AS count FROM bookings WHERE status IN ('pending', 'confirmed')").get() as { count: number }
    ).count,
  };

  const users = db
    .prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC')
    .all();

  const providers = db
    .prepare(`
      SELECT
        p.*,
        u.email AS user_email,
        u.is_active AS user_active,
        COUNT(DISTINCT s.id) AS service_count,
        COUNT(DISTINCT b.id) AS booking_count
      FROM provider_profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN services s ON s.provider_id = p.id AND s.is_active = 1
      LEFT JOIN bookings b ON b.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.id ASC
    `)
    .all();

  const categories = db
    .prepare(`
      SELECT c.*, COUNT(DISTINCT s.id) AS service_count
      FROM categories c
      LEFT JOIN services s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `)
    .all();

  const bookings = db
    .prepare(`
      SELECT
        b.*,
        p.display_name AS provider_name,
        p.business_name AS provider_business,
        s.title AS service_title
      FROM bookings b
      JOIN provider_profiles p ON p.id = b.provider_id
      JOIN services s ON s.id = b.service_id
      ORDER BY b.created_at DESC
    `)
    .all();

  res.json({ stats, users, providers, categories, bookings });
});

router.patch('/users/:id', (req: AuthenticatedRequest, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: 'Invalid user ID.' });
    return;
  }

  if (userId === req.user!.id) {
    res.status(400).json({ error: 'You cannot deactivate your own active admin account.' });
    return;
  }

  const isActive = Boolean(req.body?.isActive);
  const db = getDb();
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, userId);
  const updated = db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE id = ?').get(userId);
  res.json({ user: updated });
});

router.patch('/providers/:id', (req, res) => {
  const providerId = Number(req.params.id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    res.status(400).json({ error: 'Invalid provider ID.' });
    return;
  }

  const isActive = Boolean(req.body?.isActive);
  const db = getDb();
  const existing = db.prepare('SELECT id FROM provider_profiles WHERE id = ?').get(providerId);
  if (!existing) {
    res.status(404).json({ error: 'Provider profile not found.' });
    return;
  }

  db.prepare("UPDATE provider_profiles SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
    isActive ? 1 : 0,
    providerId
  );
  const updated = db.prepare('SELECT * FROM provider_profiles WHERE id = ?').get(providerId);
  res.json({ provider: updated });
});

router.post('/categories', (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category data.' });
    return;
  }

  const d = parsed.data;
  const slug =
    d.slug ||
    d.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const db = getDb();
  const dup = db.prepare('SELECT id FROM categories WHERE slug = ? OR name = ?').get(slug, d.name);
  if (dup) {
    res.status(409).json({ error: 'A category with that name or slug already exists.' });
    return;
  }

  const info = db
    .prepare('INSERT INTO categories (slug, name, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)')
    .run(slug, d.name, d.description, d.sortOrder, d.isActive ? 1 : 0);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ category });
});

router.put('/categories/:id', (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    res.status(400).json({ error: 'Invalid category ID.' });
    return;
  }

  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid category data.' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!existing) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  const d = parsed.data;
  db.prepare('UPDATE categories SET name = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?').run(
    d.name,
    d.description,
    d.sortOrder,
    d.isActive ? 1 : 0,
    categoryId
  );

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  res.json({ category: updated });
});

export default router;
