// Onderbladen (bottom sheets), dialogen en de "bovenste laag sluiten"-logica.

import { esc } from './util.js';
import { icon } from './icons.js';

const layers = []; // open lagen, laatste = bovenste
let lockCount = 0;

export function lockScroll() {
  lockCount += 1;
  document.documentElement.classList.add('is-locked');
}
export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (!lockCount) document.documentElement.classList.remove('is-locked');
}

/** Registreer een laag die met Escape of "terug" gesloten moet kunnen worden. */
export function pushLayer(close) {
  const entry = { close };
  layers.push(entry);
  return () => {
    const i = layers.indexOf(entry);
    if (i >= 0) layers.splice(i, 1);
  };
}

/** Sluit de bovenste laag. Geeft true terug als er iets gesloten werd. */
export function closeTopLayer() {
  const top = layers.at(-1);
  if (!top) return false;
  top.close();
  return true;
}

export const hasOpenLayers = () => layers.length > 0;

function root() {
  return document.getElementById('sheet-root');
}

function animateOpen(el) {
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
}

function removeAfter(el, ms = 280) {
  el.classList.remove('is-open');
  setTimeout(() => el.remove(), ms);
}

/**
 * Open een onderblad. Geeft { el, body, foot, setTitle, close } terug.
 * size: 'auto' (inhoud bepaalt de hoogte) of 'tall' (bijna volledig scherm).
 */
export function openSheet({ title, size = 'auto', className = '', onClose } = {}) {
  const el = document.createElement('div');
  el.className = `sheet ${className}`.trim();
  el.innerHTML = `
    <div class="sheet__backdrop" data-close></div>
    <div class="sheet__panel sheet__panel--${size}" role="dialog" aria-modal="true" aria-labelledby="">
      <div class="sheet__head">
        <h2 class="sheet__title"></h2>
        <button class="icon-btn sheet__x" type="button" data-close aria-label="Sluiten">${icon('close')}</button>
      </div>
      <div class="sheet__body"></div>
      <div class="sheet__foot" hidden></div>
    </div>`;
  const panel = el.querySelector('.sheet__panel');
  const titleEl = el.querySelector('.sheet__title');
  const id = `sheet-title-${Math.random().toString(36).slice(2, 8)}`;
  titleEl.id = id;
  panel.setAttribute('aria-labelledby', id);

  let closed = false;
  let release = () => {};
  const api = {
    el,
    body: el.querySelector('.sheet__body'),
    foot: el.querySelector('.sheet__foot'),
    setTitle(t) {
      titleEl.textContent = t;
    },
    setFoot(html) {
      api.foot.innerHTML = html;
      api.foot.hidden = !html;
    },
    close() {
      if (closed) return;
      closed = true;
      release();
      unlockScroll();
      removeAfter(el);
      onClose?.();
    },
  };
  api.setTitle(title || '');
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
  });
  root().append(el);
  lockScroll();
  release = pushLayer(() => api.close());
  animateOpen(el);
  setTimeout(() => panel.querySelector('.sheet__x')?.focus({ preventScroll: true }), 60);
  return api;
}

/** Bevestigingsdialoog. Resolvet met true (bevestigd) of false. */
export function confirmDialog({ title, message = '', confirm = 'Verwijderen', cancel = 'Annuleren', danger = true }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'dialog';
    el.innerHTML = `
      <div class="dialog__backdrop" data-act="cancel"></div>
      <div class="dialog__card" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="dialog__title">${esc(title)}</h2>
        ${message ? `<p class="dialog__text">${esc(message)}</p>` : ''}
        <div class="dialog__actions">
          <button class="btn btn--ghost" type="button" data-act="cancel">${esc(cancel)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--ink'}" type="button" data-act="ok">${esc(confirm)}</button>
        </div>
      </div>`;
    let done = false;
    let release = () => {};
    const finish = (ok) => {
      if (done) return;
      done = true;
      release();
      unlockScroll();
      removeAfter(el, 200);
      resolve(ok);
    };
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) finish(act === 'ok');
    });
    root().append(el);
    lockScroll();
    release = pushLayer(() => finish(false));
    animateOpen(el);
    setTimeout(() => el.querySelector('[data-act="ok"]')?.focus({ preventScroll: true }), 60);
  });
}

/** Generieke overlay-laag (Verras me, fotoviewer). Geeft { el, close } terug. */
export function openOverlay(className, html, { onClose } = {}) {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  let closed = false;
  let release = () => {};
  const api = {
    el,
    close() {
      if (closed) return;
      closed = true;
      release();
      unlockScroll();
      removeAfter(el, 240);
      onClose?.();
    },
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
  });
  root().append(el);
  lockScroll();
  release = pushLayer(() => api.close());
  animateOpen(el);
  return api;
}
