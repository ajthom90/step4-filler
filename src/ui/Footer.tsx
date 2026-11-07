import { DISCLAIMER } from '../content/copy';

export function Footer() {
  return (
    <footer class="footer">
      <p>{DISCLAIMER}</p>
      <p>
        <a href="#/privacy">Privacy</a> · <a href="#/support">Support</a>
      </p>
    </footer>
  );
}
