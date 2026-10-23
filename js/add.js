// Restaurant toevoegen: zoeken op naam via Google, of zelf invullen met een speld op de kaart.

import { state, cityById } from './state.js';
import { openSheet } from './sheets.js';
import { esc, toast, errorText, priceHtml } from './util.js';
import { icon } from './icons.js';
import { categoryPickerHtml, bindCategoryPicker, priceChoiceHtml, bindPriceChoice, placeResultsHtml, spinner, mediaHtml } from './ui.js';
import { pickerMap } from './mapview.js';
import { openState } from './hours.js';
import * as data from './data.js';

const existingByPlaceId = () => new Map(state.restaurants.filter((r) => r.google_place_id).map((r) => [r.google_place_id, r]));

/**
 * Zoekveld + resultaten. onPick(place) bij een nieuw restaurant, onExisting(restaurant) als het al op de lijst staat.
 */
export function mountPlaceSearch(container, { cityId, initialQuery = '', onPick, onExisting, onManual, ignoreId = null }) {
  container.innerHTML = `
    <form class="psearch" data-form novalidate>
      <label class="field">
        <span class="field__label">Naam van het restaurant</span>
        <span class="psearch__row">
          <input class="input" name="q" type="search" placeholder="bv. Gigi" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" value="${esc(initialQuery)}">
          <button class="btn btn--ink" type="submit">Zoeken</button>
        </span>
      </label>
      <p class="field__hint">We zoeken in ${esc(cityById(cityId).name)} en omgeving.</p>
    </form>
    <div class="psearch__results" data-results aria-live="polite"></div>
    ${onManual ? `<button type="button" class="linkbtn" data-manual>${icon('pin')}Niet gevonden? Zelf toevoegen</button>` : ''}`;

  const form = container.querySelector('[data-form]');
  const input = form.querySelector('input');
  const out = container.querySelector('[data-results]');
  let results = [];
  let seq = 0;

  async function run() {
    const q = input.value.trim();
    if (q.length < 2) {
      out.innerHTML = '<p class="note">Typ minstens twee letters.</p>';
      return;
    }
    const mine = ++seq;
    out.innerHTML = `<p class="note">${spinner('Zoeken')} Zoeken naar “${esc(q)}”…</p>`;
    try {
      const found = await data.searchPlaces(q, cityId);
      if (mine !== seq) return;
      results = found;
      const existing = existingByPlaceId();
      if (ignoreId) for (const [k, v] of existing) if (v.id === ignoreId) existing.delete(k);
      out.innerHTML = placeResultsHtml(results, existing);
    } catch (err) {
      if (mine !== seq) return;
      out.innerHTML = `<p class="note note--error">Zoeken lukte niet: ${esc(errorText(err))}.</p>`;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    input.blur();
    run();
  });
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.places__item');
    if (item) {
      const place = results[Number(item.dataset.index)];
      const existing = existingByPlaceId().get(place.google_place_id);
      if (existing && existing.id !== ignoreId) onExisting?.(existing);
      else onPick(place);
      return;
    }
    if (e.target.closest('[data-manual]')) onManual?.(input.value.trim());
  });

  if (initialQuery) run();
  else setTimeout(() => input.focus({ preventScroll: true }), 320);
  return { run };
}

export function openAddSheet({ onAdded, onOpenExisting }) {
  const city = cityById(state.city);
  const sheet = openSheet({ title: `Restaurant toevoegen in ${city.name}`, size: 'tall', className: 'sheet--add' });
  let picker = null;
  const cleanupMaps = () => {
    picker?.destroy();
    picker = null;
  };
  const origClose = sheet.close;
  sheet.close = () => {
    cleanupMaps();
    origClose();
  };

  function stepSearch(query = '') {
    cleanupMaps();
    sheet.setTitle(`Restaurant toevoegen in ${city.name}`);
    sheet.setFoot('');
    sheet.foot.onclick = null;
    const box = document.createElement('div');
    sheet.body.replaceChildren(box);
    mountPlaceSearch(box, {
      cityId: city.id,
      initialQuery: query,
      onPick: (place) => stepDetails({ place }),
      onExisting: (r) => {
        sheet.close();
        toast(`${r.name} staat al op de lijst`);
        onOpenExisting?.(r.id);
      },
      onManual: (q) => stepDetails({ manualName: q }),
    });
  }

  function stepDetails({ place = null, manualName = '' }) {
    cleanupMaps();
    const selected = new Set();
    let price = place?.price_level || null;
    let point = null;
    const name = place?.name || manualName || '';
    sheet.setTitle(place ? 'Klopt dit?' : 'Zelf toevoegen');
    const os = place ? openState(place.opening_hours ? { ...place.opening_hours, permanently_closed: place.permanently_closed } : null) : null;
    sheet.body.innerHTML = `
      <button type="button" class="linkbtn linkbtn--back" data-back>${icon('chevronLeft')}Terug naar zoeken</button>
      ${
        place
          ? `<div class="found">
              ${mediaHtml({ id: place.google_place_id, name: place.name, google_place_id: place.google_place_id, categories: [] }, { cls: 'found__media', eager: true })}
              <div class="found__text">
                <p class="found__name">${esc(place.name)}</p>
                <p class="found__addr">${esc(place.address || '')}</p>
                <p class="found__meta">${priceHtml(place.price_level)}${os?.known ? `<span class="${os.open ? 'open-now' : ''}">${esc(os.text)}</span>` : ''}</p>
              </div>
            </div>`
          : ''
      }
      <label class="field">
        <span class="field__label">Naam</span>
        <input class="input" data-name value="${esc(name)}" autocomplete="off" placeholder="Naam van het restaurant">
      </label>
      ${
        place
          ? ''
          : `<label class="field">
              <span class="field__label">Adres <span class="field__opt">optioneel</span></span>
              <input class="input" data-address autocomplete="off" placeholder="Straat en nummer">
            </label>
            <div class="field">
              <span class="field__label">Locatie</span>
              <div class="picker" data-picker></div>
              <p class="field__hint" data-picker-hint>Tik op de kaart om de speld te zetten.</p>
            </div>`
      }
      <div class="field">
        <span class="field__label">Categorie</span>
        ${categoryPickerHtml(state.categories, selected)}
      </div>
      <label class="field">
        <span class="field__label">Keuken <span class="field__opt">optioneel</span></span>
        <input class="input" data-note autocomplete="off" placeholder="bv. Thais, ribbetjes, pasta">
      </label>
      <div class="field">
        <span class="field__label">Prijs</span>
        <div data-price-box>${priceChoiceHtml(price)}</div>
      </div>`;
    sheet.setFoot(`<button type="button" class="btn btn--ink btn--block" data-save>Op de lijst zetten</button>`);

    bindCategoryPicker(sheet.body.querySelector('.catpick'), selected);
    bindPriceChoice(sheet.body.querySelector('[data-price-box]'), () => price, (v) => (price = v));
    sheet.body.querySelector('[data-back]').addEventListener('click', () => stepSearch(place ? '' : manualName));

    if (!place) {
      setTimeout(() => {
        const el = sheet.body.querySelector('[data-picker]');
        if (!el) return;
        picker = pickerMap(el, {
          center: city.center,
          point: null,
          onPick: (p) => {
            point = p;
            sheet.body.querySelector('[data-picker-hint]').textContent = 'Speld staat. Versleep of tik opnieuw om te verplaatsen.';
          },
        });
      }, 30);
    }

    const saveBtn = () => sheet.foot.querySelector('[data-save]');
    sheet.foot.onclick = async (e) => {
      if (!e.target.closest('[data-save]')) return;
      const nameVal = sheet.body.querySelector('[data-name]').value.trim();
      if (!nameVal) {
        toast('Geef het restaurant een naam');
        sheet.body.querySelector('[data-name]').focus();
        return;
      }
      if (!place && !point) {
        toast('Zet eerst een speld op de kaart');
        return;
      }
      const note = sheet.body.querySelector('[data-note]').value.trim();
      const row = place
        ? { ...data.placeToColumns(place), city_id: city.id, name: nameVal, cuisine_note: note || null, price_level: price, needs_review: false }
        : {
            city_id: city.id,
            name: nameVal,
            cuisine_note: note || null,
            address: sheet.body.querySelector('[data-address]').value.trim() || null,
            lat: point.lat,
            lng: point.lng,
            price_level: price,
            needs_review: false,
          };
      const btn = saveBtn();
      btn.disabled = true;
      btn.textContent = 'Opslaan…';
      try {
        const id = await data.insertRestaurant(row, [...selected]);
        sheet.close();
        toast(`${nameVal} staat op de lijst`);
        onAdded?.(id);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Op de lijst zetten';
        toast(data.isDuplicate(err) ? 'Dit restaurant staat al op de lijst' : `Opslaan lukte niet: ${errorText(err)}`);
      }
    };
  }

  stepSearch();
  return sheet;
}
