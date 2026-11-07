import { NOT_A_SUBSTITUTE, SUPPORT_HEADING, SUPPORT_TEXT } from '../../content/copy';

export function Support() {
  return (
    <>
      <h1 tabIndex={-1}>{SUPPORT_HEADING}</h1>
      <p>{SUPPORT_TEXT}</p>
      <ul class="links">
        <li><a href="sms:">Message your sponsor or someone you trust</a></li>
        <li><a href="tel:988">Call 988</a> or <a href="sms:988">text 988</a> (US)</li>
        <li><a href="https://findahelpline.com" target="_blank" rel="noreferrer noopener">Find local crisis services</a></li>
      </ul>
      <p>{NOT_A_SUBSTITUTE}</p>
    </>
  );
}
