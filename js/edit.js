// Restaurant bewerken: naam, keuken, prijs, categorieën, locatie, Google-koppeling, verwijderen.

import { state, cityById } from './state.js';
import { openSheet, confirmDialog } from './sheets.js';
import { esc, toast, errorText } from './util.js';
import { icon } from './icons.js';
import { categoryPickerHtml, bindCategoryPicker, priceChoiceHtml, bindPriceChoice } from './ui.js';
import { pickerMap } from './mapview.js';
import { mountPlaceSearch } from './add.js';
import * as data from './data.js';

export function openEditSheet(r, { onSaved, onDeleted, onOpenExisting }) {
  const sheet = openSheet({ title: 'Restaurant bewerken', size: 'tall', className: 'sheet--edit' });
  const catIds = new Set(state.categories.filter((c) => r.categories.includes(c.name)).map((c) => c.id));
  const startCats = [...catIds].sort().join(',');
  let price = r.price_level || null;
  let relinked = null; // gekozen Google-plaats
  let point = null; // handmatig verplaatste speld
  let picker = null;

  const origClose = sheet.close;
  sheet.close = () => {
    picker?.destroy();
    picker = null;
    origClose();
  };

  sheet.body.innerHTML = `
    <label class="field">
      <span class="field__label">Naam</span>
      <input class="input" data-name value="${esc(r.name)}" autocomplete="off">
    </label>
    <label class="field">
      <span class="field__label">Keuken <span class="field__opt">optioneel</span></span>
      <input class="input" data-note value="${esc(r.cuisine_note || '')}" autocomplete="off" placeholder="bv. Thais, ribbetjes, pasta">
    </label>
    <div class="field">
      <span class="field__label">Prijs</span>
      <div data-price-box>${priceChoiceHtml(price)}</div>
    </div>
    <div class="field">
      <span class="field__label">Categorie</span>
      ${categoryPickerHtml(state.categories, catIds)}
    </div>
    <label class="field">
      <span class="field__label">Adres</span>
      <input class="input" data-address value="${esc(r.address || '')}" autocomplete="off" placeholder="Straat en nummer">
    </label>
    <div class="field">
      <span class="field__label">Google-koppeling</span>
      <div class="linkbox" data-linkbox></div>
    </div>
    <div class="field">
      <button type="button" class="linkbtn" data-move>${icon('pin')}Speld op de kaart verplaatsen</button>
      <div class="picker" data-picker hidden></div>
    </div>
    <label class="check">
      <input type="checkbox" data-review ${r.needs_review ? 'checked' : ''}>
      <span>Nog na te kijken</span>
    </label>
    <div class="danger">
      <button type="button" class="linkbtn linkbtn--danger" data-delete>${icon('trash')}${esc(r.name)} van de lijst halen</button>
    </div>`;
  sheet.setFoot(`<button type="button" class="btn btn--ink btn--block" data-save>Wijzigingen opslaan</button>`);

  const $ = (sel) => sheet.body.querySelector(sel);
  bindCategoryPicker($('.catpick'), catIds);
  bindPriceChoice($('[data-price-box]'), () => price, (v) => (price = v));

  function renderLinkbox() {
    const linked = relinked || (r.google_place_id ? { name: r.name, address: r.address } : null);
    $('[data-linkbox]').innerHTML = linked
      ? `<p class="linkbox__text">${relinked ? `Nieuw gekoppeld aan <strong>${esc(relinked.name)}</strong>, ${esc(relinked.address || '')}` : 'Gekoppeld. Adres, uren en prijs komen van Google.'}</p>
         <button type="button" class="btn btn--ghost btn--sm" data-relink>${icon('refresh')}Opnieuw opzoeken</button>`
      : `<p class="linkbox__text">Niet gekoppeld, dus geen openingsuren.</p>
         <button type="button" class="btn btn--ghost btn--sm" data-relink>${icon('link')}Koppelen via Google</button>`;
  }
  renderLinkbox();

  sheet.body.addEventListener('click', async (e) => {
    if (e.target.closest('[data-relink]')) {
      const search = openSheet({ title: 'Opzoeken via Google', size: 'tall' });
      const box = document.createElement('div');
      search.body.append(box);
      mountPlaceSearch(box, {
        cityId: r.city_id,
        initialQuery: r.name,
        ignoreId: r.id,
        onPick: (place) => {
          relinked = place;
          $('[data-address]').value = place.address || '';
          if (place.price_level) {
            price = place.price_level;
            $('[data-price-box]').innerHTML = priceChoiceHtml(price);
          }
          $('[data-review]').checked = false;
          renderLinkbox();
          search.close();
        },
        onExisting: (other) => {
          search.close();
          toast(`Die plaats hoort al bij ${other.name}`, { action: 'Bekijk', onAction: () => onOpenExisting?.(other.id) });
        },
      });
      return;
    }
    if (e.target.closest('[data-move]')) {
      const el = $('[data-picker]');
      el.hidden = false;
      e.target.closest('[data-move]').hidden = true;
      const start = relinked ? { lat: relinked.lat, lng: relinked.lng } : r.lat != null ? { lat: r.lat, lng: r.lng } : null;
      picker = pickerMap(el, { center: cityById(r.city_id).center, point: start, onPick: (p) => (point = p) });
      return;
    }
    if (e.target.closest('[data-delete]')) {
      const ok = await confirmDialog({
        title: `${r.name} van de lijst halen?`,
        message: "Ook de bezoeken, scores en foto's van dit restaurant verdwijnen. Dit kan niet ongedaan gemaakt worden.",
        confirm: 'Van de lijst halen',
      });
      if (!ok) return;
      try {
        await data.deleteRestaurant(r.id);
        sheet.close();
        toast(`${r.name} is van de lijst gehaald`);
        onDeleted?.();
      } catch (err) {
        toast(`Verwijderen lukte niet: ${errorText(err)}`);
      }
    }
  });

  sheet.foot.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    const name = $('[data-name]').value.trim();
    if (!name) {
      toast('Geef het restaurant een naam');
      return;
    }
    const patch = {
      name,
      cuisine_note: $('[data-note]').value.trim() || null,
      price_level: price,
      address: $('[data-address]').value.trim() || null,
      needs_review: $('[data-review]').checked,
    };
    if (relinked) {
      const cols = data.placeToColumns(relinked);
      Object.assign(patch, cols, { address: patch.address || cols.address, price_level: price ?? cols.price_level });
    }
    if (point) Object.assign(patch, { lat: point.lat, lng: point.lng });
    btn.disabled = true;
    btn.textContent = 'Opslaan…';
    try {
      await data.updateRestaurant(r.id, patch);
      if ([...catIds].sort().join(',') !== startCats) await data.setCategories(r.id, [...catIds]);
      sheet.close();
      toast('Wijzigingen opgeslagen');
      onSaved?.();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Wijzigingen opslaan';
      toast(data.isDuplicate(err) ? 'Die Google-plaats hoort al bij een ander restaurant' : `Opslaan lukte niet: ${errorText(err)}`);
    }
  });

  return sheet;
}
