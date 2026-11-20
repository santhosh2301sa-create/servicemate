import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/database.ts';
import {
  hashPassword,
  verifyPassword,
  verifyTimingSafeString,
  signAuthToken,
  requireAuth,
  type AuthenticatedRequest,
} from '../auth.ts';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(80),
  email: z.string().trim().email('Please enter a valid email address.').max(120),
  phone: z.string().trim().max(30).optional().default(''),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  role: z.enum(['customer', 'provider']).default('customer'),
  businessName: z.string().trim().max(100).optional(),
  city: z.string().trim().max(80).optional(),
  serviceArea: z.string().trim().max(160).optional(),
  serviceMode: z.enum(['in_person', 'remote', 'both']).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const adminClaimSchema = z.object({
  name: z.string().trim().min(2, 'Admin name must be at least 2 characters.').max(80),
  email: z.string().trim().email('Please enter a valid email address.').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
});

const adminLoginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').optional(),
  password: z.string().min(1, 'Password or passcode is required.'),
});

function buildUserResponse(userId: number) {
  const db = getDb();
  const user = db
    .prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE id = ?')
    .get(userId) as {
      id: number;
      name: string;
      email: string;
      phone: string;
      role: 'customer' | 'provider' | 'admin';
      is_active: number;
      created_at: string;
    };

  let providerProfile = null;
  if (user.role === 'provider') {
    providerProfile = db
      .prepare('SELECT * FROM provider_profiles WHERE user_id = ?')
      .get(user.id) ?? null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.created_at,
    providerProfile,
  };
}

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
    return;
  }

  const data = parsed.data;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email.toLowerCase());
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = hashPassword(data.password);

  const createAccount = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO users (name, email, phone, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)')
      .run(data.name, data.email.toLowerCase(), data.phone || '', passwordHash, data.role);

    const userId = Number(info.lastInsertRowid);

    if (data.role === 'provider') {
      db.prepare(`
        INSERT INTO provider_profiles (
          user_id, display_name, business_name, headline, bio,
          service_area, city, service_mode, years_experience, avatar_url, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '', 1)
      `).run(
        userId,
        data.name,
        data.businessName?.trim() || `${data.name} Services`,
        'Local service specialist ready for bookings',
        'New ServiceMate provider profile. Add services and open availability slots to start accepting bookings.',
        data.serviceArea?.trim() || 'Bengaluru Metro',
        data.city?.trim() || 'Bengaluru, KA',
        data.serviceMode || 'in_person'
      );
    }

    return userId;
  });

  const userId = createAccount();
  const token = signAuthToken({ id: userId, role: data.role });
  res.status(201).json({
    token,
    user: buildUserResponse(userId),
  });
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials.' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT id, password_hash, role, is_active FROM users WHERE email = ?')
    .get(parsed.data.email.toLowerCase()) as
    | { id: number; password_hash: string; role: 'customer' | 'provider' | 'admin'; is_active: number }
    | undefined;

  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (row.is_active !== 1) {
    res.status(403).json({ error: 'This account has been deactivated. Contact support.' });
    return;
  }

  const token = signAuthToken({ id: row.id, role: row.role });
  res.json({
    token,
    user: buildUserResponse(row.id),
  });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: buildUserResponse(req.user!.id) });
});

router.get('/admin/status', (_req, res) => {
  const db = getDb();
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: number } | undefined;

  res.json({
    envPasscodeActive: Boolean(envPasscode),
    adminClaimed: Boolean(existingAdmin),
  });
});

router.post('/admin/claim', (req, res) => {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    res.status(403).json({ error: 'Admin access is configured via server environment passcode.' });
    return;
  }

  const parsed = adminClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid admin setup input.' });
    return;
  }

  const db = getDb();
  const claimTx = db.transaction(() => {
    const existingAdmin = db
      .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
      .get() as { id: number } | undefined;
    if (existingAdmin) {
      return { conflict: 'Admin account has already been claimed. Please sign in.' as const };
    }

    const emailTaken = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(parsed.data.email.toLowerCase());
    if (emailTaken) {
      return { conflict: 'That email is already registered to a non-admin account.' as const };
    }

    const hash = hashPassword(parsed.data.password);
    const info = db
      .prepare("INSERT INTO users (name, email, phone, password_hash, role, is_active) VALUES (?, ?, '', ?, 'admin', 1)")
      .run(parsed.data.name, parsed.data.email.toLowerCase(), hash);

    return { userId: Number(info.lastInsertRowid) };
  });

  const outcome = claimTx();
  if ('conflict' in outcome) {
    res.status(403).json({ error: outcome.conflict });
    return;
  }

  const token = signAuthToken({ id: outcome.userId, role: 'admin' });
  res.status(201).json({
    token,
    user: buildUserResponse(outcome.userId),
  });
});

router.post('/admin/login', (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid admin credentials.' });
    return;
  }

  const db = getDb();
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();

  if (envPasscode) {
    if (!verifyTimingSafeString(parsed.data.password, envPasscode)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }

    let adminUser = db
      .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
      .get() as { id: number } | undefined;

    if (!adminUser) {
      const placeholderHash = hashPassword(envPasscode);
      const info = db
        .prepare(
          "INSERT INTO users (name, email, phone, password_hash, role, is_active) VALUES ('Platform Admin', 'admin@servicemate.local', '', ?, 'admin', 1)"
        )
        .run(placeholderHash);
      adminUser = { id: Number(info.lastInsertRowid) };
    }

    const token = signAuthToken({ id: adminUser.id, role: 'admin' });
    res.json({ token, user: buildUserResponse(adminUser.id) });
    return;
  }

  if (!parsed.data.email) {
    res.status(400).json({ error: 'Admin email is required.' });
    return;
  }

  const row = db
    .prepare("SELECT id, password_hash, is_active FROM users WHERE email = ? AND role = 'admin'")
    .get(parsed.data.email.toLowerCase()) as
    | { id: number; password_hash: string; is_active: number }
    | undefined;

  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid admin email or password.' });
    return;
  }

  if (row.is_active !== 1) {
    res.status(403).json({ error: 'Admin account is deactivated.' });
    return;
  }

  const token = signAuthToken({ id: row.id, role: 'admin' });
  res.json({ token, user: buildUserResponse(row.id) });
});

export default router;
