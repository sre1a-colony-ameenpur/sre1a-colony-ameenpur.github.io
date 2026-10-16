// Strings live in i18n/<lang>.json. Falls back to English, then to the key.
let dict = {};
let fallback = {};
let lang = 'en';

export const LANGS = ['en', 'te'];

// Pure lookup. {name} placeholders; vars.n === 1 picks "<key>.one" when present.
export function translate(d, key, vars = {}, fb = {}) {
  let s = d[key] ?? fb[key] ?? key;
  if (vars.n === 1 && (d[key + '.one'] ?? fb[key + '.one']) != null) s = d[key + '.one'] ?? fb[key + '.one'];
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

export const t = (key, vars) => translate(dict, key, vars, fallback);
export const getLang = () => lang;

export async function loadLang(l, fetchImpl = fetch) {
  const get = async (x) => (await fetchImpl(`i18n/${x}.json`)).json();
  if (!Object.keys(fallback).length) fallback = await get('en');
  lang = LANGS.includes(l) ? l : 'en';
  dict = lang === 'en' ? fallback : await get(lang).catch(() => ({}));
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

// Keys that start with "_" are metadata, not strings.
export const stringKeys = (d) => Object.keys(d).filter((k) => !k.startsWith('_'));
