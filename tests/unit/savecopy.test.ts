import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { saveCopy } from '../../src/content/copy';

/** Every string in saveCopy, with functions called on a sample. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') out.push((value as (s: string) => string)('(file name)'));
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe('save wording', () => {
  it('every phrase is listed in docs/content-review.md for the owner', () => {
    const doc = readFileSync('docs/content-review.md', 'utf8');
    const missing = strings(saveCopy).filter((text) => !doc.includes(text));
    expect(missing).toEqual([]);
  });

  it('screens take their wording from copy.ts, not from literals', () => {
    const literals = [
      'Save in this browser with a password', 'Save in this browser without a password',
      'Download a file with a password', 'Download a file without a password',
      'New password', 'Type it again', 'Password for this file', 'Open a saved file',
      'Choose how this inventory is saved', 'Saved on this device', 'Reload this page to see it',
      'Remove the password', 'Erase everything', 'Open file',
    ];
    const files = ['src/ui/App.tsx', 'src/ui/SaveStatus.tsx', 'src/ui/SavePrompt.tsx', ...readdirSync('src/ui/screens').map((f) => `src/ui/screens/${f}`)];
    const found: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const literal of literals) if (text.includes(literal)) found.push(`${file}: ${literal}`);
    }
    expect(found).toEqual([]);
  });
});
