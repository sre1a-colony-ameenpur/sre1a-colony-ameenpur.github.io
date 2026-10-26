// Which stored answers a write makes out of date (T243). A write no longer deletes what the device stored: the answers stay on screen and are fetched again
// in the background, but only the models the write can change. Models are the part of the action name before the dot, as in swr.js.
// A write whose model is not listed returns null: every model is fetched again on its next visit (nothing is deleted then either).
const SPEND = ['expenses', 'openingBalance', 'accounts', 'events', 'gallery'];
const MONEY = ['maintenance', 'dues', 'payments', 'membership', 'feeRequests', 'accounts'];
const PEOPLE = ['members', 'plots', 'plotRequests', 'contactRequests', 'map', 'profile', ...MONEY];
const GROUPS = {
  actionItems: ['meetings', 'actionItems'], attendance: ['meetings'], meetings: ['meetings', 'actionItems', 'gallery'],
  comments: ['complaints', 'comments', 'gallery'], complaints: ['complaints', 'comments', 'gallery'],
  contactRequests: PEOPLE, documents: ['documents'],
  dues: MONEY, maintenance: MONEY, payments: MONEY, membership: MONEY, feeRequests: MONEY,
  events: ['events', 'gallery', 'expenses'], expenses: SPEND, openingBalance: SPEND,
  media: ['events', 'complaints', 'meetings', 'gallery'],
  members: PEOPLE, plots: PEOPLE, plotRequests: PEOPLE, layout: PEOPLE, map: PEOPLE, profile: PEOPLE,
  polls: ['polls'], reports: ['reports'], notifications: ['notifications'],
};
// roles.* is deliberately not listed: a role change can alter what every screen may show.
export function staleModels(action) {
  const model = String(action).split('.')[0], group = GROUPS[model];
  return group ? [...new Set([...group, model, 'home', 'audit'])] : null;
}
