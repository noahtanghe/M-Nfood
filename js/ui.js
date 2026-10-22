// Gedeelde stukjes interface: stempels, categoriekeuze, prijskeuze.

import { PEOPLE, PERSON } from './config.js';
import { esc, cap, formatScore } from './util.js';
import { icon, categoryIcon } from './icons.js';

const SHORT = { 'Ontbijt & brunch': 'Brunch', 'Tapas & sharing': 'Tapas', 'Café & bar': 'Café' };

/** Korte omschrijving voor in de lijst: eigen keuken-notitie of de eerste categorie. */
export const kindLabel = (r) => cap(r.cuisine_note || '') || SHORT[r.categories[0]] || r.categories[0] || '';

export function stampLabel(r, personId) {
  const name = PERSON[personId].name;
  if (!r[`${personId}_visited`]) return `${name}: nog niet geweest`;
  const s = r[`${personId}_score`];
  return s == null ? `${name}: geweest, nog geen score` : `${name}: score ${formatScore(s)} op 10`;
}

/** Kleine stempel (lijst, kaartvoorbeeld): score als die er is, anders de initiaal. */
export function stampSmall(r, personId) {
  const visited = r[`${personId}_visited`];
  const score = r[`${personId}_score`];
  const inner = visited && score != null ? formatScore(score) : PERSON[personId].initial;
  const state = visited ? (score != null ? 'is-scored' : 'is-visited') : 'is-empty';
  return `<span class="stamp stamp--sm stamp--${personId} ${state}" role="img" aria-label="${esc(stampLabel(r, personId))}">${esc(inner)}</span>`;
}

export const stampsSmall = (r) => `<span class="stamps-sm">${PEOPLE.map((p) => stampSmall(r, p.id)).join('')}</span>`;

/** Tegels om categorieën te kiezen in formulieren. */
export function categoryPickerHtml(categories, selectedIds) {
  return `<div class="catpick" role="group" aria-label="Categorieën">${categories
    .map((c) => {
      const on = selectedIds.has(c.id);
      return `<button type="button" class="catpick__item${on ? ' is-on' : ''}" data-cat-id="${c.id}" aria-pressed="${on}">
        <span class="catpick__icon">${categoryIcon(c.name)}</span><span class="catpick__label">${esc(c.name)}</span></button>`;
    })
    .join('')}</div>`;
}

export function bindCategoryPicker(container, selectedIds, onChange) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.catpick__item');
    if (!btn || !container.contains(btn)) return;
    const id = Number(btn.dataset.catId);
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    const on = selectedIds.has(id);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    onChange?.();
  });
}

/** Prijskeuze € / €€ / €€€ (één waarde; opnieuw tikken wist). */
export function priceChoiceHtml(selected) {
  return `<div class="boxes boxes--3" role="radiogroup" aria-label="Prijsniveau">${[1, 2, 3]
    .map((n) => `<button type="button" class="box${selected === n ? ' is-on' : ''}" role="radio" aria-checked="${selected === n}" data-price="${n}">${'€'.repeat(n)}</button>`)
    .join('')}</div>`;
}

export function bindPriceChoice(container, get, set) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-price]');
    if (!btn || !container.contains(btn)) return;
    const n = Number(btn.dataset.price);
    set(get() === n ? null : n);
    container.querySelectorAll('[data-price]').forEach((b) => {
      const on = Number(b.dataset.price) === get();
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  });
}

/** Resultaten van Google Places als keuzelijst. */
export function placeResultsHtml(results, existingByPlaceId) {
  if (!results.length) return `<p class="note">Geen resultaten. Probeer een andere schrijfwijze, of voeg het restaurant zelf toe.</p>`;
  return `<ul class="places">${results
    .map((p, i) => {
      const existing = existingByPlaceId.get(p.google_place_id);
      return `<li><button type="button" class="places__item" data-index="${i}">
        <span class="places__name">${esc(p.name || 'Zonder naam')}</span>
        <span class="places__addr">${esc(p.address || '')}</span>
        ${existing ? `<span class="places__tag">Staat al op de lijst</span>` : ''}
        ${p.permanently_closed ? `<span class="places__tag places__tag--warn">Definitief gesloten</span>` : ''}
      </button></li>`;
    })
    .join('')}</ul>`;
}

export const spinner = (label = 'Laden') => `<span class="spinner" role="status" aria-label="${esc(label)}"></span>`;

export const iconButton = (name, label, attrs = '') =>
  `<button type="button" class="icon-btn" aria-label="${esc(label)}" ${attrs}>${icon(name)}</button>`;
