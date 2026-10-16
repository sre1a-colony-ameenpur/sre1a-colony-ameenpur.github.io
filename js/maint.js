// Pure helpers for maintenance data (shapes follow contracts/api.md: maintenance.mine, rates.list, totals).
export const ymNow = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return ymNow(d);
}
// Fee in force for a month: latest rate whose from_month <= month, or null.
export function rateFor(rates, month) {
  let best = null;
  for (const r of rates) if (r.from_month <= month && (!best || r.from_month > best.from_month)) best = r;
  return best ? best.amount_paise : null;
}
// Home / header summary from maintenance.mine: balance, oldest unpaid month, and the month paid up to.
export function summarize(mine) {
  const months = [...mine.months].sort((a, b) => a.month.localeCompare(b.month));
  const firstOpen = months.find((m) => m.status !== 'paid');
  const paid = months.filter((m) => m.status === 'paid' && (!firstOpen || m.month < firstOpen.month));
  return {
    balance: mine.balance_paise,
    credit: mine.credit_paise,
    paidUpTo: paid.length ? paid[paid.length - 1].month : '',
    due: firstOpen ? { month: firstOpen.month, remaining_paise: firstOpen.amount_paise - firstOpen.paid_paise, status: firstOpen.status } : null,
  };
}
// Status of one calendar month for the 12-month grid.
export function tileStatus(mine, month, now = ymNow()) {
  const row = mine.months.find((m) => m.month === month);
  if (row) return row.status;           // paid | partly_paid | unpaid
  return month > now ? 'future' : 'none';
}
export const currentTotals = (totals, month = ymNow()) => totals.months.find((m) => m.month === month) || { month, collected_paise: 0, outstanding_paise: 0 };
