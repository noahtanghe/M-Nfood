// Kleine hulpfuncties die overal gebruikt worden.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function loadLocal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* privémodus of volle opslag: de app werkt ook zonder */
  }
}

export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export function formatScore(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}

export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nl-BE', opts).replace('.', '');
}

const pad = (n) => String(n).padStart(2, '0');
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function priceHtml(level, { empty = '' } = {}) {
  const n = Number(level);
  if (!n) return empty ? `<span class="price price--none">${esc(empty)}</span>` : '';
  return `<span class="price" aria-label="Prijsniveau ${n} van 3">${'€'.repeat(n)}<span class="price__rest" aria-hidden="true">${'€'.repeat(3 - n)}</span></span>`;
}

export function distanceKm(a, b) {
  if (!a || !b || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km) {
  if (km == null) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

export function errorText(err) {
  if (!err) return 'Onbekende fout';
  const msg = err.message || err.error_description || err.msg || String(err);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'geen verbinding';
  return msg;
}

let toastTimer;
export function toast(message, { action, onAction, duration = 3200 } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `<span class="toast__text">${esc(message)}</span>${action ? `<button class="toast__action" type="button">${esc(action)}</button>` : ''}`;
  if (action && onAction) {
    el.querySelector('.toast__action').addEventListener('click', () => {
      el.classList.remove('is-visible');
      onAction();
    });
  }
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), duration);
}
