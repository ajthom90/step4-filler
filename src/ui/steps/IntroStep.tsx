import { site } from '../../../site.config';
import type { StepProps } from './types';

export function IntroStep({ copy }: StepProps) {
  return (
    <>
      <div class="hint" data-testid="hint">
        {copy.hint.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <p>
        <a href={site.bigBookUrl} target="_blank" rel="noreferrer noopener">
          Read the Big Book online
        </a>{' '}
        <span class="note">(opens in a new tab; this page stays open)</span>
      </p>
    </>
  );
}
