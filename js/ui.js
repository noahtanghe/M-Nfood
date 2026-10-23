// Gedeelde stukjes interface: foto's met terugval, stempels, categoriekeuze, prijskeuze.

import { PEOPLE, PERSON, TONES, PHOTO_WIDTH, FUNCTION_URL, SUPABASE_KEY } from './config.js';
import { esc, cap, formatScore } from './util.js';
import { icon, categoryIcon, categoryHue } from './icons.js';

const SHORT = { 'Ontbijt & brunch': 'Brunch', 'Tapas & sharing': 'Tapas', 'Café & bar': 'Café' };

/** Korte naam van een categorie, voor tabs en kaarten. */
export const shortCat = (name) => SHORT[name] || name;

/** Korte omschrijving voor in de lijst: eigen keuken-notitie of de eerste categorie. */
export const kindLabel = (r) => cap(r.cuisine_note || '') || shortCat(r.categories[0] || '');

// ---------- foto's ----------

/** Google-foto's die niet bestaan of niet laden: deze sessie niet opnieuw proberen. */
export const failedPhotos = new Set();
/** Foto's die al eens geladen zijn: bij opnieuw tekenen meteen tonen, zonder opnieuw in te faden. */
const loadedPhotos = new Set();

export const googlePhotoUrl = (placeId) =>
  `${FUNCTION_URL}?action=photo&place=${encodeURIComponent(placeId)}&w=${PHOTO_WIDTH}&key=${encodeURIComponent(SUPABASE_KEY)}`;

export function toneFor(r) {
  const s = String(r.id || r.name || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/**
 * Foto van de zaak (via Google) met een gekleurd vlak + categorie-icoon eronder.
 * Laadt de foto niet, of bestaat ze niet, dan blijft het vlak gewoon staan.
 */
export function mediaHtml(r, { cls = '', photo = true, eager = false, extra = '' } = {}) {
  const placeId = r.google_place_id;
  const img =
    photo && placeId && !failedPhotos.has(placeId)
      ? `<img src="${esc(googlePhotoUrl(placeId))}" alt=""${loadedPhotos.has(placeId) ? ' class="is-loaded"' : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" crossorigin="anonymous" data-place="${esc(placeId)}">`
      : '';
  // zonder foto krijgt het vlak de kleur van de categorie (zelfde tint als de tab bovenaan)
  const cat = r.categories?.[0] || '';
  return `<span class="media ${cls}${cat ? ` hue-${categoryHue(cat)}` : ''}" style="--tone:${toneFor(r)}"><span class="media__fallback" aria-hidden="true">${categoryIcon(cat)}</span>${img}${extra}</span>`;
}

/** Laat foto's zacht verschijnen en ruim mislukte op. Eén keer op document-niveau binden. */
export function bindMedia(root = document) {
  root.addEventListener(
    'load',
    (e) => {
      const img = e.target;
      if (img.tagName !== 'IMG' || !img.parentElement?.classList.contains('media')) return;
      img.classList.add('is-loaded');
      if (img.dataset.place) loadedPhotos.add(img.dataset.place);
    },
    true,
  );
  root.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img.tagName !== 'IMG' || !img.dataset.place) return;
      failedPhotos.add(img.dataset.place);
      img.remove();
    },
    true,
  );
}

// ---------- stempels ----------

export function stampLabel(r, personId) {
  const name = PERSON[personId].name;
  if (!r[`${personId}_visited`]) return `${name}: nog niet geweest`;
  const s = r[`${personId}_score`];
  return s == null ? `${name}: geweest, nog geen score` : `${name}: score ${formatScore(s)} op 10`;
}

/** Ronde stempel per persoon die er was: initiaal + score (of een vinkje zonder score). */
export function stamp(r, personId) {
  if (!r[`${personId}_visited`]) return '';
  const score = r[`${personId}_score`];
  return `<span class="stamp stamp--${personId}" role="img" aria-label="${esc(stampLabel(r, personId))}">
      <span class="stamp__who" aria-hidden="true">${PERSON[personId].initial}</span>
      <span class="stamp__val" aria-hidden="true">${score != null ? formatScore(score) : icon('check')}</span>
    </span>`;
}

/** Stempels van wie er was; leeg als nog niemand geweest is. */
export function stamps(r, cls = '') {
  const inner = PEOPLE.map((p) => stamp(r, p.id)).join('');
  return inner ? `<span class="stamps ${cls}">${inner}</span>` : '';
}

/** Lege of gevulde stempel voor in keuzelijsten (bijvoorbeeld "wie is er geweest?"). */
export const personDot = (personId) =>
  `<span class="stamp stamp--${personId} stamp--plain" aria-hidden="true"><span class="stamp__val">${PERSON[personId].initial}</span></span>`;

// ---------- formulieren ----------

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
