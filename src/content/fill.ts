import type { GodWord, InventoryDoc } from '../core/doc';
import { PRESETS } from './presets';

export interface FillContext { god: string; name?: string; behavior: string; fellowship: string }

/** Shown in a prayer when the person has not typed the name yet. */
const NAME_FALLBACK = 'this person';

export function godWordText(w: GodWord): string {
  if (w.kind === 'higherPower') return 'Higher Power';
  if (w.kind === 'custom') {
    const custom = w.custom.trim();
    return custom === '' ? 'God' : custom;
  }
  return 'God';
}

/**
 * Replaces `{god}`, `{name}`, `{behavior}` and `{fellowship}` in a single pass,
 * so a value that itself contains a token (a name of `{god}`) stays literal.
 * Values go through a replacer function, so `$&` and friends are not special.
 */
export function fill(template: string, ctx: FillContext): string {
  return template.replace(/\{(god|name|behavior|fellowship)\}/g, (_match, key: string) => {
    if (key === 'god') return ctx.god;
    if (key === 'behavior') return ctx.behavior;
    if (key === 'fellowship') return ctx.fellowship;
    return ctx.name === undefined || ctx.name.trim() === '' ? NAME_FALLBACK : ctx.name;
  });
}

export function contextFor(settings: InventoryDoc['settings'], name?: string): FillContext {
  const preset = PRESETS[settings.preset];
  return { god: godWordText(settings.godWord), name, behavior: preset.behavior, fellowship: preset.fellowship };
}
