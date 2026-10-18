// Mock backend implementing the API contract for the shell and Home. All data is fictional.
// Token format: "mock:<key>". Keys: see MOCK_USERS. Used only in mock mode.
const R = (v) => v.split('');
const FULL = R('crud');

// Default permissions (ux-spec Part 4). Verbs: c r u d; 'vote' is an extra verb on polls.
const MEMBER_CAPS = {
  complaints: R('cr'), comments: R('cr'), expenses: R('r'), maintenance_payments: R('r'), maintenance_rates: R('r'),
  membership_rates: R('r'), dues: R('r'), events: R('r'), media: R('r'), meetings: R('r'), attendance: R('r'),
  action_items: R('r'), polls: ['r', 'vote'], map_profile: R('r'), plot_change_requests: R('cr'),
};
const COMMITTEE_COMMON = { audit: R('r') };
const CAPS = {
  member: MEMBER_CAPS,
  treasurer: { ...MEMBER_CAPS, ...COMMITTEE_COMMON, expenses: R('cru'), maintenance_payments: R('cr'), complaints: R('r'),
    complaint_stage: R('u'), polls: [...FULL, 'vote'], fee_requests: R('crd'), maintenance_dues: R('c'), action_items: R('ru') },
  gs: { ...MEMBER_CAPS, ...COMMITTEE_COMMON, complaints: FULL, complaint_stage: R('u'), events: FULL, media: FULL,
    meetings: FULL, attendance: R('ru'), action_items: FULL, polls: [...FULL, 'vote'], fee_requests: R('crd'),
    maintenance_dues: R('c'), members: R('r'), roles_config: R('r'), plots: R('r') },
  // President approves expenses and confirms payments; adding expenses and recording payments is the Treasurer's job.
  president: { ...MEMBER_CAPS, ...COMMITTEE_COMMON, complaints: FULL, complaint_stage: R('u'), expenses: R('crud'),
    expense_approval: R('u'), maintenance_payments: R('r'), payment_confirmation: R('u'), maintenance_rates: FULL,
    membership_rates: FULL, events: FULL, media: FULL, meetings: FULL, attendance: R('ru'), action_items: FULL,
    polls: [...FULL, 'vote'], fee_requests: FULL, maintenance_dues: R('cru'), members: FULL, roles_config: R('ru'),
    plots: R('ru'), plot_transfer: R('cr'), plot_change_requests: R('ru'), handover: R('c') },
};
CAPS.lakshmi = CAPS.member;

export const MOCK_USERS = {
  member:    { name: 'Ramesh K.',  email: 'ramesh.k@example.com',  role: 'Member',            plotKeys: ['A-12'],         caps: CAPS.member },
  lakshmi:   { name: 'Lakshmi P.', email: 'lakshmi.p@example.com', role: 'Member',            plotKeys: ['C-49', 'C-50'], caps: CAPS.lakshmi },
  treasurer: { name: 'Madhavi S.', email: 'madhavi.s@example.com', role: 'Treasurer',         plotKeys: ['D-3'],          caps: CAPS.treasurer },
  gs:        { name: 'Kiran B.',   email: 'kiran.b@example.com',   role: 'General Secretary', plotKeys: ['A-7'],          caps: CAPS.gs },
  president: { name: 'Suresh V.',  email: 'suresh.v@example.com',  role: 'President',         plotKeys: ['B-1'],          caps: CAPS.president },
};
// Sign-in outcomes that are not a session.
export const MOCK_STATES = { unlisted: 'NO_ACCESS', removed: 'NO_ACCESS' };

// 88 fictional members: the named ones above plus generated filler.
const FIRST = ['Anil', 'Bhaskar', 'Chitra', 'Deepa', 'Eswar', 'Farida', 'Gopal', 'Hema', 'Indira', 'Jagan', 'Kavitha', 'Lokesh', 'Meena', 'Naresh', 'Padma', 'Qadir', 'Ravi', 'Sarita', 'Tarun', 'Uma', 'Venu', 'Yamini'];
const LAST = 'ABCDGHJKLMNPRSTVW'.split('');
function buildMembers() {
  const named = [
    ...Object.entries(MOCK_USERS).map(([, u]) => ({ name: u.name, email: u.email, role: u.role, plotKeys: u.plotKeys })),
    { name: 'Anand R.', email: 'anand.r@example.com', role: 'Member', plotKeys: ['B-9'] },
    { name: 'Priya N.', email: 'priya.n@example.com', role: 'Vice President', plotKeys: ['A-20'] },
    { name: 'Rao T.', email: 'rao.t@example.com', role: 'Joint Secretary', plotKeys: ['C-3'] },
  ];
  const used = new Set(named.flatMap((m) => m.plotKeys));
  const out = [...named];
  const blocks = [['A', 60], ['B', 17], ['C', 55]];
  let i = 0;
  outer: for (const [b, n] of blocks) {
    for (let k = 1; k <= n; k++) {
      if (out.length >= 88) break outer;
      const key = `${b}-${k}`;
      if (used.has(key)) continue;
      used.add(key);
      const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}.`;
      out.push({ name, email: `member${i + 1}@example.com`, role: 'Member', plotKeys: [key] });
      i++;
    }
  }
  return out.map((m) => ({ ...m, active: true }));
}

const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
const ym = (offset = 0) => { const d = new Date(); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// Permission matrix for the Roles screen: role -> entity -> verbs ('crud' order). Derived from CAPS; mirrors roles.get.
const ROLE_NAMES = ['Member', 'Treasurer', 'Vice President', 'General Secretary', 'Joint Secretary'];
const ENTITIES = ['members', 'plots', 'expenses', 'expense_approval', 'maintenance_rates', 'maintenance_payments', 'payment_confirmation', 'complaints',
  'complaint_stage', 'comments', 'events', 'media', 'meetings', 'attendance', 'notes', 'action_items', 'polls', 'poll_results_early', 'map_profile',
  'membership_rates', 'fee_requests', 'maintenance_dues', 'plot_transfer', 'plot_change_requests', 'roles_config'];
const PRESIDENT_ONLY = { roles_config: 'cud', plot_change_requests: 'ud' };
function buildMatrix() {
  const src = { Member: CAPS.member, Treasurer: CAPS.treasurer, 'Vice President': CAPS.gs, 'General Secretary': CAPS.gs, 'Joint Secretary': CAPS.gs };
  const m = {};
  for (const role of ROLE_NAMES) {
    m[role] = {};
    for (const e of ENTITIES) {
      const own = 'crud'.split('').filter((v) => (src[role][e] || []).includes(v) && !(PRESIDENT_ONLY[e] || '').includes(v)).join('');
      m[role][e] = own;
    }
  }
  m.President = Object.fromEntries(ENTITIES.map((e) => [e, 'crud']));
  return m;
}

export function createMock({ delayMs = 120 } = {}) {
  const members = buildMembers();
  const former = [{ name: 'Vamsi G.', email: 'former.member@example.com', role: 'Member', plotKeys: [], active: false, removed_at: day(-40) }];
  const matrix = buildMatrix();
  const holders = new Set(members.flatMap((m) => m.plotKeys));
  const plotRequests = [];
  const events = [
    { id: 'V1', title: 'Diwali get-together', date: day(10).slice(0, 10), place: 'Community park', description: 'Snacks, games and lamps for everyone. Bring your family.', photos: [] },
    { id: 'V2', title: 'Sports day', date: day(-30).slice(0, 10), place: 'Community park', description: 'Races and cricket for all ages.', photos: ['M91', 'M92'] },
  ];
  const pollState = (q) => (q.status === 'cancelled' ? 'cancelled' : Date.now() < Date.parse(q.opens_at) ? 'upcoming' : Date.now() < Date.parse(q.closes_at) ? 'open' : 'closed');
  const pollView = (q) => ({ id: q.id, question: q.question, type: q.type, result_display: q.result_display, opens_at: q.opens_at, closes_at: q.closes_at, status: pollState(q), cancel_reason: q.cancel_reason });
  const pollResults = (q, u) => {
    const st = pollState(q), early = u === MOCK_USERS.president;
    if (!(st === 'closed' || q.result_display === 'ongoing' || early)) return { poll_id: q.id, status: st, type: q.type, result_display: q.result_display, visible: false };
    const rows = q.options.map((o) => ({ option_id: o.id, text: o.text, n: o.n })), max = Math.max(0, ...rows.map((r) => r.n)), winners = max > 0 ? rows.filter((r) => r.n === max).map((r) => r.option_id) : [];
    const out = { poll_id: q.id, status: st, type: q.type, result_display: q.result_display, visible: true, options: rows, winners, tie: winners.length > 1, members_voted: q.voted.length, members_total: 88 };
    if (q.type === 'open' && u.caps.members) out.choices = q.choices.map((c) => ({ ...c }));
    return out;
  };
  const polls = [
    { id: 'p1', question: 'Should we repaint the compound wall?', type: 'open', result_display: 'after_close', opens_at: day(-1), closes_at: day(2), status: '', options: [{ id: 'o1', text: 'Yes', n: 31 }, { id: 'o2', text: 'No', n: 12 }], voted: [MOCK_USERS.lakshmi.email], choices: [{ member_name: 'Lakshmi P.', option_id: 'o1' }] },
    { id: 'p2', question: 'Choose the Diwali event date', type: 'secret', result_display: 'after_close', opens_at: day(-10), closes_at: day(-3), status: '', options: [{ id: 'o1', text: '25 Oct', n: 34 }, { id: 'o2', text: '26 Oct', n: 18 }], voted: [MOCK_USERS.member.email], choices: [] },
    { id: 'p3', question: 'Preferred time for the general body meeting', type: 'secret', result_display: 'ongoing', opens_at: day(-1), closes_at: day(5), status: '', options: [{ id: 'o1', text: 'Morning', n: 8 }, { id: 'o2', text: 'Evening', n: 14 }], voted: [], choices: [] },
  ];
  const meetings = [
    { id: 'm1', date: day(11).slice(0, 10), time: '17:30', place: 'Community hall', agenda: 'General body meeting\nCompound wall repainting\nDiwali plan\nAccounts for the quarter', notes: '', status: 'scheduled', attendees: [] },
    { id: 'm0', date: day(-12).slice(0, 10), place: 'Community hall', agenda: 'Budget review\nGate repair', notes: 'Wall repaint approved in principle. Quotes to be collected.', status: 'held', attendees: ['A7', 'D3', 'B1', 'C49'] },
  ];
  const actionItems = [
    { id: 'a1', meeting_id: 'm0', text: 'Get wall repaint quotes', owner: 'Kiran B.', owner_email: MOCK_USERS.gs.email, due_date: day(-2).slice(0, 10), status: 'open' },
    { id: 'a2', meeting_id: 'm0', text: 'Collect Diwali contributions', owner: 'Madhavi S.', owner_email: MOCK_USERS.treasurer.email, due_date: day(8).slice(0, 10), status: 'open' },
    { id: 'a3', meeting_id: 'm0', text: 'Fix the gate light', owner: 'Ramesh K.', owner_email: MOCK_USERS.member.email, due_date: day(-9).slice(0, 10), status: 'done' },
  ];
  const itemView = (a, u) => ({ id: a.id, meeting_id: a.meeting_id, text: a.text, owner_name: a.owner, due_date: a.due_date, status: a.status, done_at: '', overdue: a.status === 'open' && a.due_date < new Date().toISOString().slice(0, 10), mine: a.owner_email === u.email });
  const mockPhotos = new Map();                        // email -> profile photo (base64), lost on reload
  const complaintView = (c) => ({ id: c.id, plot_key: c.plot_key, area: c.area, description: c.description, stage: c.stage, raised_by_name: c.raised_by_name, raised_at: c.raised_at, resolved_at: c.resolved_at,
    elapsed_ms: (c.resolved_at ? Date.parse(c.resolved_at) : Date.now()) - Date.parse(c.raised_at) });
  const complaints = [
    { id: 'C1', plot_key: 'B9', area: '', description: 'Street light not working near B-9. It has been dark for three nights.', stage: 'In progress', raised_by_name: 'Anand R.', raised_at: day(-6), resolved_at: '',
      history: [{ from_stage: 'Open', to_stage: 'Acknowledged', by_name: 'Kiran B.', at: day(-5) }, { from_stage: 'Acknowledged', to_stage: 'In progress', by_name: 'Kiran B.', at: day(-3) }],
      comments: [{ id: 'K1', body: 'Electrician will visit on Monday.', author: 'Kiran B.', at: day(-3), photos: [], hidden: false }], photos: ['M1'] },
    { id: 'C2', plot_key: '', area: 'Park', description: 'Broken bench near the swings', stage: 'Open', raised_by_name: 'Lakshmi P.', raised_at: day(-2), resolved_at: '', history: [], comments: [], photos: [] },
    { id: 'C3', plot_key: '', area: 'Gate', description: 'Gate motor makes a loud noise', stage: 'Resolved', raised_by_name: 'Ramesh K.', raised_at: day(-20), resolved_at: day(-14),
      history: [{ from_stage: 'Open', to_stage: 'Resolved', by_name: 'Kiran B.', at: day(-14) }], comments: [], photos: [] },
  ];
  const membershipRates = [{ category: 'house', from_date: '2026-01-01', amount_paise: 500000 }];
  const feeRequests = [
    { id: 'R1', title: 'Diwali get-together contribution', description: 'Snacks and decorations in the park', amount_paise: 50000, deadline: day(10).slice(0, 10), audience: 'all', status: 'active' },
  ];
  const feeDues = [
    ...members.slice(0, 8).map((m, i) => ({ id: 'D' + (100 + i), kind: 'request', request_id: 'R1', title: 'Diwali get-together contribution', amount_paise: 50000, due_date: day(10).slice(0, 10), plot_key: '', email: m.email, member: m.name, paid: i < 3 ? 50000 : 0 })),
    { id: 'D200', kind: 'membership', request_id: '', title: 'Membership fee', amount_paise: 500000, due_date: day(-3).slice(0, 10), plot_key: 'C49', email: MOCK_USERS.lakshmi.email, member: 'Lakshmi P.', paid: 0 },
  ];
  const dueView = (d) => ({ id: d.id, kind: d.kind, request_id: d.request_id, title: d.title, amount_paise: d.amount_paise, due_date: d.due_date, plot_key: d.plot_key,
    status: d.paid >= d.amount_paise ? 'paid' : (d.paid > 0 ? 'partly_paid' : 'due'), overdue: d.paid < d.amount_paise && d.due_date < new Date().toISOString().slice(0, 10), paid_paise: d.paid,
    payments: feePayments.filter((p) => p.due_id === d.id).map((p) => ({ id: p.id, amount_paise: p.amount_paise, status: p.status, at: p.created_at })) });
  const requestSummary = (r) => {
    const ds = feeDues.filter((d) => d.request_id === r.id).map(dueView);
    return { id: r.id, title: r.title, description: r.description, amount_paise: r.amount_paise, deadline: r.deadline, audience: r.audience, status: r.status, recipients: ds.length,
      paid: ds.filter((d) => d.status === 'paid').length, unpaid: ds.filter((d) => d.status !== 'paid').length, overdue: ds.filter((d) => d.overdue).length, collected_paise: ds.reduce((a, d) => a + d.paid_paise, 0) };
  };
  const feePayments = [
    { id: 'Y1', due_id: 'D103', member: members[3].name, plot_key: '', title: 'Diwali get-together contribution', amount_paise: 50000, status: 'awaiting', reverses_id: '', recorded_by_name: 'Madhavi S.', confirmed_by_name: '', created_at: day(-1), by: MOCK_USERS.treasurer.email, has_proof: true },
  ];
  const maintRates = [{ from_month: `${new Date().getFullYear()}-01`, amount_paise: 150000 }];
  // Dues from January of this year up to this month; months up to `cutoff` (a month offset) are paid.
  const monthsFor = (email, cutoffOffset) => {
    const now = ym(0), y = now.slice(0, 4), cut = ym(cutoffOffset), out = [];
    for (let m = 1; `${y}-${String(m).padStart(2, '0')}` <= now; m++) {
      const month = `${y}-${String(m).padStart(2, '0')}`, paid = month <= cut;
      out.push({ month, amount_paise: 150000, paid_paise: paid ? 150000 : 0, status: paid ? 'paid' : 'unpaid' });
    }
    return out;
  };
  const maintPayments = [
    { id: 'P1', member: 'Rao T.', plots: ['C3'], months: [ym(0)], amount_paise: 150000, status: 'awaiting', reverses_id: '', recorded_by_name: 'Madhavi S.', confirmed_by_name: '', confirmed_at: '', created_at: day(-1), by: MOCK_USERS.treasurer.email, has_proof: true },
    { id: 'P2', member: 'Anand R.', plots: ['B9'], months: [ym(-1), ym(0)], amount_paise: 300000, status: 'awaiting', reverses_id: '', recorded_by_name: 'Madhavi S.', confirmed_by_name: '', confirmed_at: '', created_at: day(-2), by: MOCK_USERS.treasurer.email, has_proof: true },
    { id: 'P3', member: 'Kiran B.', plots: ['A7'], months: [ym(-1)], amount_paise: 150000, status: 'confirmed', reverses_id: '', recorded_by_name: 'Madhavi S.', confirmed_by_name: 'Suresh V.', confirmed_at: day(-8), created_at: day(-9), by: MOCK_USERS.treasurer.email, has_proof: true },
  ];
  const PIXEL = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const person = (key) => MOCK_USERS[key];
  const expenses = [
    { id: 'E12', date: `${new Date().getFullYear()}-10-05`, amount_paise: 480000, category: 'Electricity', reason: 'Street lights, September', status: 'approved', by: person('treasurer'), decider: person('president'), at: day(-9), decidedAt: day(-9), proof: true },
    { id: 'E13', date: `${new Date().getFullYear()}-10-10`, amount_paise: 250000, category: 'Repairs', reason: 'Gate repair', status: 'pending', by: person('treasurer'), at: day(-4), proof: true },
    { id: 'E14', date: `${new Date().getFullYear()}-10-11`, amount_paise: 90000, category: 'Gardening', reason: 'Park plants', status: 'rejected', by: person('treasurer'), decider: person('president'), at: day(-3), decidedAt: day(-3), rejectReason: 'Duplicate bill', proof: true },
  ];
  const viewExpense = (e, u) => ({ id: e.id, date: e.date, amount_paise: e.amount_paise, category: e.category, reason: e.reason, status: e.status,
    created_by_name: e.by.name, decided_by_name: e.decider?.name || '', created_at: e.at, decided_at: e.decidedAt || '', reject_reason: e.rejectReason || '',
    reverses_id: e.reverses || '', mine: e.by.email === u.email, has_proof: !!e.proof,
    event_id: e.event_id || '', event_title: events.find((v) => v.id === e.event_id)?.title || '' });
  const dash = (k) => String(k).toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2');
  const memberRow = (m) => ({ email: m.email, email_norm: m.email, name: m.name, mobile: m.mobile || '', plot_keys: m.plotKeys.map((k) => k.replace('-', '')).join(','),
    role: m.role, active: m.active !== false, removed_at: m.removed_at || '', joined_at: m.joined_at || '2024-06-01' });
  let down = false;
  let nextId = 1;

  const ok = (data) => ({ ok: true, data });
  const fail = (code, message, extra) => ({ ok: false, error: { code, message, ...extra } });

  function userFrom(token) {
    const key = String(token || '').replace(/^mock:/, '');
    if (MOCK_STATES[key]) return { err: fail(MOCK_STATES[key], 'Not on the members list') };
    const u = MOCK_USERS[key];
    return u ? { u, key } : { err: fail('BAD_TOKEN', 'Sign in again') };
  }

  const handedOver = () => { try { return JSON.parse(sessionStorage.getItem('mock.handover') || 'null'); } catch { return null; } };

  const handlers = {
    // Same as the real backend: every Home card's data in one answer, keyed by the action the card used to call.
    'home.summary': (u) => {
      const out = {};
      for (const [k, p] of [['expenses.list', {}], ['plotRequests.list', { status: 'Pending' }], ['maintenance.mine', {}], ['dues.mine', {}], ['polls.list', {}], ['meetings.list', {}],
        ['actionItems.list', { status: 'open' }], ['complaints.list', {}], ['events.list', {}], ['maintenance.totals', {}]]) {
        const f = handlers[k]; const r = f && f(u, p);
        if (r && r.ok) out[k] = r.data;
      }
      return ok(out);
    },
    'profile.syncGooglePhoto': () => ok({ skipped: 'no_picture' }),
    'profile.setPhoto': (u, p) => { if (!p.jpegBase64) return fail('INVALID', 'That is not a photo'); mockPhotos.set(u.email, p.jpegBase64); return ok({ saved: true }); },
    'profile.photo': (u) => (mockPhotos.has(u.email) ? ok({ jpegBase64: mockPhotos.get(u.email) }) : fail('NOT_FOUND', 'No photo')),
    'documents.list': () => ok({ items: [['bylaws', 'Association bylaws'], ['ec_en', 'EC rules (English)'], ['ec_te', 'EC rules (తెలుగు)']].map(([slot, title]) => ({ slot, title, has_file: false, uploaded_at: '', uploaded_by_name: '', size_kb: 0 })) }),
    'documents.get': () => fail('NOT_FOUND', 'Not uploaded yet'),
    'documents.upload': () => fail('SERVER', 'Not available in the sample app'),
    'session.get': (u) => {
      const ho = handedOver();                                // after a handover (kept for the tab, so a reload still shows it) the old President is a Member
      const gone = ho && u === MOCK_USERS.president;
      return ok({
        name: u.name, email: u.email, hasPhoto: mockPhotos.has(u.email), role: gone ? 'Member' : u.role, plotKeys: u.plotKeys, showMobile: !!u.showMobile, language: 'en', caps: gone ? CAPS.member : u.caps,
        presidentName: ho ? ho.name : MOCK_USERS.president.name, presidentSince: ho ? ho.at : '',
      });
    },
    'map.plots': async () => {
      const g = await fetch('map/plots.json').then((r) => r.json());
      const nk = (k) => k.replace('-', '');
      const by = new Map(members.flatMap((m) => m.plotKeys.map((k) => [nk(k), m])));
      return ok({
        plots: g.plots.map((p, i) => ({ plot_key: p.key, plot_label: p.label, category: i % 3 ? 'open' : 'house', facing: p.facing[0] || '', located: true,
          owner: by.has(p.key) ? { name: by.get(p.key).name, role: by.get(p.key).role } : null })),
        members: members.map((m) => ({ name: m.name, role: m.role, plot_keys: m.plotKeys.map(nk) })),
      });
    },
    'map.profile': (u, p) => {
      const m = members.find((x) => x.plotKeys.some((k) => k.replace('-', '') === p.plot_key));
      const shows = m && m.name.length % 2 === 0;
      return ok({ plot_key: p.plot_key, plot_label: p.plot_key.replace(/^([A-Z])(\d+)$/, '$1-$2'), category: 'house', facing: 'East', located: true,
        owner: m ? { name: m.name, role: m.role, plot_keys: m.plotKeys.map((k) => k.replace('-', '')), ...(shows ? { mobile: '90000 ' + String(m.email.length).padStart(5, '0') } : {}) } : null,
        profile: m ? { Occupation: 'Engineer' } : undefined });
    },
    'members.directory': (u, p = {}) => {
      const q = String(p.q || '').toLowerCase().replace(/[\s-]/g, '');
      const rows = members.filter((m) => m.active !== false && (!q || `${m.name},${m.plotKeys.join(',')}`.toLowerCase().replace(/[\s-]/g, '').includes(q))).sort((a, b) => a.name.localeCompare(b.name));
      const lim = p.limit || 1000, off = Number(p.before || 0), page = rows.slice(off, off + lim);
      const out = { items: page.map((m) => ({ name: m.name, role: m.role, plot_keys: m.plotKeys.map((k) => k.replace('-', '')) })), total: rows.length, next_cursor: off + lim < rows.length ? String(off + lim) : null };
      if (!off && !q) out.committee = ['President', 'Treasurer', 'Vice President', 'General Secretary', 'Joint Secretary'].map((role) => { const m = members.find((x) => x.role === role); return { role, member: m ? { name: m.name, role, plot_keys: m.plotKeys.map((k) => k.replace('-', '')) } : null }; });
      return ok(out);
    },
    'map.committee': () => ok(['President', 'Treasurer', 'Vice President', 'General Secretary', 'Joint Secretary'].map((role) => {
      const m = members.find((x) => x.role === role);
      return { role, member: m ? { name: m.name, role, plot_keys: m.plotKeys.map((k) => k.replace('-', '')) } : null };
    })),
    'layout.check': async (u, p) => {
      const g = await fetch('map/plots.json').then((r) => r.json());
      const keys = (p.plots || g.plots).map((x) => x.key);
      const on = new Set(keys);
      const missing = members.map((m) => ({ name: m.name, plot_keys: m.plotKeys.map((k) => k.replace('-', '')).filter((k) => !on.has(k)) })).filter((m) => m.plot_keys.length);
      const held = new Set(members.flatMap((m) => m.plotKeys.map((k) => k.replace('-', ''))));
      const cur = new Set(g.plots.map((x) => x.key));
      return ok({ layoutCount: keys.length, membersMissing: missing, layoutPlotsWithoutMember: keys.filter((k) => !held.has(k)),
        ...(p.plots ? { newPlots: keys.filter((k) => !cur.has(k)), removedPlots: [...cur].filter((k) => !on.has(k)) } : {}) });
    },
    'layout.import': () => ok({ added: 0, updated: 0, unlocated: 0 }),
    'members.list': () => ok({ items: [...members, ...former].map(memberRow) }),
    'members.add': (u, p) => {
      const email = String(p.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('INVALID', 'Please use a Gmail address');
      if (!String(p.name || '').trim()) return fail('INVALID', 'Name is needed');
      if (members.some((m) => m.email === email)) return fail('CONFLICT', 'This member already exists');
      if (p.joiningType === 'existing' && u !== MOCK_USERS.president) return fail('FORBIDDEN', 'Only the President can add an existing member');
      const keys = (p.plot_keys || []).map(dash);
      if (!keys.length) return fail('INVALID', 'A member needs at least one plot');
      const taken = keys.find((k) => holders.has(k));
      if (taken) return fail('CONFLICT', `Plot ${taken} already has a member`);
      const fi = former.findIndex((m) => m.email === email);
      if (fi > -1) former.splice(fi, 1);
      members.push({ name: p.name.trim(), email, mobile: p.mobile || '', role: 'Member', plotKeys: keys, active: true, joined_at: p.joinedAt || new Date().toISOString().slice(0, 10) });
      keys.forEach((k) => holders.add(k));
      return ok({ email_norm: email, drive_sync: true, welcome_mail: !/fail/.test(email) });   // an address with "fail" in it shows the failed state
    },
    'members.update': (u, p) => {
      const m = members.find((x) => x.email === String(p.email || '').toLowerCase());
      if (!m) return fail('NOT_FOUND', 'Member not found');
      if (p.role !== undefined) return fail('FORBIDDEN', 'Only the President can change a role, with Set role');
      if (p.plot_keys !== undefined) return fail('INVALID', 'Plots change through a plot request or Plot transfer');
      if (p.name !== undefined) { if (!String(p.name).trim()) return fail('INVALID', 'Name is needed'); m.name = p.name.trim(); }
      if (p.mobile !== undefined) m.mobile = p.mobile;
      return ok({ email_norm: m.email });
    },
    'members.remove': (u, p) => {
      const i = members.findIndex((x) => x.email === String(p.email || '').toLowerCase());
      if (i < 0) return fail('NOT_FOUND', 'Member not found');
      const m = members[i];
      if (m.role === 'President') return fail('CONFLICT', 'The President cannot be removed');
      members.splice(i, 1); m.plotKeys.forEach((k) => holders.delete(k));
      former.push({ ...m, plotKeys: [], active: false, removed_at: new Date().toISOString() });
      return ok({ drive_sync: true });
    },
    'members.setRole': (u, p) => {
      const m = members.find((x) => x.email === String(p.email || '').toLowerCase());
      if (p.role === 'President') return fail('FORBIDDEN', 'The President role changes only by handover');
      if (!ROLE_NAMES.includes(p.role)) return fail('INVALID', 'Unknown role');
      if (!m) return fail('NOT_FOUND', 'Member not found');
      if (m.role === 'President') return fail('FORBIDDEN', 'The President role changes only by handover');
      if (m.role === p.role) return fail('CONFLICT', 'Already has this role');
      const holder = p.role !== 'Member' && members.find((x) => x.role === p.role && x !== m);
      if (holder && !p.replace) return fail('CONFLICT', 'This role is already held', { details: { holder: { name: holder.name, plot_keys: holder.plotKeys.map((k) => k.replace('-', '')) } } });
      if (holder) holder.role = 'Member';
      m.role = p.role;
      return ok({ email_norm: m.email, role: m.role, replaced: holder ? holder.name : null });
    },
    'roles.get': () => ok({ matrix: JSON.parse(JSON.stringify(matrix)), entities: ENTITIES, roles: [...ROLE_NAMES, 'President'] }),
    'roles.set': (u, p) => {
      if (!matrix[p.role] || !ENTITIES.includes(p.entity)) return fail('INVALID', 'Unknown role, record or action');
      if (p.role === 'President') return fail('FORBIDDEN', 'President grants cannot be changed');
      const verbs = 'crud'.split('').filter((v) => p[v] === true);
      if (verbs.some((v) => (PRESIDENT_ONLY[p.entity] || '').includes(v))) return fail('FORBIDDEN', 'Only the President can have this right');
      matrix[p.role][p.entity] = verbs.join('');
      return ok({ grants: matrix[p.role][p.entity] });
    },
    'roles.setMany': (u, p) => {
      for (const q of p.changes || []) { const r = handlers['roles.set'](u, q); if (!r.ok) return r; }
      return ok({ changed: (p.changes || []).length });
    },
    'members.setMobileVisibility': (u, p) => {
      if (typeof p.show !== 'boolean') return fail('INVALID', 'show must be true or false');
      u.showMobile = p.show; return ok({ showMobile: p.show });
    },
    'members.importCheck': () => ok({ rows: [{ row: 2, status: 'new', message: 'New member.', name: 'Anand R.', plots: ['A-14'] }, { row: 3, status: 'update', message: 'Name, mobile or plots will be updated.', name: 'Lakshmi P.', plots: ['C-49', 'D-1'] }, { row: 4, status: 'unchanged', message: 'Already up to date.' }],
      counts: { new: 1, update: 1, unchanged: 1, error: 0 }, feeCount: 0, feeTotalPaise: 0 }),
    'members.importApply': () => ok({ added: 1, updated: 1, unchanged: 1, feesRaised: 0, driveSyncFailed: 0, welcomeMail: { sent: 1, failed: 0 }, remaining: 0, loaded: [{ row: 2, name: 'Anand R.', status: 'added' }, { row: 3, name: 'Lakshmi P.', status: 'updated' }] }),
    'members.handover': (u, p) => {
      if (p.confirm !== 'HANDOVER') return fail('INVALID', 'Type HANDOVER to confirm');
      const m = members.find((x) => x.email === String(p.email || '').toLowerCase());
      if (!m) return fail('NOT_FOUND', 'Member not found');
      try { sessionStorage.setItem('mock.handover', JSON.stringify({ name: m.name, at: new Date().toISOString() })); } catch { /* private mode: the mock just forgets */ }
      return ok({ newPresident: m.name, outgoingRole: 'Member' });
    },
    'dues.forMember': (u, p) => ok({ member: 'Lakshmi P.', items: [{ id: 'D1', kind: 'request', title: 'Gate repair', amount_paise: 30000, paid_paise: 0, outstanding_paise: 30000, due_date: day(10).slice(0, 10), overdue: false }] }),
    'maintenance.removedBalances': () => ok({ items: [], total_paise: 0 }),
    'audit.list': (u, p) => {
      const sample = [
      { ts: day(0).slice(0, 10) + 'T09:12:00.000Z', actor_name: 'Suresh V.', role: 'President', action: 'roles.set', entity: 'roles_config', entity_id: 'Treasurer:events', old: { grants: 'r' }, new: { grants: 'cr' } },
      { ts: day(-1).slice(0, 10) + 'T15:30:00.000Z', actor_name: 'Madhavi S.', role: 'Treasurer', action: 'expenses.create', entity: 'expense', entity_id: 'E12', old: null, new: { title: 'Water tanker', amount_paise: 250000 } },
      { ts: day(-3).slice(0, 10) + 'T11:05:00.000Z', actor_name: 'Suresh V.', role: 'President', action: 'members.add', entity: 'member', entity_id: 'Anand R.', old: null, new: { name: 'Anand R.', role: 'Member' } },
    ];
      const older = Array.from({ length: 60 }, (_, i) => ({ ts: day(-5 - i).slice(0, 10) + 'T10:00:00.000Z', actor_name: 'Madhavi S.', role: 'Treasurer', action: 'expenses.create', entity: 'expense', entity_id: 'E' + (100 - i), old: null, new: null }));
      const q = String(p.q || '').toLowerCase();
      const all = [...sample, ...older].filter((i) => (!p.person || i.actor_name === p.person) && (!p.action || i.action === p.action)
        && (!p.from || i.ts.slice(0, 10) >= p.from) && (!p.to || i.ts.slice(0, 10) <= p.to) && (!q || `${i.actor_name} ${i.action} ${i.entity} ${i.entity_id}`.toLowerCase().includes(q)));
      const start = p.before ? Number(p.before) : 0, limit = p.limit || 50;             // the mock cursor is a plain offset
      return ok({ last_verify: null, items: all.slice(start, start + limit), next_cursor: start + limit < all.length ? String(start + limit) : null });
    },
    'audit.verify': () => ok({ ok: true, checked: 3 }),
    'roles.holders': () => ok({ items: ['President', ...ROLE_NAMES.slice(1)].map((role) => {
      const m = members.find((x) => x.role === role);
      return { role, member: m ? { name: m.name, plot_keys: m.plotKeys.map((k) => k.replace('-', '')) } : null };
    }) }),
    'maintenance.mine': (u) => {
      const ms = monthsFor(u.email, u === MOCK_USERS.lakshmi ? -3 : -1);
      const paid = ms.filter((m) => m.status === 'paid');
      return ok({ plot_keys: u.plotKeys.map((k) => k.replace('-', '')), balance_paise: ms.reduce((a, m) => a + m.amount_paise - m.paid_paise, 0), credit_paise: 0, months: ms,
        payments: paid.length ? [{ id: 'P0', months: paid.map((m) => m.month).join(','), amount_paise: paid.reduce((a, m) => a + m.amount_paise, 0), status: 'confirmed', at: day(-20) }] : [] });
    },
    'maintenance.totals': () => ok({ collected_paise: 9600000, outstanding_paise: 3900000, months: [{ month: ym(0), collected_paise: 9600000, outstanding_paise: 3900000 }] }),
    'maintenance.rates.list': () => ok({ items: maintRates.map((r) => ({ ...r })), last_raised_month: ym(0) }),
    'maintenance.rates.set': (u, p) => {
      if (!(p.amountPaise >= 0) || !/^\d{4}-\d{2}$/.test(p.fromMonth)) return fail('INVALID', 'Check the fee and month');
      if (p.fromMonth <= ym(0)) return fail('INVALID', `A new rate must start after ${ym(0)}, the last month already raised`);
      maintRates.push({ from_month: p.fromMonth, amount_paise: p.amountPaise }); return ok({ from_month: p.fromMonth });
    },
    'maintenance.status': (u, p) => {
      const items = members.filter((m) => m.plotKeys.length).map((m, i) => {
        const ms = monthsFor(m.email, i % 7 === 3 ? -3 : (i % 11 === 5 ? 0 : -1)).find((x) => x.month === p.month);
        return ms ? { member: m.name, plots: m.plotKeys.map((k) => k.replace('-', '')), amount_paise: ms.amount_paise, paid_paise: ms.paid_paise, status: ms.status,
          awaiting_paise: 0, raised_by_name: i % 9 === 0 ? 'Kiran B.' : 'Auto' } : null;
      }).filter(Boolean);
      const counts = { paid: 0, partly_paid: 0, unpaid: 0 }; items.forEach((x) => { counts[x.status]++; });
      return ok({ month: p.month, items, counts });
    },
    'maintenance.payments.list': (u, p) => ok({ items: maintPayments.filter((x) => !p.status || x.status === p.status).map((x) => ({ ...x, mine: x.by === u.email })) }),
    'maintenance.payments.create': (u, p) => {
      const m = members.find((x) => x.plotKeys.some((k) => k.replace('-', '') === p.plotKey));
      if (!m) return fail('INVALID', 'Unknown member');
      if (!p.months?.length || !(p.amountPaise > 0) || !p.proofJpegBase64) return fail('INVALID', 'Check the form');
      maintPayments.unshift({ id: 'P' + nextId++, member: m.name, plots: m.plotKeys.map((k) => k.replace('-', '')), months: [...p.months].sort(), amount_paise: p.amountPaise, status: 'awaiting',
        reverses_id: '', recorded_by_name: u.name, confirmed_by_name: '', confirmed_at: '', created_at: new Date().toISOString(), by: u.email, has_proof: true });
      return ok({ id: maintPayments[0].id });
    },
    'maintenance.payments.confirm': (u, p) => {
      const x = maintPayments.find((y) => y.id === p.id);
      if (!x) return fail('NOT_FOUND', 'Not found');
      if (x.by === u.email) return fail('SELF_APPROVAL', 'Someone else must confirm this');
      Object.assign(x, { status: 'confirmed', confirmed_by_name: u.name, confirmed_at: new Date().toISOString() }); return ok({ id: x.id, status: 'confirmed' });
    },
    'maintenance.payments.reverse': (u, p) => {
      const o = maintPayments.find((y) => y.id === p.id);
      if (!o || o.status !== 'confirmed' || o.reverses_id || maintPayments.some((y) => y.reverses_id === o.id)) return fail('INVALID', 'Only a confirmed payment that has not been reversed can be reversed');
      maintPayments.unshift({ ...o, id: 'P' + nextId++, amount_paise: -o.amount_paise, status: 'awaiting', reverses_id: o.id, recorded_by_name: u.name, by: u.email, has_proof: false, created_at: new Date().toISOString() });
      return ok({ id: maintPayments[0].id });
    },
    'maintenance.payments.proof': () => ok({ jpegBase64: PIXEL }),
    'maintenance.dues.preview': (u, p) => ok({ month: p.month, amount_paise: 150000, will_create: p.month === ym(0) ? 0 : 3, already_have: p.month === ym(0) ? 86 : 83, no_rate: 0, no_plot: 2 }),
    'maintenance.dues.raise': (u, p) => ok({ created: p.month === ym(0) ? 0 : (p.plotKey ? 1 : 3), skipped: p.month === ym(0) ? 86 : 83 }),
    'maintenance.dues.update': (u, p) => (p.month === ym(-3) ? fail('IMMUTABLE', 'A confirmed payment covers this month') : ok({ month: p.month })),
    'members.lookup': (u, p) => {
      const q = String(p.q || '').toLowerCase().replace(/[\s-]/g, '');
      return ok({ items: members.filter((m) => (m.name + ',' + m.plotKeys.join(',')).toLowerCase().replace(/[\s-]/g, '').includes(q)).slice(0, 8).map((m) => ({ name: m.name, plot_keys: m.plotKeys.map((k) => k.replace('-', '')) })) });
    },
    'dues.mine': (u) => ok({ items: feeDues.filter((d) => d.email === u.email).map((d) => dueView(d)) }),
    'feeRequests.list': () => ok({ items: feeRequests.map((r) => requestSummary(r)) }),
    'feeRequests.get': (u, p) => {
      const r = feeRequests.find((x) => x.id === p.id);
      return r ? ok({ request: requestSummary(r), dues: feeDues.filter((d) => d.request_id === r.id).map((d) => ({ ...dueView(d), member_name: d.member })) }) : fail('NOT_FOUND', 'Not found');
    },
    'feeRequests.create': (u, p) => {
      if (p.kind === 'membership') {
        const m = members.find((x) => x.plotKeys.some((k) => k.replace('-', '') === p.plotKey));
        if (!m) return fail('INVALID', 'Not an active member');
        if (feeDues.some((d) => d.kind === 'membership' && d.email === m.email)) return fail('CONFLICT', 'This member already has a membership fee');
        const d = { id: 'D' + nextId++, kind: 'membership', request_id: '', title: 'Membership fee', amount_paise: p.amountPaise, due_date: p.deadline, plot_key: p.plotKey, email: m.email, member: m.name, paid: 0 };
        feeDues.push(d); return ok({ id: d.id });
      }
      if (!p.title || !(p.amountPaise > 0)) return fail('INVALID', 'Check the form');
      if (p.deadline < new Date().toISOString().slice(0, 10)) return fail('INVALID', 'The deadline cannot be in the past');
      const chosen = p.audience === 'all' ? members : members.filter((m) => m.plotKeys.some((k) => (p.memberPlotKeys || []).includes(k.replace('-', ''))));
      if (!chosen.length) return fail('INVALID', 'Choose at least one member');
      const r = { id: 'R' + nextId++, title: p.title, description: p.description || '', amount_paise: p.amountPaise, deadline: p.deadline, audience: p.audience, status: 'active' };
      feeRequests.unshift(r);
      chosen.slice(0, 12).forEach((m) => feeDues.push({ id: 'D' + nextId++, kind: 'request', request_id: r.id, title: r.title, amount_paise: r.amount_paise, due_date: r.deadline, plot_key: '', email: m.email, member: m.name, paid: 0 }));
      return ok({ id: r.id, dues: Math.min(chosen.length, 12) });
    },
    'feeRequests.cancel': (u, p) => {
      const r = feeRequests.find((x) => x.id === p.requestId);
      if (!r) return fail('NOT_FOUND', 'Not found');
      r.status = 'cancelled'; return ok({ id: r.id, dues_cancelled: feeDues.filter((d) => d.request_id === r.id && !d.paid).length });
    },
    'feeRequests.update': (u, p) => {
      const r = feeRequests.find((x) => x.id === p.requestId);
      if (!r) return fail('NOT_FOUND', 'Not found');
      if (p.amountPaise) r.amount_paise = p.amountPaise; if (p.title) r.title = p.title; if (p.deadline) r.deadline = p.deadline; if (p.description !== undefined) r.description = p.description;
      return ok({ id: r.id, dues_changed: 1 });
    },
    'membership.fees.list': () => ok({ items: feeDues.filter((d) => d.kind === 'membership').map((d) => ({ ...dueView(d), member: d.member })) }),
    'membership.rates.list': () => ok({ items: membershipRates.map((r) => ({ ...r })) }),
    'membership.rates.set': (u, p) => {
      if (!['house', 'open'].includes(p.category) || !(p.amountPaise >= 0)) return fail('INVALID', 'Check the fee');
      if (p.fromDate < new Date().toISOString().slice(0, 10)) return fail('INVALID', 'The date cannot be in the past');
      membershipRates.push({ category: p.category, from_date: p.fromDate, amount_paise: p.amountPaise }); return ok({ category: p.category, from_date: p.fromDate });
    },
    'dues.payments.create': (u, p) => {
      const d = feeDues.find((x) => x.id === p.dueId);
      if (!d) return fail('NOT_FOUND', 'Not found');
      if (!(p.amountPaise > 0) || !p.proofJpegBase64) return fail('INVALID', 'Check the form');
      if (d.paid + p.amountPaise > d.amount_paise) return fail('INVALID', 'More than is owed');
      feePayments.unshift({ id: 'Y' + nextId++, due_id: d.id, member: d.member, plot_key: d.plot_key, title: d.title, amount_paise: p.amountPaise, status: 'awaiting', reverses_id: '', recorded_by_name: u.name, confirmed_by_name: '', created_at: new Date().toISOString(), by: u.email, has_proof: true });
      return ok({ id: feePayments[0].id });
    },
    'dues.payments.list': (u, p) => ok({ items: feePayments.filter((x) => !p.status || x.status === p.status).map((x) => ({ ...x, mine: x.by === u.email })) }),
    'dues.payments.confirm': (u, p) => {
      const x = feePayments.find((y) => y.id === p.id);
      if (!x) return fail('NOT_FOUND', 'Not found');
      if (x.by === u.email) return fail('SELF_APPROVAL', 'Someone else must confirm this');
      x.status = 'confirmed'; x.confirmed_by_name = u.name; feeDues.find((d) => d.id === x.due_id).paid += x.amount_paise; return ok({ id: x.id, status: 'confirmed' });
    },
    'dues.payments.reverse': (u, p) => {
      const o = feePayments.find((y) => y.id === p.id);
      if (!o || o.status !== 'confirmed' || o.reverses_id || feePayments.some((y) => y.reverses_id === o.id)) return fail('INVALID', 'Only a confirmed payment that has not been reversed can be reversed');
      feePayments.unshift({ ...o, id: 'Y' + nextId++, amount_paise: -o.amount_paise, status: 'awaiting', reverses_id: o.id, recorded_by_name: u.name, by: u.email, has_proof: false, created_at: new Date().toISOString() });
      return ok({ id: feePayments[0].id });
    },
    'dues.cancel': (u, p) => {
      const d = feeDues.find((x) => x.id === p.dueId);
      if (!d) return fail('NOT_FOUND', 'Not found');
      if (d.paid > 0) return fail('CONFLICT', 'A confirmed payment exists');
      d.status = 'cancelled'; return ok({ id: d.id });
    },
    'dues.payments.proof': () => ok({ jpegBase64: PIXEL }),
    'polls.list': (u) => ok({ items: polls.map((p) => ({ ...pollView(p), my_vote: { voted: p.voted.includes(u.email) } })) }),
    'polls.get': (u, p) => {
      const q = polls.find((x) => x.id === p.id);
      if (!q) return fail('NOT_FOUND', 'Poll not found');
      return ok({ poll: { ...pollView(q), options: q.options.map((o) => ({ option_id: o.id, text: o.text })) }, my_vote: { voted: q.voted.includes(u.email) }, results: pollResults(q, u) });
    },
    'polls.results': (u, p) => { const q = polls.find((x) => x.id === p.pollId); return q ? ok(pollResults(q, u)) : fail('NOT_FOUND', 'Poll not found'); },
    'polls.create': (u, p) => {
      if (!p.question || !Array.isArray(p.options) || p.options.length < 2) return fail('INVALID', 'A poll needs 2 to 10 options');
      const q = { id: 'Q' + nextId++, question: p.question, type: p.type, result_display: p.resultDisplay, opens_at: p.opensAt, closes_at: p.closesAt, status: '', options: p.options.map((text, i) => ({ id: 'o' + (i + 1), text, n: 0 })), voted: [], choices: [] };
      if (Date.parse(q.closes_at) <= Date.parse(q.opens_at)) return fail('INVALID', 'It must close after it opens');
      polls.unshift(q); return ok({ id: q.id });
    },
    'polls.update': (u, p) => {
      const q = polls.find((x) => x.id === p.id);
      if (!q) return fail('NOT_FOUND', 'Poll not found');
      if (q.voted.length) return fail('IMMUTABLE', 'Votes have been cast');
      if (Date.parse(p.closesAt) <= Date.parse(p.opensAt)) return fail('INVALID', 'It must close after it opens');
      Object.assign(q, { question: p.question, type: p.type, result_display: p.resultDisplay, opens_at: p.opensAt, closes_at: p.closesAt });
      if (p.options) q.options = p.options.map((text, i) => ({ id: 'o' + (i + 1), text, n: 0 }));
      return ok({ id: q.id });
    },
    'polls.cancel': (u, p) => { const q = polls.find((x) => x.id === p.id); if (!q) return fail('NOT_FOUND', 'Not found'); q.status = 'cancelled'; q.cancel_reason = p.reason; return ok({ id: q.id }); },
    'polls.vote': (u, p) => {
      const q = polls.find((x) => x.id === p.pollId);
      if (!q) return fail('NOT_FOUND', 'Poll not found');
      if (pollState(q) !== 'open') return fail('POLL_CLOSED', 'This poll is not open for voting');
      if (q.voted.includes(u.email)) return fail('ALREADY_VOTED', 'You have already voted');
      const o = q.options.find((x) => x.id === p.optionId); if (!o) return fail('INVALID', 'Not an option of this poll');
      q.voted.push(u.email); o.n++; if (q.type === 'open') q.choices.push({ member_name: u.name, option_id: o.id });
      return ok({ voted: true });
    },
    'meetings.list': () => ok({ items: meetings.map((m) => ({ id: m.id, date: m.date, time: m.time || '', place: m.place, agenda: m.agenda, status: m.status })) }),
    'meetings.get': (u, p) => {
      const m = meetings.find((x) => x.id === p.id);
      if (!m) return fail('NOT_FOUND', 'Meeting not found');
      const later = meetings.filter((x) => x.date < m.date).map((x) => x.id);
      return ok({ meeting: { id: m.id, date: m.date, time: m.time || '', place: m.place, agenda: m.agenda, notes: m.notes, status: m.status },
        attendees: m.attendees.map((k) => { const mm = members.find((x) => x.plotKeys.some((pk) => pk.replace('-', '') === k)); return { name: mm.name, plot_keys: [k] }; }),
        action_items: actionItems.filter((a) => a.meeting_id === m.id).map((a) => itemView(a, u)), carried_open: actionItems.filter((a) => a.status === 'open' && later.includes(a.meeting_id)).map((a) => itemView(a, u)) });
    },
    'meetings.create': (u, p) => { const m = { id: 'G' + nextId++, date: p.date, time: p.time, place: p.place, agenda: p.agenda || '', notes: '', status: 'scheduled', attendees: [] }; meetings.unshift(m); return ok({ id: m.id }); },
    'meetings.update': (u, p) => { const m = meetings.find((x) => x.id === p.id); if (!m) return fail('NOT_FOUND', 'Not found'); ['notes', 'status', 'place', 'date', 'time', 'agenda'].forEach((k) => { if (p[k] !== undefined) m[k] = p[k]; }); return ok({ id: m.id }); },
    'attendance.set': (u, p) => { const m = meetings.find((x) => x.id === p.meeting_id); if (!m) return fail('NOT_FOUND', 'Not found'); m.attendees = [...new Set(p.plotKeys)]; return ok({ count: m.attendees.length }); },
    'actionItems.list': (u, p) => ok({ items: actionItems.filter((a) => (!p.status || a.status === p.status) && (!p.meeting_id || a.meeting_id === p.meeting_id)).map((a) => itemView(a, u)) }),
    'actionItems.create': (u, p) => {
      const o = members.find((x) => x.plotKeys.some((pk) => pk.replace('-', '') === p.owner_plot_key)); if (!o) return fail('INVALID', 'Not an active member');
      const a = { id: 'A' + nextId++, meeting_id: p.meeting_id, text: p.text, owner: o.name, owner_email: o.email, due_date: p.due_date, status: 'open' }; actionItems.push(a); return ok({ id: a.id });
    },
    'actionItems.update': (u, p) => { const a = actionItems.find((x) => x.id === p.id); if (!a) return fail('NOT_FOUND', 'Not found'); if (p.status) a.status = p.status; return ok({ id: a.id }); },
    'complaints.list': (u, p = {}) => {
      const groups = { open: ['Open', 'Acknowledged'], progress: ['In progress'], resolved: ['Resolved'], closed: ['Closed'] };
      const rows = complaints.map((c, i) => ({ i, c })).filter(({ i, c }) => (p.before === undefined || i < Number(p.before)) && (!p.group || groups[p.group].includes(c.stage))
        && (!p.q || `${c.description} ${c.plot_key} ${c.area}`.toLowerCase().includes(String(p.q).toLowerCase()))).sort((a, b) => b.i - a.i);
      const page = rows.slice(0, p.limit || 30);
      return ok({ items: page.map(({ c }) => ({ ...complaintView(c), comment_count: c.comments.filter((m) => !m.hidden).length })), total: complaints.length,
        next_cursor: rows.length > page.length ? String(page[page.length - 1].i) : null });
    },
    'complaints.get': (u, p) => {
      const c = complaints.find((x) => x.id === p.id);
      if (!c) return fail('NOT_FOUND', 'Complaint not found');
      return ok({ complaint: complaintView(c), history: c.history.map((h) => ({ ...h })), comments: c.comments.filter((m) => !m.hidden).map((m) => ({ id: m.id, body: m.body, author_name: m.author, at: m.at })),
        media: [...c.photos.map((id) => ({ id, parent_type: 'complaint', parent_id: c.id, kind: 'photo', caption: '', at: c.raised_at })), ...c.comments.flatMap((m) => m.photos.map((id) => ({ id, parent_type: 'comment', parent_id: m.id, kind: 'photo', caption: '', at: m.at })))] });
    },
    'complaints.create': (u, p) => {
      const hasPlot = !!p.plot_key, hasArea = !!p.area;
      if (hasPlot === hasArea || !p.description) return fail('INVALID', 'Give either a plot or an area');
      const c = { id: 'C' + nextId++, plot_key: p.plot_key || '', area: p.area || '', description: p.description, stage: 'Open', raised_by_name: u.name, raised_at: new Date().toISOString(), resolved_at: '', history: [], comments: [], photos: [] };
      complaints.unshift(c); return ok({ id: c.id });
    },
    'complaints.stage': (u, p) => {
      const c = complaints.find((x) => x.id === p.id);
      if (!c) return fail('NOT_FOUND', 'Not found');
      const order = ['Open', 'Acknowledged', 'In progress', 'Resolved', 'Closed'];
      if (order.indexOf(p.stage) <= order.indexOf(c.stage)) return fail('CONFLICT', 'A complaint only moves forward');
      c.history.push({ from_stage: c.stage, to_stage: p.stage, by_name: u.name, at: new Date().toISOString() });
      if (!c.resolved_at && order.indexOf(p.stage) >= 3) c.resolved_at = new Date().toISOString();
      c.stage = p.stage; return ok({ id: c.id, stage: c.stage });
    },
    'complaints.close': (u, p) => {
      const c = complaints.find((x) => x.id === p.id);
      if (!c) return fail('NOT_FOUND', 'Not found');
      if (c.raised_by_name !== u.name) return fail('FORBIDDEN', 'Only the person who raised this complaint can do this');
      if (c.stage !== 'Resolved') return fail('CONFLICT', 'Only a resolved complaint can be closed');
      c.history.push({ from_stage: 'Resolved', to_stage: 'Closed', by_name: u.name, at: new Date().toISOString() }); c.stage = 'Closed'; return ok({ id: c.id, stage: c.stage });
    },
    'complaints.reopen': (u, p) => {
      const c = complaints.find((x) => x.id === p.id);
      if (!c) return fail('NOT_FOUND', 'Not found');
      if (c.raised_by_name !== u.name) return fail('FORBIDDEN', 'Only the person who raised this complaint can do this');
      if (c.stage !== 'Resolved' && c.stage !== 'Closed') return fail('CONFLICT', 'Only a resolved or closed complaint can be reopened');
      c.history.push({ from_stage: c.stage, to_stage: 'Open', by_name: u.name, at: new Date().toISOString() }); c.stage = 'Open'; c.resolved_at = ''; return ok({ id: c.id, stage: c.stage });
    },
    'complaints.hide': (u, p) => { const i = complaints.findIndex((x) => x.id === p.id); if (i < 0) return fail('NOT_FOUND', 'Not found'); complaints.splice(i, 1); return ok({ id: p.id }); },
    'comments.create': (u, p) => {
      const c = complaints.find((x) => x.id === p.complaint_id);
      if (!c) return fail('NOT_FOUND', 'Not found');
      const m = { id: 'K' + nextId++, body: p.body, author: u.name, at: new Date().toISOString(), photos: [], hidden: false }; c.comments.push(m); return ok({ id: m.id });
    },
    'comments.hide': (u, p) => { const m = complaints.flatMap((c) => c.comments).find((x) => x.id === p.id); if (!m) return fail('NOT_FOUND', 'Not found'); m.hidden = true; return ok({ id: m.id }); },
    'media.addPhoto': (u, p) => {
      if (!p.jpegBase64) return fail('INVALID', 'Missing photo');
      const id = 'M' + nextId++;
      if (p.parentType === 'event') events.find((e) => e.id === p.parentId)?.photos.push(id);
      else if (p.parentType === 'complaint') complaints.find((c) => c.id === p.parentId)?.photos.push(id);
      else complaints.flatMap((c) => c.comments).find((m) => m.id === p.parentId)?.photos.push(id);
      return ok({ id });
    },
    'media.photo': () => ok({ jpegBase64: PIXEL }),
    'events.list': () => {
      const today = new Date().toISOString().slice(0, 10);
      const v = (e) => ({ id: e.id, title: e.title, date: e.date, place: e.place, description: e.description, photo_count: e.photos.length, cover_media_id: e.photos[0] || '', upcoming: e.date >= today });
      return ok({ items: [...events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)), ...events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date))].map(v) });
    },
    'events.get': (u, p) => {
      const e = events.find((x) => x.id === p.id);
      if (!e) return fail('NOT_FOUND', 'Event not found');
      const linked = expenses.filter((x) => x.event_id === e.id);
      const spend = { total_paise: linked.filter((x) => x.status === 'approved').reduce((a, x) => a + x.amount_paise, 0), pending_paise: linked.filter((x) => x.status === 'pending').reduce((a, x) => a + x.amount_paise, 0), count: linked.length,
        items: linked.map((x) => ({ id: x.id, date: x.date, amount_paise: x.amount_paise, category: x.category, reason: x.reason, status: x.status, is_reversal: !!x.reverses })) };
      return ok({ event: { id: e.id, title: e.title, date: e.date, place: e.place, description: e.description }, media: e.photos.map((id) => ({ id, kind: 'photo', caption: '', at: new Date().toISOString() })), ...(u.caps?.expenses ? { spend } : {}) });
    },
    'events.create': (u, p) => {
      if (!p.title || !/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return fail('INVALID', 'Check the form');
      const e = { id: 'V' + nextId++, title: p.title, date: p.date, place: p.place || '', description: p.description || '', photos: [] }; events.push(e); return ok({ id: e.id });
    },
    'events.update': (u, p) => { const e = events.find((x) => x.id === p.id); if (!e) return fail('NOT_FOUND', 'Not found'); ['title', 'date', 'place', 'description'].forEach((k) => { if (p[k] !== undefined) e[k] = p[k]; }); return ok({ id: e.id }); },
    'events.hide': (u, p) => { const i = events.findIndex((x) => x.id === p.id); if (i < 0) return fail('NOT_FOUND', 'Not found'); events.splice(i, 1); return ok({ id: p.id }); },
    'expenses.list': (u, p = {}) => {
      const rows = expenses.map((e, i) => ({ i, e })).filter(({ i, e }) => (p.before === undefined || i < Number(p.before)) && (!p.status || e.status === p.status)).sort((a, b) => b.i - a.i);
      const page = rows.slice(0, p.limit || 30);
      const year = String(new Date().getFullYear()), approved = expenses.filter((e) => e.status === 'approved');
      const pending = expenses.filter((e) => e.status === 'pending');
      return ok({ items: page.map(({ e }) => viewExpense(e, u)), total: expenses.length, next_cursor: rows.length > page.length ? String(page[page.length - 1].i) : null,
        approved_total_paise: approved.reduce((a, e) => a + e.amount_paise, 0), year_total_paise: approved.filter((e) => String(e.date).startsWith(year)).reduce((a, e) => a + e.amount_paise, 0),
        pending_count: pending.length, pending_for_me: pending.filter((e) => !viewExpense(e, u).mine).length });
    },
    'expenses.get': (u, p) => { const e = expenses.find((x) => x.id === p.id); return e ? ok({ item: viewExpense(e, u), reversed: expenses.some((x) => x.reverses_id === e.id) }) : fail('NOT_FOUND', 'Expense not found'); },
    'expenses.create': (u, p) => {
      if (!(p.amount_paise > 0) || !p.reason || !p.proof_jpeg_base64) return fail('INVALID', 'Check the form');
      const e = { id: 'E' + nextId++, date: p.date, amount_paise: p.amount_paise, category: p.category, reason: p.reason, event_id: p.event_id || '', status: 'pending', by: u, at: new Date().toISOString(), proof: true };
      expenses.unshift(e); return ok({ id: e.id });
    },
    'expenses.approve': (u, p) => {
      const e = expenses.find((x) => x.id === p.id);
      if (!e) return fail('NOT_FOUND', 'Not found');
      if (e.by.email === u.email) return fail('SELF_APPROVAL', 'Someone else must approve this');
      Object.assign(e, { status: 'approved', decider: u, decidedAt: new Date().toISOString() }); return ok({ id: e.id, status: e.status });
    },
    'expenses.reject': (u, p) => {
      const e = expenses.find((x) => x.id === p.id);
      if (!e) return fail('NOT_FOUND', 'Not found');
      if (e.by.email === u.email) return fail('SELF_APPROVAL', 'Someone else must decide this');
      Object.assign(e, { status: 'rejected', decider: u, decidedAt: new Date().toISOString(), rejectReason: p.reason }); return ok({ id: e.id, status: e.status });
    },
    'expenses.update': (u, p) => {
      const e = expenses.find((x) => x.id === p.id);
      if (!e) return fail('NOT_FOUND', 'Not found');
      if (e.status !== 'pending') return fail('CONFLICT', 'Only expenses waiting for approval can be edited');
      ['date', 'amount_paise', 'category', 'reason', 'event_id'].forEach((k) => { if (p[k] !== undefined) e[k] = p[k]; });
      return ok({ id: e.id });
    },
    'expenses.reverse': (u, p) => {
      const o = expenses.find((x) => x.id === p.id);
      if (!o || o.status !== 'approved') return fail('CONFLICT', 'Only approved entries can be reversed');
      if (expenses.some((x) => x.reverses === o.id)) return fail('CONFLICT', 'Already reversed');
      const e = { id: 'E' + nextId++, date: new Date().toISOString().slice(0, 10), amount_paise: -o.amount_paise, category: o.category, reason: `Reversal of ${o.id}: ${p.reason}`, status: 'approved', by: u, decider: u, at: new Date().toISOString(), decidedAt: new Date().toISOString(), reverses: o.id };
      expenses.unshift(e); return ok({ id: e.id });
    },
    'expenses.proof': (u, p) => (expenses.find((x) => x.id === p.id)?.proof ? ok({ jpegBase64: PIXEL }) : fail('NOT_FOUND', 'No screenshot')),
    'plotRequests.list': (u, p) => ok({ items: p.status === 'Pending' ? [{ id: 'r0', member: 'Anand R.', action: 'add', plotKey: 'B-10' }] : [] }),
    'plotRequests.mine': (u) => ok({ items: plotRequests.filter((r) => r.email === u.email).map((r) => ({ id: r.id, member: r.email, action: r.action, plot_key: r.plotKey.replace('-', ''), status: r.status, requested_at: r.createdAt })) }),
    'plotRequests.create': (u, p) => {
      const plotKey = String(p.plotKey || '').toUpperCase();
      if (!/^[A-E]-\d{1,3}$/.test(plotKey)) return fail('NOT_FOUND', 'Unknown plot');
      const mine = u.plotKeys.includes(plotKey);
      if (p.action === 'add' && !mine && holders.has(plotKey)) return fail('CONFLICT', 'Owned by another member', { details: { owner: { name: 'Another member' } } });
      if (p.action === 'add' && mine) return fail('CONFLICT', 'Already yours');
      if (p.action === 'remove' && !mine) return fail('CONFLICT', 'Not yours');
      if (plotRequests.some((r) => r.email === u.email && r.plotKey === plotKey && r.status === 'Pending')) return fail('CONFLICT', 'Duplicate');
      const r = { id: 'r' + nextId++, email: u.email, action: p.action, plotKey, status: 'Pending', createdAt: new Date().toISOString() };
      plotRequests.push(r);
      return ok(r);
    },
    'plotRequests.cancel': (u, p) => {
      const r = plotRequests.find((x) => x.id === p.id && x.email === u.email && x.status === 'Pending');
      if (!r) return fail('NOT_FOUND', 'No such request');
      r.status = 'Cancelled';
      return ok(r);
    },
  };

  // Transport: same shape as fetchTransport, so api.js is unchanged.
  async function transport(body) {
    await new Promise((r) => setTimeout(r, delayMs));
    if (down) { const e = new Error('offline (mock)'); e.network = true; throw e; }
    const { u, err } = userFrom(body.idToken);
    if (err) return err;
    const h = handlers[body.action];
    if (!h) return fail('BAD_REQUEST', 'Not mocked yet: ' + body.action);
    return h(u, body.payload || {});
  }
  return { transport, setDown: (v) => { down = !!v; }, isDown: () => down };
}
