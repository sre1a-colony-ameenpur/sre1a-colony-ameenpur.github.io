// Stale-while-revalidate for read actions: show the last answer from this device at once, fetch a fresh one in the background, then replace it.
// Answers are kept per signed-in member and dropped on sign-out and after any write. Nothing heavy (photos, proofs, videos) is stored.
const PREFIX = 'sre.c:';
const MAX_CHARS = 150000;
const SKIP = /(proof|photo|video)$/;

export function createSwr({ call, storage, userKey, onSync = () => {} }) {
  const mem = new Map();
  let running = 0;
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
  function clear() {
    mem.clear();
    try { if (storage) Object.keys(storage).filter((k) => k.startsWith(PREFIX)).forEach((k) => storage.removeItem(k)); } catch { /* ignore */ }
  }
  // cb(data, { stale }) is called with the stored answer first (stale: true) when there is one, then with the fresh one. Resolves with the latest data.
  async function swr(action, payload, cb) {
    const k = key(action, payload), hit = cacheable(action) ? read(k) : null;
    if (hit) cb(hit.data, { stale: true });
    onSync(++running);
    try {
      const data = await call(action, payload);
      if (cacheable(action)) write(k, data);
      cb(data, { stale: false });
      return data;
    } catch (e) {
      if (hit) return hit.data;                         // offline or failing: keep showing what we have
      throw e;
    } finally { onSync(--running); }
  }
  // Several reads for one screen: cb(results[], { stale }) runs once every read has an answer (stored or fresh), and again as each fresh one arrives.
  async function many(specs, cb) {
    const latest = new Array(specs.length), have = new Array(specs.length).fill(false), fresh = new Array(specs.length).fill(false);
    const push = () => { if (have.every(Boolean)) cb(latest.slice(), { stale: !fresh.every(Boolean) }); };
    await Promise.all(specs.map(([action, payload], i) => swr(action, payload || {}, (d, m) => { latest[i] = d; have[i] = true; fresh[i] = !m.stale; push(); })));
    return latest;
  }
  return { swr, many, clear, peek: (action, payload) => (cacheable(action) ? read(key(action, payload))?.data : undefined) };
}
