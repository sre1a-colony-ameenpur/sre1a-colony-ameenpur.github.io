// Google Identity Services sign-in, silent refresh and sign-out. ID token is kept in sessionStorage only.
const KEY = 'sre.idToken';

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

export function createAuth({ clientId, onToken, onSignedOut }) {
  let token = store.get();
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
    clearTimeout(timer);
    const left = secondsLeft(t);
    if (left > 0) timer = setTimeout(() => refresh().catch(() => {}), Math.max(30, left - 300) * 1000); // 5 min early
    pending?.resolve(t); pending = null;
    onToken?.(t);
  }

  async function init() {
    const g = await waitForGis();
    if (!g) return false;
    g.initialize({ client_id: clientId, callback: (r) => accept(r.credential), auto_select: true, cancel_on_tap_outside: false });
    return true;
  }
  function renderButton(el, locale = 'en') {
    gis()?.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 280, locale });
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
    if (!gis()) return token; // let the server answer BAD_TOKEN
    return refresh();
  }
  function signOut() {
    gis()?.disableAutoSelect();
    clearTimeout(timer); token = null; store.set(null);
    onSignedOut?.();
  }
  return { init, renderButton, getToken, refresh, signOut, current: () => token, claims: () => (token ? decodeJwt(token) : null) };
}
