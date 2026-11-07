import { OFFLINE_FILE_NAME, offlineCopy, PRIVACY_LIMITS, PRIVACY_STATEMENT } from '../../content/copy';
import { isOfflineFile } from '../offline';

export function Privacy() {
  return (
    <>
      <h1 tabIndex={-1}>Privacy</h1>
      <p>{PRIVACY_STATEMENT}</p>
      <h2>{offlineCopy.heading}</h2>
      {isOfflineFile() ? (
        <p>{offlineCopy.usingOffline}</p>
      ) : (
        <>
          <p>{offlineCopy.computerOption}</p>
          <p>
            <a href={`/${OFFLINE_FILE_NAME}`} download={OFFLINE_FILE_NAME}>{offlineCopy.linkLabel}</a>
          </p>
        </>
      )}
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
