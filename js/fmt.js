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
