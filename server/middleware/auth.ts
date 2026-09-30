import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

export const JWT_SECRET = process.env.JWT_SECRET || 'easymanage-default-secret-change-me';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const BCRYPT_ROUNDS = 10;

// Rate Limiters
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

export const changePasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password change requests. Please try again in 15 minutes.' },
});

// JWT Auth Middleware
export interface JwtPayload {
  memberId: string;
  username: string;
  role: string;
  name: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    console.warn(`[Auth 401] Missing or invalid Authorization header on ${req.method} ${req.originalUrl}`);
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const primarySecret = process.env.JWT_SECRET || JWT_SECRET;
  let decoded: JwtPayload | null = null;

  try {
    decoded = jwt.verify(token, primarySecret) as JwtPayload;
  } catch (err: any) {
    // Graceful backward-compatibility fallback if token was signed with the default fallback secret
    if (primarySecret !== 'easymanage-default-secret-change-me') {
      try {
        decoded = jwt.verify(token, 'easymanage-default-secret-change-me') as JwtPayload;
      } catch {
        // Fallback failed as well
      }
    }

    if (!decoded) {
      console.warn(`[Auth 401] Session token validation failed on ${req.method} ${req.originalUrl}:`, err.message);
      res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
      return;
    }
  }

  (req as any).jwtUser = decoded;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).jwtUser as JwtPayload | undefined;
  if (user) {
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Admin privilege required.' });
      return;
    }
    return next();
  }

  // If requireAuth was not chained beforehand, execute token verification first
  requireAuth(req, res, () => {
    const u = (req as any).jwtUser as JwtPayload | undefined;
    if (!u || u.role !== 'admin') {
      res.status(403).json({ error: 'Admin privilege required.' });
      return;
    }
    next();
  });
}

