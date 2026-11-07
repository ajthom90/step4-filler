import { describe, expect, it, vi } from 'vitest';
import { createKey, decrypt, encrypt, KDF_ITERATIONS, type Envelope } from '../../src/core/crypto';
import { emptyDoc } from '../../src/core/doc';
import { FileError } from '../../src/core/validate';

const PASSWORD = 'correct horse battery';
const SECRET = 'my-very-private-resentment-text';

function sampleDoc() {
  const doc = emptyDoc('general', { kind: 'god', custom: '' });
  doc.resentments = [{
    id: 'r1', name: SECRET, prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '',
    causes: [],
  }];
  return doc;
}

function flipByte(b64: string): string {
  const bytes = Buffer.from(b64, 'base64');
  bytes[0] ^= 0x01;
  return bytes.toString('base64');
}

async function makeEnvelope(): Promise<Envelope> {
  return encrypt(sampleDoc(), await createKey(PASSWORD));
}

async function expectFileError(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(FileError);
  expect((err as FileError).code).toBe(code);
  expect((err as FileError).message).not.toContain(PASSWORD);
  expect((err as FileError).message).not.toContain(SECRET);
}

describe('crypto', () => {
  it('round-trips a doc', async () => {
    const env = await makeEnvelope();
    const { doc, session } = await decrypt(env, PASSWORD);
    expect(doc).toEqual(sampleDoc());
    expect(session.iterations).toBe(KDF_ITERATIONS);
    expect(session.salt).toHaveLength(16);
  });

  it('wrong password throws FileError wrong-password', async () => {
    const env = await makeEnvelope();
    await expectFileError(decrypt(env, 'not the password'), 'wrong-password');
  });

  it('tampered ciphertext, IV, or salt throws', async () => {
    const env = await makeEnvelope();
    for (const key of ['ciphertext', 'iv', 'salt'] as const) {
      const bad = { ...env, [key]: flipByte(env[key]) };
      await expectFileError(decrypt(bad, PASSWORD), 'wrong-password');
    }
  });

  it('uses a new IV on every encrypt, and a new salt on every createKey', async () => {
    const s1 = await createKey(PASSWORD);
    const s2 = await createKey(PASSWORD);
    expect(Buffer.from(s1.salt).equals(Buffer.from(s2.salt))).toBe(false);
    const a = await encrypt(sampleDoc(), s1);
    const b = await encrypt(sampleDoc(), s1);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.salt).toBe(b.salt);
  });

  it('envelope reveals nothing', async () => {
    const env = await makeEnvelope();
    expect(JSON.stringify(env)).not.toContain(SECRET);
    expect(Object.keys(env).sort()).toEqual(
      ['ciphertext', 'format', 'iterations', 'iv', 'kdf', 'salt', 'version'],
    );
    expect(env.format).toBe('step4-inventory-encrypted');
    expect(env.version).toBe(1);
    expect(env.kdf).toBe('PBKDF2-SHA-256');
  });

  it('key cannot be exported', async () => {
    const { key } = await createKey(PASSWORD);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('uses 600,000 iterations on a new envelope', async () => {
    expect(KDF_ITERATIONS).toBe(600_000);
    expect((await makeEnvelope()).iterations).toBe(600_000);
  });

  it('rejects iteration counts outside 100,000 to 10,000,000 as corrupt, before any key derivation', async () => {
    const env = await makeEnvelope();
    const spy = vi.spyOn(crypto.subtle, 'importKey');
    try {
      for (const iterations of [99_999, 10_000_001, 0, -1, 1.5, Number.NaN, Infinity]) {
        await expectFileError(decrypt({ ...env, iterations }, PASSWORD), 'corrupt');
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects malformed envelope fields as corrupt, before calling Web Crypto', async () => {
    const env = await makeEnvelope();
    const spy = vi.spyOn(crypto.subtle, 'importKey');
    const decryptSpy = vi.spyOn(crypto.subtle, 'decrypt');
    try {
      const bad: unknown[] = [
        null, 'x', [], {},
        { ...env, format: 'other' },
        { ...env, version: '1' },
        { ...env, version: 0 },
        { ...env, kdf: 'PBKDF2-SHA-1' },
        { ...env, salt: 42 },
        { ...env, salt: '!!!not base64!!!' },
        { ...env, salt: 'AAAA' },
        { ...env, salt: Buffer.alloc(17).toString('base64') },
        { ...env, iv: Buffer.alloc(16).toString('base64') },
        { ...env, iv: undefined },
        { ...env, ciphertext: '' },
        { ...env, ciphertext: Buffer.alloc(15).toString('base64') },
        { ...env, ciphertext: 'abc' },
        { ...env, ciphertext: null },
      ];
      for (const b of bad) {
        await expectFileError(decrypt(b as Envelope, PASSWORD), 'corrupt');
      }
      expect(spy).not.toHaveBeenCalled();
      expect(decryptSpy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      decryptSpy.mockRestore();
    }
  });

  it('binds format and version as additional data', async () => {
    const env = await makeEnvelope();
    // Same key material, but the ciphertext must not open under different AAD.
    const { session } = await decrypt(env, PASSWORD);
    const aad = new TextEncoder().encode('step4-inventory-encrypted:2');
    await expect(
      crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: Buffer.from(env.iv, 'base64'), additionalData: aad },
        session.key,
        Buffer.from(env.ciphertext, 'base64'),
      ),
    ).rejects.toThrow();
  });

  it('a decrypted payload that is not a valid doc throws a FileError', async () => {
    const session = await createKey(PASSWORD);
    const env = await encrypt({ ...sampleDoc(), resentments: 'nope' } as never, session);
    await expectFileError(decrypt(env, PASSWORD), 'corrupt');
  });
});

describe('crypto versioning', () => {
  it('reports a newer envelope version as newer-version', async () => {
    const env = await makeEnvelope();
    await expectFileError(decrypt({ ...env, version: 2 as never }, PASSWORD), 'newer-version');
  });
});
