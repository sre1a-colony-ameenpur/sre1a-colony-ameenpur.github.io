// Adding a further page to a list that is already on screen. A page whose rows are already there (a server that answered with the first page again, a retry that
// ran twice) adds nothing, and when a page adds nothing the list stops asking for more, so rows are never shown twice and "load more" cannot loop.
export const rowKey = (x) => (x && x.id !== undefined && x.id !== '' ? String(x.id) : JSON.stringify(x));

// existing: rows shown now; r: the server's answer { items, next_cursor }; keyOf: what identifies a row.
// Returns { items, cursor }: the rows to show and the cursor for the next page (null when there is none, or when this page added nothing).
export function appendPage(existing, r, keyOf = rowKey) {
  const seen = new Set(existing.map(keyOf));
  const fresh = [];
  for (const x of r.items || []) { const k = keyOf(x); if (!seen.has(k)) { seen.add(k); fresh.push(x); } }
  return { items: existing.concat(fresh), cursor: fresh.length ? (r.next_cursor || null) : null };
}
