// S4.6 Action items overview: sort open items into Overdue / Due soon (next 7 days) / Later.
export const SOON_DAYS = 7;
export function groupItems(items, todayIso, mineOnly = false) {
  const soonEnd = new Date(Date.parse(todayIso) + SOON_DAYS * 864e5).toISOString().slice(0, 10);
  const out = { overdue: [], soon: [], later: [] };
  for (const a of items) {
    if (a.status !== 'open' || (mineOnly && !a.mine)) continue;
    (a.due_date < todayIso ? out.overdue : a.due_date <= soonEnd ? out.soon : out.later).push(a);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.due_date.localeCompare(b.due_date));
  return out;
}
