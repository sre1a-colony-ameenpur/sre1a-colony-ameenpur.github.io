// Stale-while-revalidate for read actions: show the last answer from this device at once, fetch a fresh one in the background, then replace it.
// Once an answer has been fetched in this run of the app it is not fetched again when the member moves between screens or tabs: only the Sync button
// (refreshScreen), the app coming back into focus (resetLoaded) or a write (clear) asks the server again. The first visit after the app opens still fetches once.
// "Loaded" is kept per model (the part of the action name before the dot: complaints.list and complaints.get are the 'complaints' model), so a
// different way of loading, such as one call that fetches every model at sync time, only has to mark the models it filled (markLoaded).
// Answers are kept per signed-in member and dropped on sign-out and after any write. Nothing heavy (photos, proofs, videos) is stored.
const PREFIX = 'sre.c:';
const MAX_CHARS = 150000;
const SKIP = /(proof|photo|video)$/;

export const modelOf = (action) => String(action).split('.')[0];

export function createSwr({ call, storage, userKey, onSync = () => {} }) {
  const mem = new Map();
  let running = 0, holdFresh = false;
  const loaded = new Map();                          // model -> keys fetched from the server since the app opened (in memory only, so a new launch fetches again)
  let touched = new Set();                           // models the current screen has asked for, so Sync refreshes this screen and no other
  const idleWaiters = [];
  const key = (action, payload) => `${PREFIX}${userKey() || ''}|${action}|${JSON.stringify(payload || {})}`;
  const cacheable = (action) => !SKIP.test(action);
  function read(k) {
    if (mem.has(k)) return mem.get(k);
    try { const raw = storage?.getItem(k); if (raw) { const v = JSON.parse(raw); mem.set(k, v); return v; } } catch { /* storage unavailable */ }
    return null;
  }
  function write(k, data) {
    const v = { at: Date.now(), data };
    mem.set(k, v);
    try { const raw = JSON.stringify(v); if (raw.length <= MAX_CHARS) storage?.setItem(k, raw); } catch { /* full or blocked: memory copy still works */ }
  }
  const isLoaded = (k, model) => loaded.get(model)?.has(k) === true;
  function markLoaded(model, k) { if (!loaded.has(model)) loaded.set(model, new Set()); if (k) loaded.get(model).add(k); }
  // Models whose data is no longer known to be fresh: the next visit to a screen that reads them fetches again. No argument: every model.
  function resetLoaded(models) { if (!models) loaded.clear(); else models.forEach((m) => loaded.delete(m)); }
  // A bulk load (one call that returns several models' answers) stores them here and marks each model as loaded, so no screen fetches them again.
  function fill(entries) { entries.forEach(([action, payload, data]) => { if (!cacheable(action)) return; const k = key(action, payload); write(k, data); markLoaded(modelOf(action), k); }); }
  function clear() {
    mem.clear(); loaded.clear();
    try { if (storage) Object.keys(storage).filter((k) => k.startsWith(PREFIX)).forEach((k) => storage.removeItem(k)); } catch { /* ignore */ }
  }
  // cb(data, { stale }) is called with the stored answer first (stale: true) when there is one, then with the fresh one. Resolves with the latest data.
  async function swr(action, payload, cb) {
    const k = key(action, payload), model = modelOf(action), hit = cacheable(action) ? read(k) : null;
    touched.add(model);
    if (hit && isLoaded(k, model)) { cb(hit.data, { stale: false }); return hit.data; }       // already fetched in this run: no request
    if (hit) cb(hit.data, { stale: true });
    if (hit && holdFresh) return hit.data;             // a re-draw with no new data (language change): the stored answer is enough
    onSync(++running);
    try {
      const data = await call(action, payload);
      if (cacheable(action)) { write(k, data); markLoaded(model, k); }
      cb(data, { stale: false });
      return data;
    } catch (e) {
      if (hit) return hit.data;                         // offline or failing: keep showing what we have
      throw e;
    } finally { onSync(--running); if (running === 0) idleWaiters.splice(0).forEach((f) => f()); }
  }
  // Several reads for one screen: cb(results[], { stale }) runs once every read has an answer (stored or fresh), and again as each fresh one arrives.
  async function many(specs, cb) {
    const latest = new Array(specs.length), have = new Array(specs.length).fill(false), fresh = new Array(specs.length).fill(false);
    const push = () => { if (have.every(Boolean)) cb(latest.slice(), { stale: !fresh.every(Boolean) }); };
    await Promise.all(specs.map(([action, payload], i) => swr(action, payload || {}, (d, m) => { latest[i] = d; have[i] = true; fresh[i] = !m.stale; push(); })));
    return latest;
  }
  // Run fn (a re-draw) with stored answers served as they are, without asking the server again.
  // The flag stays on briefly after fn returns, because views ask for their data a moment after they are drawn.
  async function withoutRefresh(fn) { holdFresh = true; try { return await fn(); } finally { setTimeout(() => { holdFresh = false; }, 1500); } }
  // A new screen starts: from now on 'touched' is the models this screen reads.
  function beginScreen() { touched = new Set(); }
  // The member pressed Sync: the models this screen reads are fetched again (stored answers shown first, replaced when the fresh ones arrive), then fn re-draws it.
  async function refreshScreen(fn) { resetLoaded([...touched]); return fn(); }
  // Resolves when no request is running (at once if none is); the pull-down indicator waits for it.
  function whenIdle() { return running === 0 ? Promise.resolve() : new Promise((res) => { idleWaiters.push(res); }); }
  return { swr, many, clear, resetLoaded, markLoaded, fill, withoutRefresh, beginScreen, refreshScreen, whenIdle, peek: (action, payload) => (cacheable(action) ? read(key(action, payload))?.data : undefined) };
}
