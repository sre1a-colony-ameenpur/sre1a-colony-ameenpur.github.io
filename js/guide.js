// Which parts of the user guide a role sees, and which roles the person may look at. Pure, so it is tested without a browser.
import { SECTIONS } from './guide_content.js';

export const STANDARD_ROLES = ['Member', 'Treasurer', 'Vice President', 'General Secretary', 'Joint Secretary'];
const FULL = ['President', 'Developer'];
export const isFull = (role) => FULL.includes(role);

// rights(entity, verb) for a role: the person's own session caps for themselves; the Roles table (roles.get) for another role.
export function rightsFor(role, { ownRole, can, matrix }) {
  if (isFull(role)) return () => true;
  if (role === ownRole) return can;
  const row = (matrix && matrix[role]) || {};
  return (entity, verb) => String(row[entity] || '').includes(verb);
}

export function visibleSections(role, rights, modOn, sections = SECTIONS) {
  return sections.filter((s) => {
    if (s.mods && !s.mods.some(modOn)) return false;
    if (s.only) return s.only.includes(role);
    if (s.committee) return role !== 'Member';
    if (s.hideIf && s.hideIf.some(([e, v]) => rights(e, v))) return false;
    return !s.needs || s.needs.some(([e, v]) => rights(e, v));
  });
}

// The dropdown: [{ role, enabled }]. President and Developer may look at every role; anyone else sees their own role only (the rest are shown but off).
export function roleChoices(ownRole, knownRoles = []) {
  const all = [...new Set([ownRole, ...STANDARD_ROLES, ...knownRoles.filter((r) => !isFull(r)), 'Developer', 'President'])];
  const order = [...STANDARD_ROLES, ...all.filter((r) => !STANDARD_ROLES.includes(r) && !isFull(r)), 'Developer', 'President'];
  return order.filter((r) => all.includes(r)).map((r) => ({ role: r, enabled: isFull(ownRole) || r === ownRole }));
}

// The guide in another language: titles, intros, steps and picture captions from `te` (section id -> text); anything missing stays English.
export function localise(sections, te) {
  if (!te) return sections;
  return sections.map((s) => {
    const x = te[s.id];
    if (!x) return s;
    return { ...s, title: x.title || s.title, intro: s.intro ? (x.intro || s.intro) : s.intro,
      steps: s.steps.map((st, i) => (x.steps && x.steps[i]) || st),
      shots: (s.shots || []).map((sh) => ({ ...sh, caption: (x.shots && x.shots[sh.id]) || sh.caption })) };
  });
}
