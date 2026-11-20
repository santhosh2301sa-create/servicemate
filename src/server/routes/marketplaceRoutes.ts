import { Router } from 'express';
import { getDb } from '../../db/database.ts';

const router = Router();

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

router.get('/categories', (_req, res) => {
  const db = getDb();
  const categories = db
    .prepare(`
      SELECT
        c.id,
        c.slug,
        c.name,
        c.description,
        c.sort_order,
        COUNT(DISTINCT CASE WHEN p.is_active = 1 AND s.is_active = 1 THEN p.id END) AS provider_count,
        COUNT(DISTINCT CASE WHEN p.is_active = 1 AND s.is_active = 1 THEN s.id END) AS service_count
      FROM categories c
      LEFT JOIN services s ON s.category_id = c.id
      LEFT JOIN provider_profiles p ON p.id = s.provider_id
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `)
    .all();

  res.json({ categories });
});

router.get('/providers', (req, res) => {
  const db = getDb();
  const today = todayIso();

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const mode = typeof req.query.mode === 'string' ? req.query.mode.trim() : '';
  const availableDate = typeof req.query.availableDate === 'string' ? req.query.availableDate.trim() : '';
  const availableOnly = req.query.availableOnly === 'true';
  const maxPriceDollars = req.query.maxPrice ? Number(req.query.maxPrice) : NaN;
  const minRating = req.query.minRating ? Number(req.query.minRating) : NaN;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'rating';

  const whereClauses: string[] = ['p.is_active = 1', 'u.is_active = 1'];
  const params: Array<string | number> = [];

  if (q) {
    const pattern = `%${q}%`;
    whereClauses.push(`(
      p.display_name LIKE ?
      OR p.business_name LIKE ?
      OR p.headline LIKE ?
      OR p.bio LIKE ?
      OR p.city LIKE ?
      OR p.service_area LIKE ?
      OR EXISTS (
        SELECT 1 FROM services s2
        JOIN categories c2 ON c2.id = s2.category_id
        WHERE s2.provider_id = p.id AND s2.is_active = 1
          AND (s2.title LIKE ? OR s2.description LIKE ? OR c2.name LIKE ?)
      )
    )`);
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  if (location) {
    const locPattern = `%${location}%`;
    whereClauses.push('(p.city LIKE ? OR p.service_area LIKE ?)');
    params.push(locPattern, locPattern);
  }

  if (category && category !== 'all') {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM services s_cat
      JOIN categories c_cat ON c_cat.id = s_cat.category_id
      WHERE s_cat.provider_id = p.id AND s_cat.is_active = 1 AND c_cat.is_active = 1
        AND (c_cat.slug = ? OR CAST(c_cat.id AS TEXT) = ?)
    )`);
    params.push(category, category);
  }

  if (mode === 'in_person' || mode === 'remote') {
    whereClauses.push(`(
      p.service_mode = ? OR p.service_mode = 'both'
      OR EXISTS (
        SELECT 1 FROM services s_mode
        WHERE s_mode.provider_id = p.id AND s_mode.is_active = 1
          AND (s_mode.service_mode = ? OR s_mode.service_mode = 'both')
      )
    )`);
    params.push(mode, mode);
  }

  if (!Number.isNaN(maxPriceDollars) && maxPriceDollars > 0) {
    const maxCents = Math.round(maxPriceDollars * 100);
    whereClauses.push(`EXISTS (
      SELECT 1 FROM services s_price
      WHERE s_price.provider_id = p.id AND s_price.is_active = 1 AND s_price.price_cents <= ?
    )`);
    params.push(maxCents);
  }

  if (availableDate && /^\d{4}-\d{2}-\d{2}$/.test(availableDate)) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM availability_slots av_d
      WHERE av_d.provider_id = p.id AND av_d.slot_date = ?
        AND av_d.is_booked = 0 AND av_d.is_blocked = 0
    )`);
    params.push(availableDate);
  } else if (availableOnly) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM availability_slots av_any
      WHERE av_any.provider_id = p.id AND av_any.slot_date >= ?
        AND av_any.is_booked = 0 AND av_any.is_blocked = 0
    )`);
    params.push(today);
  }

  const orderMap: Record<string, string> = {
    rating: 'avg_rating DESC, review_count DESC, p.years_experience DESC',
    price_asc: 'COALESCE(min_price_cents, 99999999) ASC, avg_rating DESC',
    price_desc: 'COALESCE(min_price_cents, 0) DESC, avg_rating DESC',
    experience: 'p.years_experience DESC, avg_rating DESC',
  };
  const orderBy = orderMap[sort] || orderMap.rating;

  const havingClause =
    !Number.isNaN(minRating) && minRating > 0 ? `HAVING COALESCE(AVG(r.rating), 0) >= ?` : '';

  const sql = `
    SELECT
      p.id,
      p.display_name,
      p.business_name,
      p.headline,
      p.bio,
      p.service_area,
      p.city,
      p.service_mode,
      p.years_experience,
      p.avatar_url,
      COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg_rating,
      COUNT(DISTINCT r.id) AS review_count,
      (
        SELECT MIN(s.price_cents)
        FROM services s
        WHERE s.provider_id = p.id AND s.is_active = 1
      ) AS min_price_cents,
      (
        SELECT COUNT(*)
        FROM services s
        WHERE s.provider_id = p.id AND s.is_active = 1
      ) AS service_count,
      (
        SELECT GROUP_CONCAT(DISTINCT c.name)
        FROM services s
        JOIN categories c ON c.id = s.category_id
        WHERE s.provider_id = p.id AND s.is_active = 1
      ) AS category_names,
      (
        SELECT slot_date || ' ' || start_time
        FROM availability_slots av
        WHERE av.provider_id = p.id AND av.slot_date >= ? AND av.is_booked = 0 AND av.is_blocked = 0
        ORDER BY av.slot_date ASC, av.start_time ASC
        LIMIT 1
      ) AS next_available_slot,
      (
        SELECT COUNT(*)
        FROM availability_slots av
        WHERE av.provider_id = p.id AND av.slot_date >= ? AND av.is_booked = 0 AND av.is_blocked = 0
      ) AS open_slot_count
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN reviews r ON r.provider_id = p.id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY p.id
    ${havingClause}
    ORDER BY ${orderBy}
  `;

  const queryParams: Array<string | number> = [today, today, ...params];
  if (!Number.isNaN(minRating) && minRating > 0) {
    queryParams.push(minRating);
  }

  const providers = db.prepare(sql).all(...queryParams);
  res.json({ providers });
});

router.get('/providers/:id', (req, res) => {
  const providerId = Number(req.params.id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    res.status(400).json({ error: 'Invalid provider ID.' });
    return;
  }

  const db = getDb();
  const today = todayIso();

  const provider = db
    .prepare(`
      SELECT
        p.id,
        p.display_name,
        p.business_name,
        p.headline,
        p.bio,
        p.service_area,
        p.city,
        p.service_mode,
        p.years_experience,
        p.avatar_url,
        p.is_active,
        COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg_rating,
        COUNT(DISTINCT r.id) AS review_count
      FROM provider_profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN reviews r ON r.provider_id = p.id
      WHERE p.id = ? AND p.is_active = 1 AND u.is_active = 1
      GROUP BY p.id
    `)
    .get(providerId);

  if (!provider) {
    res.status(404).json({ error: 'Provider not found.' });
    return;
  }

  const services = db
    .prepare(`
      SELECT
        s.id,
        s.provider_id,
        s.category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        s.title,
        s.description,
        s.price_cents,
        s.duration_minutes,
        s.service_mode
      FROM services s
      JOIN categories c ON c.id = s.category_id
      WHERE s.provider_id = ? AND s.is_active = 1 AND c.is_active = 1
      ORDER BY s.price_cents ASC, s.title ASC
    `)
    .all(providerId);

  const slots = db
    .prepare(`
      SELECT id, slot_date, start_time, end_time
      FROM availability_slots
      WHERE provider_id = ? AND slot_date >= ? AND is_booked = 0 AND is_blocked = 0
      ORDER BY slot_date ASC, start_time ASC
    `)
    .all(providerId, today);

  // Public reviews only expose customer first name / display name + rating + comment (no email/phone/address)
  const reviews = db
    .prepare(`
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS customer_name,
        s.title AS service_title
      FROM reviews r
      JOIN users u ON u.id = r.customer_id
      JOIN bookings b ON b.id = r.booking_id
      JOIN services s ON s.id = b.service_id
      WHERE r.provider_id = ?
      ORDER BY r.created_at DESC
    `)
    .all(providerId);

  res.json({ provider, services, slots, reviews });
});

router.get('/providers/:id/availability', (req, res) => {
  const providerId = Number(req.params.id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    res.status(400).json({ error: 'Invalid provider ID.' });
    return;
  }

  const db = getDb();
  const today = todayIso();
  const dateFilter = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : null;

  const slots = dateFilter
    ? db
        .prepare(`
          SELECT id, slot_date, start_time, end_time
          FROM availability_slots
          WHERE provider_id = ? AND slot_date = ? AND is_booked = 0 AND is_blocked = 0
          ORDER BY start_time ASC
        `)
        .all(providerId, dateFilter)
    : db
        .prepare(`
          SELECT id, slot_date, start_time, end_time
          FROM availability_slots
          WHERE provider_id = ? AND slot_date >= ? AND is_booked = 0 AND is_blocked = 0
          ORDER BY slot_date ASC, start_time ASC
        `)
        .all(providerId, today);

  res.json({ slots });
});

export default router;
