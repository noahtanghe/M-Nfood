// Zoekscherm: alle zaken van de stad, live gefilterd op naam, keuken, straat of categorie.

import { searchCity, currentCity } from './state.js';
import { esc, debounce } from './util.js';
import { icon } from './icons.js';
import { mediaHtml, stamps, kindLabel } from './ui.js';
import { pushLayer, lockScroll, unlockScroll } from './sheets.js';

export function openSearch({ onOpen }) {
  const city = currentCity();
  const el = document.createElement('div');
  el.className = 'searchpage';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `Zoeken in ${city.name}`);
  el.innerHTML = `
    <div class="searchpage__head">
      <label class="searchfield">
        ${icon('search')}
        <input type="search" placeholder="Zoek in ${esc(city.name)}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Zoek op naam, keuken of straat">
      </label>
      <button type="button" class="searchpage__cancel" data-close>Sluiten</button>
    </div>
    <p class="searchpage__count" data-count aria-live="polite"></p>
    <ul class="srows" data-list></ul>`;
  document.getElementById('sheet-root').append(el);

  const input = el.querySelector('input');
  // Meteen focussen, nog in dezelfde tik: alleen dan opent iOS het toetsenbord.
  input.focus({ preventScroll: true });
  lockScroll();
  let closed = false;
  const release = pushLayer(() => close());
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));

  function render(q) {
    const list = searchCity(q);
    const count = el.querySelector('[data-count]');
    const ul = el.querySelector('[data-list]');
    if (!list.length) {
      count.textContent = '';
      ul.innerHTML = `<li class="srows__empty">Niets gevonden voor “${esc(q.trim())}”. Staat het restaurant nog niet op de lijst? Voeg het toe met de knop onderaan.</li>`;
      return;
    }
    count.textContent = q.trim() ? (list.length === 1 ? '1 resultaat' : `${list.length} resultaten`) : `Alle ${list.length} zaken in ${city.name}`;
    ul.innerHTML = list
      .map(
        (r) => `<li><button type="button" class="srow" data-id="${r.id}">
          ${mediaHtml(r, { cls: 'srow__thumb' })}
          <span class="srow__text"><span class="srow__name">${esc(r.name)}</span><span class="srow__meta">${esc(kindLabel(r))}</span></span>
          ${stamps(r, 'stamps--sm')}
        </button></li>`,
      )
      .join('');
  }

  function close() {
    if (closed) return;
    closed = true;
    release();
    unlockScroll();
    input.blur();
    el.classList.remove('is-open');
    setTimeout(() => el.remove(), 240);
  }

  input.addEventListener('input', debounce(() => render(input.value), 80));
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      close();
      return;
    }
    const row = e.target.closest('[data-id]');
    if (row) {
      close();
      onOpen(row.dataset.id);
    }
  });
  render('');
}
