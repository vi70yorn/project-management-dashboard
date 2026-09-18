import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const AES_KEY_HEX = process.env.API_ENCRYPTION_KEY || '';
export const AES_KEY_BUFFER = AES_KEY_HEX.length === 64
  ? Buffer.from(AES_KEY_HEX, 'hex')
  : null;

export function encryptPayloadSync(plaintext: string): string {
  if (!AES_KEY_BUFFER) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Middleware: intercept res.json() for ALL /api/* routes (except /api/health)
 * Format: base64(iv[12] + ciphertext + authTag[16]) wrapped in { enc: "..." }
 */
export function apiResponseEncryptionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health' || !AES_KEY_BUFFER) {
    return next();
  }
  const originalJson = res.json.bind(res);
  res.json = (data: any): Response => {
    const plaintext = JSON.stringify(data);
    const encryptedB64 = encryptPayloadSync(plaintext);
    return originalJson({ enc: encryptedB64 });
  };
  next();
}

