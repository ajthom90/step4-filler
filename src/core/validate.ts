import type {
  Affects, Cause, FearEntry, GodWord, HarmEntry, InventoryDoc, PresetId, ResentmentEntry, YesNo,
} from './doc';

export type FileErrorCode = 'too-large' | 'not-inventory' | 'newer-version' | 'corrupt' | 'wrong-password';

export class FileError extends Error {
  code: FileErrorCode;
  constructor(code: FileErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'FileError';
    this.code = code;
  }
}

const PRESETS: readonly PresetId[] = ['food', 'alcohol', 'narcotics', 'sexLove', 'general'];
const GOD_KINDS: readonly GodWord['kind'][] = ['god', 'higherPower', 'custom'];
const CURRENT_VERSION = 1;

type Obj = Record<string, unknown>;

function corrupt(path: string): never {
  throw new FileError('corrupt', `Invalid value at ${path}`);
}

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads only own properties, so nothing arrives through a prototype. */
function field(o: Obj, key: string): unknown {
  return Object.hasOwn(o, key) ? o[key] : undefined;
}

function obj(v: unknown, path: string): Obj {
  if (!isObj(v)) corrupt(path);
  return v;
}

function str(o: Obj, key: string, path: string): string {
  const v = field(o, key);
  if (typeof v !== 'string') corrupt(`${path}.${key}`);
  return v;
}

function bool(o: Obj, key: string, path: string): boolean {
  const v = field(o, key);
  if (typeof v !== 'boolean') corrupt(`${path}.${key}`);
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[], path: string): T {
  const v = field(o, key);
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) corrupt(`${path}.${key}`);
  return v as T;
}

function nullableOneOf<T extends string>(o: Obj, key: string, allowed: readonly T[], path: string): T | null {
  if (field(o, key) === null) return null;
  return oneOf(o, key, allowed, path);
}

function arr(o: Obj, key: string, path: string): unknown[] {
  const v = field(o, key);
  if (!Array.isArray(v)) corrupt(`${path}.${key}`);
  return v;
}

function strList(o: Obj, key: string, path: string): string[] {
  return arr(o, key, path).map((item, i) => {
    if (typeof item !== 'string') corrupt(`${path}.${key}[${i}]`);
    return item;
  });
}

function yesNo(o: Obj, key: string, path: string): YesNo {
  return nullableOneOf(o, key, ['yes', 'no'] as const, path);
}

function makeIdClaimer(): (id: string, path: string) => void {
  const seen = new Set<string>();
  return (id, path) => {
    if (id === '' || seen.has(id)) corrupt(`${path}.id`);
    seen.add(id);
  };
}

function affects(v: unknown, path: string): Affects {
  const o = obj(v, path);
  return {
    selfEsteem: bool(o, 'selfEsteem', path),
    security: bool(o, 'security', path),
    ambitions: bool(o, 'ambitions', path),
    personalRelations: bool(o, 'personalRelations', path),
    sexRelations: bool(o, 'sexRelations', path),
    fear: bool(o, 'fear', path),
  };
}

function godWord(v: unknown, path: string): GodWord {
  const o = obj(v, path);
  return { kind: oneOf(o, 'kind', GOD_KINDS, path), custom: str(o, 'custom', path) };
}

/** Builds a fresh record; keys become own data properties and "__proto__" is never kept. */
function visited(v: unknown, path: string): Record<string, true> {
  const o = obj(v, path);
  const out: Record<string, true> = {};
  for (const key of Object.keys(o)) {
    if (o[key] !== true) corrupt(`${path}.${key}`);
    if (key === '__proto__') continue;
    Object.defineProperty(out, key, { value: true, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

function migrate(value: Obj): Obj {
  // Version 1 is current; later versions add steps here so old files stay readable.
  return value;
}

export function validateDoc(value: unknown): InventoryDoc {
  if (!isObj(value) || field(value, 'format') !== 'step4-inventory') {
    throw new FileError('not-inventory');
  }
  const version = field(value, 'version');
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) corrupt('version');
  if (version > CURRENT_VERSION) throw new FileError('newer-version');

  const o = migrate(value);
  const claim = makeIdClaimer();

  const settings = obj(field(o, 'settings'), 'settings');
  const checklist = obj(field(o, 'checklist'), 'checklist');
  const pledge = obj(field(o, 'pledge'), 'pledge');

  const resentments = arr(o, 'resentments', 'doc').map((item, i): ResentmentEntry => {
    const p = `resentments[${i}]`;
    const e = obj(item, p);
    const id = str(e, 'id', p);
    claim(id, p);
    const causes = arr(e, 'causes', p).map((c, j): Cause => {
      const cp = `${p}.causes[${j}]`;
      const co = obj(c, cp);
      const cid = str(co, 'id', cp);
      claim(cid, cp);
      return { id: cid, text: str(co, 'text', cp), affects: affects(field(co, 'affects'), `${cp}.affects`) };
    });
    return {
      id, name: str(e, 'name', p), causes, prayerDone: bool(e, 'prayerDone', p),
      selfish: str(e, 'selfish', p), dishonest: str(e, 'dishonest', p),
      selfSeeking: str(e, 'selfSeeking', p), frightened: str(e, 'frightened', p),
    };
  });

  const fears = arr(o, 'fears', 'doc').map((item, i): FearEntry => {
    const p = `fears[${i}]`;
    const e = obj(item, p);
    const id = str(e, 'id', p);
    claim(id, p);
    return {
      id, fear: str(e, 'fear', p), why: str(e, 'why', p),
      trust: nullableOneOf(e, 'trust', ['god', 'self'] as const, p),
      selfRelianceWorked: yesNo(e, 'selfRelianceWorked', p),
      prayerDone: bool(e, 'prayerDone', p), beWhat: str(e, 'beWhat', p),
    };
  });

  const harms = arr(o, 'harms', 'doc').map((item, i): HarmEntry => {
    const p = `harms[${i}]`;
    const e = obj(item, p);
    const id = str(e, 'id', p);
    claim(id, p);
    return {
      id, who: str(e, 'who', p), selfish: str(e, 'selfish', p), dishonest: str(e, 'dishonest', p),
      inconsiderate: str(e, 'inconsiderate', p), jealousy: bool(e, 'jealousy', p),
      suspicion: bool(e, 'suspicion', p), bitterness: bool(e, 'bitterness', p),
      fault: str(e, 'fault', p), wasSelfish: yesNo(e, 'wasSelfish', p),
      sexPrayerDone: bool(e, 'sexPrayerDone', p), sexMeditationDone: bool(e, 'sexMeditationDone', p),
    };
  });

  return {
    format: 'step4-inventory',
    version: 1,
    settings: {
      preset: oneOf(settings, 'preset', PRESETS, 'settings'),
      godWord: godWord(field(settings, 'godWord'), 'settings.godWord'),
    },
    visited: visited(field(o, 'visited'), 'visited'),
    resentments, fears, harms,
    checklist: { selected: strList(checklist, 'selected', 'checklist'), other: str(checklist, 'other', 'checklist') },
    pledge: {
      listA: strList(pledge, 'listA', 'pledge'), listB: strList(pledge, 'listB', 'pledge'),
      name: str(pledge, 'name', 'pledge'), date: str(pledge, 'date', 'pledge'),
    },
  };
}
