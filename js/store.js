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

export const store = {
  get: () => state,
  set(patch) { Object.assign(state, patch); subs.forEach((f) => f(state)); },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
};

// can('expenses', 'c'): true only if the session caps list the verb.
export function can(entity, verb, s = state) {
  return !!s.session?.caps?.[entity]?.includes(verb);
}
export function canAny(entity, s = state) {
  return !!s.session?.caps?.[entity]?.length;
}
