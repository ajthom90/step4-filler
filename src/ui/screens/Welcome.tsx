import { useState } from 'preact/hooks';
import { DISCLAIMER } from '../../content/copy';
import { emptyDoc, type GodWord, type PresetId } from '../../core/doc';
import { GodWordPicker, PresetPicker } from '../Pickers';
import { startInventory } from '../store';
import { OpenFile } from './Save';

export function Welcome() {
  const [preset, setPreset] = useState<PresetId | null>(null);
  const [god, setGod] = useState<GodWord>({ kind: 'god', custom: '' });
  return (
    <>
      <h1 tabIndex={-1}>Before you begin</h1>
      <p class="lead">
        This is a place to work through a Step 4 inventory, one column at a time, at your own pace. Nothing you write is sent anywhere.
        Nothing is saved until you choose how to keep it.
      </p>
      <p class="disclaimer">{DISCLAIMER}</p>
      <PresetPicker name="preset" value={preset} onChange={setPreset} />
      <GodWordPicker name="god" value={god} onChange={setGod} />
      <p>
        <button type="button" class="primary" disabled={preset === null} onClick={() => preset && startInventory(emptyDoc(preset, god))}>
          Continue
        </button>
        {preset === null && <span class="note"> Choose what the inventory is about to continue.</span>}
      </p>
      <OpenFile />
    </>
  );
}
