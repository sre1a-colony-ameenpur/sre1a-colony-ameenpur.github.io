// Session store. `caps` only hides what the server did not allow; the server decides.
const state = {
  status: 'boot',   // boot | out | in | noaccess | down
  session: null,    // session.get response
  user: null,       // { email, name } from the Google token (for the no-access screen)
  lang: 'en',
  theme: 'auto',    // auto | light | dark
  online: true,
  notice: null,     // optional message for the sign-in screen
};
const subs = new Set();

// Home data that arrived together with the session (one request on opening the app). Used once if still fresh, then dropped.
export const homeSeed = { at: 0, data: null };
export function takeHomeSeed(maxAgeMs = 60000) {
  const d = homeSeed.data && Date.now() - homeSeed.at < maxAgeMs ? homeSeed.data : null;
  homeSeed.data = null;
  return d;
}

export const store = {
  get: () => state,
  set(patch) { Object.assign(state, patch); subs.forEach((f) => f(state)); },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
};

// can('expenses', 'c'): true only if the session caps list the verb.
export function can(entity, verb, s = state) {
  return !!s.session?.caps?.[entity]?.includes(verb);
}
// Is a feature module switched on? (The developer sets MODULES on the backend; the session lists what is on. No list, e.g. the mock: all on.)
export function hasModule(name, s = state) {
  const list = s.session?.modules;
  return !list || list.includes(name);
}
export function canAny(entity, s = state) {
  return !!s.session?.caps?.[entity]?.length;
}
