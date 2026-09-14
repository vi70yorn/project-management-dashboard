/**
 * AES-256-GCM Payload Decryption Utility (Frontend)
 *
 * The server encrypts all /api/* JSON responses using AES-256-GCM.
 * This module provides apiFetch() -- a drop-in replacement for fetch()
 * that automatically decrypts responses before returning them.
 *
 * Encryption format (server -> client):
 *   base64( iv[12 bytes] + ciphertext + authTag[16 bytes] )
 * Wrapped as: { "enc": "<base64string>" }
 */

const KEY_HEX: string | undefined = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_ENCRYPTION_KEY) || undefined;

// Cached CryptoKey to avoid re-importing on every request
let _cachedKey: CryptoKey | null = null;

async function getAesKey(): Promise<CryptoKey | null> {
  if (!KEY_HEX || KEY_HEX.length !== 64) return null;
  if (_cachedKey) return _cachedKey;

  const keyBytes = new Uint8Array(
    KEY_HEX.match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );

  _cachedKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  return _cachedKey;
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * Input format: base64( iv[12] + ciphertext + authTag[16] )
 */
async function decryptPayload(base64: string): Promise<unknown> {
  const key = await getAesKey();
  if (!key) throw new Error('[Crypto] AES key not available -- check VITE_API_ENCRYPTION_KEY');

  // Decode base64 to bytes
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // Extract iv (first 12 bytes) and the rest (ciphertext + authTag)
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12); // Web Crypto AES-GCM: authTag is at the END

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );

  const text = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(text);
}

/**
 * Drop-in replacement for fetch() that automatically decrypts
 * AES-256-GCM encrypted API responses.
 *
 * If encryption is not configured or the response is not encrypted,
 * it falls back to returning the response as-is.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  // Only attempt decryption for API routes
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request).url;

  if (!url.includes('/api/') || !KEY_HEX) {
    return response;
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return response;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON (e.g., file download) -- return raw text response
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'text/plain' },
    });
  }

  // If the server returned an encrypted payload, decrypt it
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'enc' in (parsed as object) &&
    typeof (parsed as Record<string, unknown>).enc === 'string'
  ) {
    try {
      const decrypted = await decryptPayload((parsed as Record<string, string>).enc);
      return new Response(JSON.stringify(decrypted), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('[Crypto] Decryption failed:', err);
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Response is not encrypted (e.g., /api/health or non-API route)
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}
