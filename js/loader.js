// The colony "Badge Ring" loading icon (from sai-ram-enclave-loaders.html, option 4). The animation styles are in css/components.css.
const NS = 'http://www.w3.org/2000/svg';
const MARKUP = `<circle cx="60" cy="60" r="41" fill="#fff"/>
  <circle cx="60" cy="60" r="52" fill="none" stroke="#e3e9f7" stroke-width="5"/>
  <circle cx="60" cy="60" r="45" fill="none" stroke="#e4f2e6" stroke-width="3"/>
  <circle class="br-a1" cx="60" cy="60" r="52" pathLength="100" fill="none" stroke="#1D3F9A" stroke-width="5" stroke-linecap="round" stroke-dasharray="8 92"/>
  <circle class="br-a2" cx="60" cy="60" r="45" pathLength="100" fill="none" stroke="#2E8B3E" stroke-width="3" stroke-linecap="round" stroke-dasharray="22 78"/>
  <g class="br-e">
    <circle cx="60" cy="47" r="9" fill="#FDB813"/>
    <path d="M60 48 L75 61 V77 H45 V61 Z" fill="#fff"/>
    <path d="M47 59 V76 H73 V59" fill="none" stroke="#1D3F9A" stroke-width="4" stroke-linejoin="round"/>
    <path d="M41 63 L60 47 L79 63" fill="none" stroke="#1D3F9A" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="55" y="62" width="4.5" height="4.5" fill="#1D3F9A"/><rect x="60.5" y="62" width="4.5" height="4.5" fill="#1D3F9A"/>
    <rect x="55" y="67.5" width="4.5" height="4.5" fill="#1D3F9A"/><rect x="60.5" y="67.5" width="4.5" height="4.5" fill="#1D3F9A"/>
    <path d="M44 82 Q60 77 76 82" fill="none" stroke="#6DB33F" stroke-width="3" stroke-linecap="round"/>
  </g>`;

export function badgeRing(size = 96, label = '') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'badge-ring');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = MARKUP;
  return svg;
}
