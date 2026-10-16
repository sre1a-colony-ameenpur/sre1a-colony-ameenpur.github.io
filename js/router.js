// Hash router with guards. Pure helpers are exported for tests.
export function parseHash(hash = '') {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : '/' + path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

// Pattern like '/complaints/:id' -> params or null.
export function matchPath(pattern, path) {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

// route: { path, load, public?, needs?: [entity, verb] }
// state: { status, session }. Returns { route, params, query, redirect }.
export function resolve(routes, hash, state, canFn) {
  const { path, query } = parseHash(hash);
  let route = null, params = {};
  for (const r of routes) { const p = matchPath(r.path, path); if (p) { route = r; params = p; break; } }
  const base = { route, params, query, path };
  const signedIn = state.status === 'in';
  if (!route) return { ...base, redirect: signedIn ? '/home' : '/signin' };
  if (!signedIn && !route.public) return { ...base, redirect: dest(state.status) };
  if (signedIn && route.public) return { ...base, redirect: '/home' };
  if (!signedIn && route.public && dest(state.status) !== route.path) return { ...base, redirect: dest(state.status) };
  if (route.needs && !canFn(route.needs[0], route.needs[1])) return { ...base, redirect: '/home', denied: true };
  return { ...base, redirect: null };
}
function dest(status) {
  return status === 'noaccess' ? '/no-access' : status === 'down' ? '/down' : '/signin';
}

export function createRouter({ routes, getState, canFn, onRoute, win = globalThis }) {
  function go() {
    const r = resolve(routes, win.location.hash, getState(), canFn);
    if (r.redirect) { win.location.replace('#' + r.redirect); if (r.denied) onRoute({ ...r, denied: true, route: null }); return; }
    onRoute(r);
  }
  return {
    start() { win.addEventListener('hashchange', go); go(); },
    refresh: go,
    navigate(path) { if (win.location.hash === '#' + path) go(); else win.location.hash = path; },
  };
}
