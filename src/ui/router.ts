import type { InventoryId } from '../core/flow';

export type Route =
  | { name: 'welcome' | 'home' | 'privacy' | 'support' | 'settings' | 'checklist' | 'pledge' | 'print' | 'save' | 'unlock' }
  | { name: 'step'; inventory: InventoryId; key?: string };

const PLAIN = ['welcome', 'home', 'privacy', 'support', 'settings', 'checklist', 'pledge', 'print', 'save', 'unlock'] as const;
const INVENTORIES: readonly InventoryId[] = ['resentments', 'fears', 'harms'];

/** Hash routes only, so nothing a person writes ever appears in a URL. */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const [name, inventory, key] = parts;
  if (name === 'step' && INVENTORIES.includes(inventory as InventoryId)) {
    if (key === undefined || key === '') return { name: 'step', inventory: inventory as InventoryId };
    try {
      return { name: 'step', inventory: inventory as InventoryId, key: decodeURIComponent(key) };
    } catch {
      return { name: 'step', inventory: inventory as InventoryId };
    }
  }
  const plain = PLAIN.find((p) => p === name);
  return { name: plain ?? 'home' } as Route;
}

export function routeHash(r: Route): string {
  if (r.name !== 'step') return `#/${r.name}`;
  return r.key === undefined ? `#/step/${r.inventory}` : `#/step/${r.inventory}/${encodeURIComponent(r.key)}`;
}
