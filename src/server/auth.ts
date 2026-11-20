import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.ts';

export type UserRole = 'customer' | 'provider' | 'admin';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : EPHEMERAL_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hexHash] = parts;
  if (!salt || !hexHash) return false;

  const expected = Buffer.from(hexHash, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function verifyTimingSafeString(input: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

interface TokenPayload {
  uid: number;
  role: UserRole;
  exp: number;
}

export function signAuthToken(user: { id: number; role: UserRole }, ttlSeconds = 60 * 60 * 24 * 7): string {
  const payload: TokenPayload = {
    uid: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    if (!decoded || typeof decoded.uid !== 'number' || typeof decoded.exp !== 'number') {
      return null;
    }
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function extractBearerUser(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload) return null;

  const db = getDb();
  const user = db
    .prepare('SELECT id, name, email, phone, role, is_active FROM users WHERE id = ?')
    .get(payload.uid) as AuthUser | undefined;

  if (!user || user.is_active !== 1) {
    return null;
  }
  return user;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  req.user = user;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to access this resource.' });
      return;
    }
    next();
  };
}
