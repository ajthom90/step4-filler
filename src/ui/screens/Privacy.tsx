import { PRIVACY_LIMITS, PRIVACY_STATEMENT } from '../../content/copy';

export function Privacy() {
  return (
    <>
      <h1 tabIndex={-1}>Privacy</h1>
      <p>{PRIVACY_STATEMENT}</p>
      <h2>What this site cannot protect</h2>
      <p>{PRIVACY_LIMITS}</p>
      <h2>Where your inventory is kept</h2>
      <p>
        Only where you choose: in this browser on this device, or in a file you download. If you pick neither, closing the page
        discards it.
      </p>
    </>
  );
}
