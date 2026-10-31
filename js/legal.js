// Language choice for the privacy and terms pages: the app's stored choice (sre.lang), or ?lang=te. Both texts are in the page; CSS shows one.
(function () {
  var root = document.documentElement, l = 'en';
  try { l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('sre.lang') || 'en'; } catch (e) { /* private mode */ }
  function set(code, save) {
    l = code === 'te' ? 'te' : 'en';
    root.setAttribute('data-l', l);
    root.lang = l;
    document.title = root.getAttribute('data-title-' + l) || document.title;
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.lang === l)); });
    if (save) { try { localStorage.setItem('sre.lang', l); } catch (e) { /* private mode */ } }
  }
  set(l, false);
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.lang button').forEach(function (b) { b.addEventListener('click', function () { set(b.lang, true); }); });
    set(l, false);
  });
})();
