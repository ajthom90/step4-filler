import { GodWordPicker, PresetPicker } from '../Pickers';
import { useApp } from '../store';
import { EraseEverything } from './Save';

export function Settings() {
  const { state, update } = useApp();
  const { settings } = state.doc!;
  return (
    <>
      <h1 tabIndex={-1}>Settings</h1>
      <p>Changing these only changes the wording. Your entries stay as they are.</p>
      <PresetPicker name="preset" value={settings.preset} onChange={(preset) => update((d) => ({ ...d, settings: { ...d.settings, preset } }))} />
      <GodWordPicker name="god" value={settings.godWord} onChange={(godWord) => update((d) => ({ ...d, settings: { ...d.settings, godWord } }))} />
      <h2>Saving</h2>
      <p><a href="#/save">Choose how this inventory is saved</a></p>
      <EraseEverything />
      <p><a href="#/home">Back to your inventory</a></p>
    </>
  );
}
