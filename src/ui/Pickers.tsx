import { site } from '../../site.config';
import type { GodWord, PresetId } from '../core/doc';
import { PRESETS } from '../content/presets';

const ORDER: PresetId[] = ['food', 'alcohol', 'narcotics', 'sexLove', 'general'];

/** The choice of what the inventory is about. `value` is null on the first visit, before anything is chosen. */
export function PresetPicker({ value, onChange, name }: { value: PresetId | null; onChange: (p: PresetId) => void; name: string }) {
  return (
    <fieldset>
      <legend>What is this inventory about?</legend>
      <ul class="plain choices">
        {ORDER.map((id) => {
          const p = PRESETS[id];
          return (
            <li key={id}>
              <label class="choice">
                <input type="radio" name={name} checked={value === id} onChange={() => onChange(id)} />
                <span>{p.label}</span>
              </label>
              {p.draft && (
                <span class="note">
                  {' '}
                  Draft wording, not yet reviewed by a member of that fellowship.
                  {site.feedbackUrl !== '' && (
                    <>
                      {' '}
                      <a href={site.feedbackUrl} target="_blank" rel="noreferrer noopener">Send feedback</a>
                    </>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

const GOD_CHOICES: Array<{ kind: GodWord['kind']; label: string }> = [
  { kind: 'god', label: 'God' },
  { kind: 'higherPower', label: 'Higher Power' },
  { kind: 'custom', label: 'My own word' },
];

export function GodWordPicker({ value, onChange, name }: { value: GodWord; onChange: (g: GodWord) => void; name: string }) {
  return (
    <fieldset>
      <legend>Which word do you use for a power greater than yourself?</legend>
      <ul class="plain choices">
        {GOD_CHOICES.map((c) => (
          <li key={c.kind}>
            <label class="choice">
              <input type="radio" name={name} checked={value.kind === c.kind} onChange={() => onChange({ kind: c.kind, custom: value.custom })} />
              <span>{c.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {value.kind === 'custom' && (
        <label class="field">
          <span>Your word</span>
          <input
            type="text"
            value={value.custom}
            maxLength={40}
            spellcheck={false}
            autocomplete="off"
            onInput={(e) => onChange({ kind: 'custom', custom: (e.currentTarget as HTMLInputElement).value })}
          />
        </label>
      )}
    </fieldset>
  );
}
