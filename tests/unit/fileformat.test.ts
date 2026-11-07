import { describe, expect, it, vi } from 'vitest';
import { createKey, encrypt } from '../../src/core/crypto';
import { emptyDoc } from '../../src/core/doc';
import { backupFileName, MAX_FILE_BYTES, parseSaved, serialize } from '../../src/core/fileformat';
import { FileError } from '../../src/core/validate';

const god = { kind: 'god', custom: '' } as const;

function codeOf(fn: () => unknown): string | undefined {
  try { fn(); } catch (e) { return e instanceof FileError ? e.code : `other:${String(e)}`; }
  return undefined;
}

describe('fileformat', () => {
  it('parses plain and encrypted saves', async () => {
    const doc = emptyDoc('food', god);
    const plain = parseSaved(serialize(doc));
    expect(plain).toEqual({ kind: 'plain', doc });

    const env = await encrypt(doc, await createKey('longenough'));
    const enc = parseSaved(serialize(env));
    expect(enc).toEqual({ kind: 'encrypted', envelope: env });
  });

  it('rejects oversize text before calling JSON.parse', () => {
    const spy = vi.spyOn(JSON, 'parse');
    try {
      expect(codeOf(() => parseSaved('x'.repeat(MAX_FILE_BYTES + 1)))).toBe('too-large');
      // Multi-byte characters count by bytes, not UTF-16 units.
      expect(codeOf(() => parseSaved('é'.repeat(MAX_FILE_BYTES / 2 + 1)))).toBe('too-large');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects invalid JSON and non-inventory JSON with not-inventory', () => {
    expect(codeOf(() => parseSaved('{nope'))).toBe('not-inventory');
    expect(codeOf(() => parseSaved(''))).toBe('not-inventory');
    expect(codeOf(() => parseSaved('[]'))).toBe('not-inventory');
    expect(codeOf(() => parseSaved('null'))).toBe('not-inventory');
    expect(codeOf(() => parseSaved('{"format":"something-else"}'))).toBe('not-inventory');
  });

  it('rejects a malformed encrypted envelope as corrupt', () => {
    const text = JSON.stringify({
      format: 'step4-inventory-encrypted', version: 1, kdf: 'PBKDF2-SHA-256',
      iterations: 600000, salt: 'AAAA', iv: 'AAAA', ciphertext: 'AAAA',
    });
    expect(codeOf(() => parseSaved(text))).toBe('corrupt');
  });

  it('reports a newer envelope version as newer-version', () => {
    const text = JSON.stringify({ format: 'step4-inventory-encrypted', version: 2 });
    expect(codeOf(() => parseSaved(text))).toBe('newer-version');
  });

  it('backupFileName formats the local date', () => {
    expect(backupFileName(new Date(2026, 10, 7))).toBe('inventory-backup-2026-11-07.json');
    expect(backupFileName(new Date(2026, 0, 3, 23, 59))).toBe('inventory-backup-2026-01-03.json');
  });
});
