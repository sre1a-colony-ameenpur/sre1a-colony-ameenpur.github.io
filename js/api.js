// API client: one POST endpoint, text/plain JSON, always HTTP 200 (contracts/api.md).
export class ApiError extends Error {
  constructor(code, message, extra) { super(message || code); this.code = code; this.extra = extra; }
}

// Server error codes plus the client-only NETWORK. Message text lives in i18n as err.<CODE>.
export const ERROR_CODES = ['BAD_REQUEST', 'BAD_TOKEN', 'NO_ACCESS', 'FORBIDDEN', 'INVALID', 'NOT_FOUND', 'CONFLICT',
  'ALREADY_VOTED', 'POLL_CLOSED', 'SELF_APPROVAL', 'IMMUTABLE', 'RATE_LIMITED', 'LOCKED', 'SERVER', 'NETWORK'];
export const errorKey = (code) => (ERROR_CODES.includes(code) ? `err.${code}` : 'err.SERVER');
// Plain sentence for a user; never shows the code. `t` is the i18n function.
export const friendly = (err, t) => t(errorKey(err?.code));

export const newReqId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Transport over fetch. A thrown fetch (offline, DNS, timeout) becomes { network: true }.
export function fetchTransport(url, fetchImpl = globalThis.fetch, timeoutMs = 30000) {
  return async (body) => {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl && setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: ctl?.signal,
      });
      return await res.json();
    } catch (e) {
      const err = new Error(e?.message || 'network');
      err.network = true;
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

// createClient({ transport, getIdToken, retries, delayMs, sleep, reqId, onVersion })
// onVersion(version) is called with the backend version every answer carries (errors too), so the app can offer an update when it changes.
// Retries only when the transport reports a network failure, reusing the same reqId (server dedupes writes).
export function createClient({ transport, getIdToken, retries = 2, delayMs = 600,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), reqId = newReqId, onVersion } = {}) {
  async function call(action, payload = {}) {
    const body = { action, idToken: await getIdToken?.(), payload, reqId: reqId() };
    let attempt = 0;
    for (;;) {
      let res;
      try {
        res = await transport(body);
      } catch (e) {
        if (e.network && attempt < retries) { await sleep(delayMs * 2 ** attempt); attempt++; continue; }
        throw new ApiError('NETWORK', e.message);
      }
      if (res?.version) try { onVersion?.(res.version); } catch { /* never fail a call over the version check */ }
      if (res && res.ok === true) return res.data;
      const er = res && res.error;
      throw new ApiError(er?.code || 'SERVER', er?.message, er);
    }
  }
  return { call };
}
