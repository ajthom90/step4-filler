import type { InventoryDoc } from './doc';
import { FileError, validateDoc } from './validate';

export const KDF_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const ENVELOPE_FORMAT = 'step4-inventory-encrypted';
const ENVELOPE_VERSION = 1;
const KDF_NAME = 'PBKDF2-SHA-256';
/** Authenticated but unencrypted: binds the file's format and version to the ciphertext. */
const AAD = new TextEncoder().encode(`${ENVELOPE_FORMAT}:${ENVELOPE_VERSION}`);

export interface Envelope {
  format: 'step4-inventory-encrypted';
  version: 1;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

export interface SessionKey {
  key: CryptoKey; // non-extractable
  salt: Uint8Array;
  iterations: number;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// No repeated group: a grouped loop overflows the regex stack on multi-megabyte input.
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Strict decode: atob alone would tolerate whitespace and missing padding. */
function fromBase64(value: string, path: string): Uint8Array {
  if (value.length % 4 !== 0 || !BASE64.test(value)) throw new FileError('corrupt', `Invalid value at ${path}`);
  const s = atob(value);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function own(o: object, key: string): unknown {
  return Object.hasOwn(o, key) ? (o as Record<string, unknown>)[key] : undefined;
}

interface Decoded { iterations: number; salt: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array }

/**
 * Checks every field's type, base64 encoding and length. Runs before any
 * Web Crypto call, so a hostile file cannot reach key derivation.
 */
export function checkEnvelope(value: unknown): Envelope & { decoded: Decoded } {
  const bad = (path: string): never => {
    throw new FileError('corrupt', `Invalid value at ${path}`);
  };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return bad('envelope');
  if (own(value, 'format') !== ENVELOPE_FORMAT) return bad('format');
  const version = own(value, 'version');
  if (typeof version === 'number' && Number.isInteger(version) && version > ENVELOPE_VERSION) {
    throw new FileError('newer-version');
  }
  if (version !== ENVELOPE_VERSION) return bad('version');
  if (own(value, 'kdf') !== KDF_NAME) return bad('kdf');

  const iterations = own(value, 'iterations');
  if (
    typeof iterations !== 'number' || !Number.isInteger(iterations)
    || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS
  ) return bad('iterations');

  const b64 = (key: string): string => {
    const v = own(value, key);
    return typeof v === 'string' ? v : bad(key);
  };
  const salt = b64('salt');
  const iv = b64('iv');
  const ciphertext = b64('ciphertext');
  const saltBytes = fromBase64(salt, 'salt');
  const ivBytes = fromBase64(iv, 'iv');
  const ctBytes = fromBase64(ciphertext, 'ciphertext');
  if (saltBytes.length !== SALT_BYTES) bad('salt');
  if (ivBytes.length !== IV_BYTES) bad('iv');
  if (ctBytes.length < TAG_BYTES) bad('ciphertext');

  return {
    format: ENVELOPE_FORMAT, version: ENVELOPE_VERSION, kdf: KDF_NAME, iterations, salt, iv, ciphertext,
    decoded: { iterations, salt: saltBytes, iv: ivBytes, ciphertext: ctBytes },
  };
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createKey(password: string): Promise<SessionKey> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt, KDF_ITERATIONS);
  return { key, salt, iterations: KDF_ITERATIONS };
}

export async function encrypt(doc: InventoryDoc, session: SessionKey): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(doc));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: AAD as BufferSource },
    session.key,
    plaintext as BufferSource,
  ));
  return {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    kdf: KDF_NAME,
    iterations: session.iterations,
    salt: toBase64(session.salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

export async function decrypt(
  env: Envelope,
  password: string,
): Promise<{ doc: InventoryDoc; session: SessionKey }> {
  const { decoded } = checkEnvelope(env);
  const key = await deriveKey(password, decoded.salt, decoded.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decoded.iv as BufferSource, additionalData: AAD as BufferSource },
      key,
      decoded.ciphertext as BufferSource,
    );
  } catch {
    // A wrong password and altered data are indistinguishable by design.
    throw new FileError('wrong-password');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  } catch {
    throw new FileError('corrupt', 'Decrypted data is not valid JSON');
  }
  const doc = validateDoc(parsed);
  // Older, weaker files stay readable, but the next save must use the current count.
  if (decoded.iterations < KDF_ITERATIONS) return { doc, session: await createKey(password) };
  return { doc, session: { key, salt: decoded.salt, iterations: decoded.iterations } };
}
