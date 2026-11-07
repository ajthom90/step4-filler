import { checkEnvelope, type Envelope } from './crypto';
import type { InventoryDoc } from './doc';
import { FileError, validateDoc } from './validate';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type Parsed =
  | { kind: 'plain'; doc: InventoryDoc }
  | { kind: 'encrypted'; envelope: Envelope };

export function parseSaved(text: string): Parsed {
  // UTF-8 is never shorter than the UTF-16 length, so the cheap check goes first.
  if (text.length > MAX_FILE_BYTES || new TextEncoder().encode(text).length > MAX_FILE_BYTES) {
    throw new FileError('too-large');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new FileError('not-inventory');
  }
  if (
    typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.hasOwn(value, 'format')
    && (value as Record<string, unknown>).format === 'step4-inventory-encrypted'
  ) {
    const { decoded: _decoded, ...envelope } = checkEnvelope(value);
    return { kind: 'encrypted', envelope };
  }
  return { kind: 'plain', doc: validateDoc(value) };
}

export function serialize(payload: InventoryDoc | Envelope): string {
  return JSON.stringify(payload, null, 2);
}

export function backupFileName(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `inventory-backup-${y}-${m}-${d}.json`;
}
