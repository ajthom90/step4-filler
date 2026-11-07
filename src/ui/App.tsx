import { useEffect, useRef } from 'preact/hooks';
import { site } from '../../site.config';
import { Footer } from './Footer';
import { Checklist } from './screens/Checklist';
import { Pledge } from './screens/Pledge';
import { Home } from './screens/Home';
import { Privacy } from './screens/Privacy';
import { StepRunner } from './screens/StepRunner';
import { Save } from './screens/Save';
import { Settings } from './screens/Settings';
import { Support } from './screens/Support';
import { Unlock } from './screens/Unlock';
import { Welcome } from './screens/Welcome';
import { routeHash, type Route } from './router';
import { SavePrompt } from './SavePrompt';
import { LockButton, SaveStatus } from './SaveStatus';
import { useApp } from './store';

/** Screens other tasks add; each shows a plain placeholder until then. */
function Placeholder({ title }: { title: string }) {
  return (
    <>
      <h1 tabIndex={-1}>{title}</h1>
      <p>This part is not built yet.</p>
      <p><a href="#/home">Back to your inventory</a></p>
    </>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <>
      <h1 tabIndex={-1}>Your saved inventory can't be opened</h1>
      <p role="alert">{message}</p>
      <p>Nothing has been changed or erased. Close other copies of this site and reload the page, or ask for help before doing anything else.</p>
    </>
  );
}

function Screen({ route }: { route: Route }) {
  const { state } = useApp();
  if (route.name === 'privacy') return <Privacy />;
  if (route.name === 'support') return <Support />;
  if (!state.doc) {
    if (state.loadProblem) return <Problem message={state.loadProblem} />;
    if (state.pendingEnvelope || state.locked) return <Unlock />;
    return <Welcome />;
  }
  switch (route.name) {
    case 'settings': return <Settings />;
    case 'checklist': return <Checklist />;
    case 'pledge': return <Pledge />;
    case 'print': return <Placeholder title="Print or download" />;
    case 'save': return <Save />;
    case 'step':
      return <StepRunner inventory={route.inventory} stepKey={route.key} />;
    default: return <Home />;
  }
}

export function App() {
  const { state } = useApp();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const hash = routeHash(state.route);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [hash]);
  return (
    <div class="shell">
      <header class="header">
        <a class="brand" href="#/home">{site.name}</a>
        <nav aria-label="Main">
          {state.doc && <a href="#/settings">Settings</a>}
          <a href="#/support">Support</a>
        </nav>
        {state.doc && <LockButton />}
        {state.doc && <SaveStatus />}
      </header>
      {state.saveStatus === 'stale' && (
        <p class="notice alert" role="alert">
          Another tab saved a newer version of this inventory. Reload this page to see it. This page will not overwrite it.
        </p>
      )}
      <SavePrompt />
      <main ref={main}>
        <Screen route={state.route} />
      </main>
      <Footer />
    </div>
  );
}
