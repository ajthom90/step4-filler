/** Offers `text` to the browser as a file download. The text never leaves the device. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the browser has had time to start reading it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
