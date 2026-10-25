// Google Identity Services sign-in, silent refresh and sign-out. The Google ID token (1 hour) is kept in sessionStorage only.
// After sign-in the server swaps it for its own 30-day session token (`session.renew`), kept in localStorage, so a phone app added to the
// home screen (iOS wipes its sessionStorage and cannot refresh Google silently) stays signed in.
const KEY = 'sre.idToken';
export const SESSION_KEY = 'sre.session';
const RENEW_BELOW = 15 * 86400;       // ask for a fresh 30 days once less than 15 remain

export function decodeJwt(token) {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString();
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}
export const secondsLeft = (token, now = Date.now()) => {
  const p = decodeJwt(token);
  return p?.exp ? p.exp - Math.floor(now / 1000) : 0;
};

const store = {
  get() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch { /* private mode */ } },
};

const longStore = {
  get() { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } },
  set(v) { try { v ? localStorage.setItem(SESSION_KEY, v) : localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ } },
};

export function createAuth({ clientId, onToken, onSignedOut }) {
  let session = longStore.get();
  if (session && secondsLeft(session) <= 0) { longStore.set(null); session = null; }
  let token = session || store.get();
  let pending = null;
  let timer = null;

  const gis = () => globalThis.google?.accounts?.id;
  const waitForGis = async (ms = 8000) => {
    const end = Date.now() + ms;
    while (!gis() && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
    return gis();
  };

  function accept(t) {
    token = t; store.set(t);
    session = null;                 // a fresh Google sign-in replaces the long session until it is renewed
    clearTimeout(timer);
    const left = secondsLeft(t);
    if (left > 0) timer = setTimeout(() => refresh().catch(() => {}), Math.max(30, left - 300) * 1000); // 5 min early
    pending?.resolve(t); pending = null;
    onToken?.(t);
  }

  // Asked once; later calls get the same answer. The app does not wait for it when a saved sign-in exists (Google's script can be slow); the sign-in button and a silent refresh do.
  let initDone = null;
  function init() {
    initDone = initDone || (async () => {
      const g = await waitForGis();
      if (!g) return false;
      g.initialize({ client_id: clientId, callback: (r) => accept(r.credential), auto_select: true, cancel_on_tap_outside: false });
      return true;
    })();
    return initDone;
  }
  // The button is drawn by Google in an iframe: a light iframe on a dark page shows as a white box, so pick the matching theme.
  const dark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
  };
  function renderButton(el, locale = 'en') {
    gis()?.renderButton(el, { theme: dark() ? 'filled_black' : 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 280, locale });
  }
  // Silent refresh: One Tap with auto_select returns a fresh token without a click when possible.
  function refresh(ms = 8000) {
    if (pending) return pending.promise;
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    pending = { promise, resolve, reject };
    gis()?.prompt();
    setTimeout(() => { if (pending?.promise === promise) { pending = null; reject(new Error('refresh timeout')); } }, ms);
    return promise;
  }
  async function getToken() {
    if (token && secondsLeft(token) > 120) return token;
    if (session) return session;   // expired locally: the server answers BAD_TOKEN and the person signs in again
    await init();
    if (!gis()) return token; // let the server answer BAD_TOKEN
    return refresh();
  }
  // Called once signed in: gets a 30-day session token (or a fresh one when it runs low) and uses it from now on. Failure is harmless.
  async function keepSession(call) {
    if (session && secondsLeft(session) > RENEW_BELOW) return;
    try {
      const r = await call('session.renew', {});
      if (r?.token) { session = r.token; token = r.token; longStore.set(r.token); store.set(null); clearTimeout(timer); }
    } catch { /* the Google token keeps working for its hour */ }
  }
  function signOut() {
    gis()?.disableAutoSelect();
    clearTimeout(timer); token = null; session = null; store.set(null); longStore.set(null);
    onSignedOut?.();
  }
  return { init, renderButton, getToken, refresh, signOut, keepSession, current: () => token, claims: () => (token ? decodeJwt(token) : null) };
}
