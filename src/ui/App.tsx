import { useEffect, useRef } from 'preact/hooks';
import { site } from '../../site.config';
import { saveCopy } from '../content/copy';
import { Footer } from './Footer';
import { Checklist } from './screens/Checklist';
import { Pledge } from './screens/Pledge';
import { Print } from './screens/Print';
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
import { dismissNotice, useApp } from './store';

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
    case 'print': return <Print />;
    case 'save': return <Save />;
    case 'step':
      return <StepRunner inventory={route.inventory} stepKey={route.key} />;
    default: return <Home />;
  }
}

export function App() {
  const { state, saver } = useApp();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const hash = routeHash(state.route);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // If the person has already started on a field of the new screen, taking focus now would cut their typing off.
    const active = document.activeElement;
    if (active instanceof HTMLElement && main.current?.contains(active) && active.matches('input, textarea, select')) return;
    main.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [hash]);
  return (
    <div class={state.doc && state.route.name === 'print' ? 'shell printing' : 'shell'}>
      <header class="header">
        <a class="brand" href="#/home">{site.name}</a>
        <nav aria-label="Main">
          {state.doc && <a href="#/settings">Settings</a>}
          <a href="#/support">Support</a>
        </nav>
        {state.doc && <LockButton />}
        {state.doc && <SaveStatus />}
      </header>
      {saver.isStale && (
        <p class="notice alert" role="alert">{saveCopy.staleBanner}</p>
      )}
      {state.notice && (
        <div class="notice alert" role="alert">
          <p>{state.notice}</p>
          <p class="actions"><button type="button" onClick={dismissNotice}>Dismiss</button></p>
        </div>
      )}
      <SavePrompt />
      <main ref={main}>
        <Screen route={state.route} />
      </main>
      <Footer />
    </div>
  );
}
