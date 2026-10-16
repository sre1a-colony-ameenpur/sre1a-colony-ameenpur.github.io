// Public settings only. No secrets, no member data.
export const CONFIG = {
  appName: 'Sai Ram Enclave (SRE 1A)',
  // Public Google OAuth Client ID (safe to publish).
  clientId: '977198897834-9stl04j1ndl2rtsrc9102if3d7url5ou.apps.googleusercontent.com',
  // Apps Script web app (/exec). Public. An empty value means mock mode.
  apiUrl: 'https://script.google.com/macros/s/AKfycbzVB6wqcc9NJ5ObDTPo8MX1ss-T0BvL3iWzdzHuvjnG8Gvxxg8v9GDjeAi_49Jv4aS06A/exec',
  // TODO: link to the colony records folder in Drive (shown on the "app not reachable" screen).
  driveUrl: '',
};

// The dev shortcuts (?mock=1, ?api=, ?as=, ?tab=, ?ctab=) work only when the page is served from this machine.
// A published copy ignores them, so they can never show up for members. No hostname (node tests) counts as local.
export function isDevHost(host = globalThis.location?.hostname) {
  return !host || host === 'localhost' || host === '127.0.0.1';
}

// Mock mode: ?mock=1 on a local page, or no API URL yet.
export function isMock(search = globalThis.location?.search || '', apiUrl = CONFIG.apiUrl, host) {
  return (isDevHost(host) && new URLSearchParams(search).get('mock') === '1') || !apiUrl;
}
