// Display formatting: money as ₹1,500 (Indian grouping), dates as 12 Oct 2026.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function money(paise) {
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees);
  return '₹' + rupees.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}
export function dateShort(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
// '17:30' -> '5:30 PM'; empty when the time is unknown (meetings saved before times existed).
export function timeShort(hm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hm || '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
export const whenShort = (date, time) => [dateShort(date), timeShort(time)].filter(Boolean).join(', ');
export function dateDM(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function monthLabel(ym) { // '2026-10' -> 'Oct 2026'
  const [y, m] = String(ym).split('-');
  return MONTHS[Number(m) - 1] ? `${MONTHS[Number(m) - 1]} ${y}` : '';
}
export function daysUntil(iso, now = Date.now()) {
  return Math.ceil((new Date(iso).getTime() - now) / 86400000);
}
export function initials(name = '') {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

// Relative age of a timestamp as { key, n } for t(): "just now", "10 secs ago", "1 min ago", "3 hours ago", "2 days ago"; a month or more: { key: 'date' }.
export function relTime(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  if (isNaN(ms)) return { key: 'none' };
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 5) return { key: 'time.now' };
  if (sec < 60) return { key: 'time.secs', n: sec };
  if (sec < 3600) return { key: 'time.mins', n: Math.floor(sec / 60) };
  if (sec < 86400) return { key: 'time.hours', n: Math.floor(sec / 3600) };
  if (sec < 30 * 86400) return { key: 'time.days', n: Math.floor(sec / 86400) };
  return { key: 'date' };
}

// Full date and time in India time, whatever the device's zone is: "17 Oct 2026, 5:33 PM".
export function fullStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })
    .format(d).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

// How long something took, in its largest sensible unit, as { key, n } for t(): seconds up to years (a week = 7 days, a month = 30, a year = 365).
export function duration(ms) {
  const sec = Math.max(0, Math.floor((Number(ms) || 0) / 1000)), day = 86400;
  if (sec < 60) return { key: 'dur.secs', n: sec };
  if (sec < 3600) return { key: 'dur.mins', n: Math.floor(sec / 60) };
  if (sec < day) return { key: 'dur.hours', n: Math.floor(sec / 3600) };
  if (sec < 7 * day) return { key: 'dur.days', n: Math.floor(sec / day) };
  if (sec < 30 * day) return { key: 'dur.weeks', n: Math.floor(sec / (7 * day)) };
  if (sec < 365 * day) return { key: 'dur.months', n: Math.floor(sec / (30 * day)) };
  return { key: 'dur.years', n: Math.floor(sec / (365 * day)) };
}
