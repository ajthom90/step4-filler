/** True when the page was opened as the downloaded offline file rather than from the site. */
export function isOfflineFile(): boolean {
  return window.location.protocol === 'file:';
}
