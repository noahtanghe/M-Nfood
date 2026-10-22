// Detailscherm van één restaurant.

import { PEOPLE, PERSON } from './config.js';
import { byId, distanceTo } from './state.js';
import { esc, formatScore, formatDate, priceHtml, formatDistance, toast, errorText } from './util.js';
import { icon, categoryIcon } from './icons.js';
import { openState, weekRows, todayIndex } from './hours.js';
import { miniMap } from './mapview.js';
import { lockScroll, unlockScroll, openOverlay, confirmDialog } from './sheets.js';
import { openVisitSheet } from './visit.js';
import { openEditSheet } from './edit.js';
import * as data from './data.js';

const page = () => document.getElementById('detail');

let nav = { close: () => {}, reload: async () => {}, openRestaurant: () => {} };
let currentId = null;
let mini = null;
let photos = [];
let photosFor = null;
let weekOpen = false;
let landing = [];
let uploading = null;

export function initDetail(handlers) {
  nav = { ...nav, ...handlers };
  page().addEventListener('click', onClick);
  page().addEventListener('change', onChange);
}

export const detailOpenId = () => currentId;

export function openDetail(id) {
  const r = byId(id);
  if (!r) return false;
  const el = page();
  if (currentId !== id) {
    weekOpen = false;
    photos = [];
    photosFor = null;
  }
  const wasOpen = !el.hidden;
  currentId = id;
  renderFrame(r);
  if (!wasOpen) {
    el.hidden = false;
    lockScroll();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
  }
  el.querySelector('[data-scroll]').scrollTop = 0;
  loadPhotos(id);
  return true;
}

export function closeDetail() {
  const el = page();
  if (el.hidden) return;
  currentId = null;
  el.classList.remove('is-open');
  unlockScroll();
  setTimeout(() => {
    if (currentId) return; // intussen opnieuw geopend
    el.hidden = true;
    mini?.destroy();
    mini = null;
    el.innerHTML = '';
  }, 300);
}

/** Na nieuwe data: hertekenen zonder de kaart opnieuw op te bouwen. */
export function refreshDetail() {
  if (!currentId) return;
  const r = byId(currentId);
  if (!r) {
    nav.close();
    return;
  }
  renderBody(r);
  mini?.update(r);
}

export function photosChanged(restaurantId) {
  if (currentId && (!restaurantId || restaurantId === currentId)) loadPhotos(currentId, { force: true });
}

// ---------- tekenen ----------

function renderFrame(r) {
  mini?.destroy();
  mini = null;
  page().innerHTML = `
    <div class="page__scroll" data-scroll>
      <div class="hero">
        <div class="hero__map" data-hero-map></div>
        <div class="hero__bar">
          <button type="button" class="icon-btn icon-btn--float" data-act="close" aria-label="Terug naar de lijst">${icon('close')}</button>
          <span class="hero__spacer"></span>
          <button type="button" class="icon-btn icon-btn--float" data-act="share" aria-label="Delen">${icon('share')}</button>
          <button type="button" class="icon-btn icon-btn--float" data-act="edit" aria-label="Bewerken">${icon('pencil')}</button>
        </div>
      </div>
      <article class="detail" data-body></article>
    </div>
    <div class="bottombar bottombar--page"><button type="button" class="bottombar__btn" data-act="visit"></button></div>`;
  renderBody(r);
  if (r.lat != null && r.lng != null) {
    setTimeout(() => {
      const el = page().querySelector('[data-hero-map]');
      if (!el || currentId !== r.id) return;
      mini = miniMap(el, r);
      setTimeout(() => mini?.invalidate(), 320);
    }, 20);
  }
}

function renderBody(r) {
  const body = page().querySelector('[data-body]');
  if (!body) return;
  const os = openState(r.opening_hours);
  const dist = distanceTo(r);
  body.innerHTML = `
    <p class="detail__cats">${r.categories.map((c) => `<span class="detail__cat">${categoryIcon(c)}${esc(c)}</span>`).join('') || '<span class="detail__cat">Geen categorie</span>'}</p>
    <h1 class="detail__name">${esc(r.name)}</h1>
    ${r.cuisine_note ? `<p class="detail__kind">${esc(r.cuisine_note)}</p>` : ''}
    ${r.address ? `<p class="detail__addr">${esc(r.address)}</p>` : ''}
    <dl class="facts">
      <div class="facts__cell"><dt>Prijs</dt><dd>${priceHtml(r.price_level, { empty: 'Onbekend' })}</dd></div>
      <div class="facts__cell"><dt>Nu</dt><dd class="${os.open ? 'open-now' : ''}">${os.known ? esc(os.short) : 'Geen uren'}${os.next ? `<small>${esc(os.next)}</small>` : ''}</dd></div>
      ${dist != null ? `<div class="facts__cell"><dt>Afstand</dt><dd>${formatDistance(dist)}</dd></div>` : ''}
    </dl>
    ${actionsHtml(r)}
    ${reviewHtml(r)}
    <section class="visits" aria-label="Onze bezoeken">
      <div class="visits__stamps">${PEOPLE.map((p) => bigStamp(r, p.id)).join('')}</div>
      ${r.noah_score != null && r.marie_score != null ? `<p class="visits__avg">Samen gemiddeld <strong>${formatScore(r.avg_score)}</strong> op 10</p>` : ''}
    </section>
    ${hoursHtml(r, os)}
    ${photosHtml()}`;
  landing = [];
  const btn = page().querySelector('[data-act="visit"]');
  if (btn) {
    const both = r.noah_visited && r.marie_visited;
    btn.innerHTML = `${icon(both ? 'pencil' : 'plus')}${both ? 'Scores aanpassen' : 'We zijn hier geweest'}`;
  }
}

function actionsHtml(r) {
  const items = [];
  if (r.lat != null) {
    items.push(`<a class="action" href="https://maps.apple.com/?daddr=${r.lat},${r.lng}&q=${encodeURIComponent(r.name)}" target="_blank" rel="noopener">${icon('route')}<span>Route</span></a>`);
  }
  const g = r.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address || ''}`)}`;
  items.push(`<a class="action" href="${esc(g)}" target="_blank" rel="noopener">${icon('map')}<span>Google Maps</span></a>`);
  if (r.website) items.push(`<a class="action" href="${esc(r.website)}" target="_blank" rel="noopener">${icon('globe')}<span>Website</span></a>`);
  if (r.phone) items.push(`<a class="action" href="tel:${esc(r.phone.replace(/\s+/g, ''))}">${icon('phone')}<span>Bellen</span></a>`);
  return `<nav class="actions actions--${items.length}" aria-label="Snel naar">${items.join('')}</nav>`;
}

function reviewHtml(r) {
  if (!r.needs_review) return '';
  const why = r.opening_hours?.permanently_closed
    ? 'Google meldt dat deze zaak definitief gesloten is.'
    : !r.google_place_id
      ? 'Niet gevonden in Google, dus de locatie is een schatting.'
      : 'Klopt de gekoppelde vestiging?';
  return `<div class="notice" role="note">
      ${icon('flag')}
      <div class="notice__body">
        <p class="notice__text"><strong>Nog na te kijken.</strong> ${esc(why)}</p>
        <div class="notice__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-act="review-ok">${icon('check')}Klopt</button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="edit">${icon('pencil')}Aanpassen</button>
        </div>
      </div>
    </div>`;
}

function bigStamp(r, pid) {
  const p = PERSON[pid];
  const visited = r[`${pid}_visited`];
  const score = r[`${pid}_score`];
  const date = r[`${pid}_visited_on`];
  const comment = r[`${pid}_comment`];
  const land = landing.includes(pid) ? ' is-landing' : '';
  let seal;
  let label;
  if (!visited) {
    seal = `<span class="bigstamp__none">nog niet</span>`;
    label = `${p.name} was er nog niet. Tik om een bezoek toe te voegen.`;
  } else if (score != null) {
    seal = `<span class="bigstamp__score">${formatScore(score)}</span><span class="bigstamp__of">op 10</span>`;
    label = `${p.name} gaf ${formatScore(score)} op 10. Tik om aan te passen.`;
  } else {
    seal = `<span class="bigstamp__check">${icon('check')}</span><span class="bigstamp__of">geweest</span>`;
    label = `${p.name} was er, nog zonder score. Tik om een score te geven.`;
  }
  return `
    <div class="bigstamp bigstamp--${pid} ${visited ? 'is-visited' : 'is-empty'}">
      <button type="button" class="bigstamp__seal${land}" data-act="stamp" data-pid="${pid}" aria-label="${esc(label)}">${seal}</button>
      <p class="bigstamp__name">${p.name}</p>
      <p class="bigstamp__meta">${visited ? (date ? esc(formatDate(date)) : 'Geweest') : 'Tik om toe te voegen'}</p>
      ${comment ? `<p class="bigstamp__comment">${esc(comment)}</p>` : ''}
    </div>`;
}

function hoursHtml(r, os) {
  const head = (extra = '') => `<div class="block__head"><h2 class="block__title">Openingsuren</h2>${extra}</div>`;
  if (!r.google_place_id) {
    return `<section class="block">${head()}<p class="note">Niet gekoppeld aan Google, dus geen openingsuren.</p>
      <button type="button" class="btn btn--ghost btn--sm" data-act="edit">${icon('link')}Koppelen via Google</button></section>`;
  }
  if (r.opening_hours?.permanently_closed) {
    return `<section class="block">${head()}<p class="note note--error">Volgens Google is deze zaak definitief gesloten.</p></section>`;
  }
  const rows = weekRows(r.opening_hours);
  if (!rows) {
    const tried = !!r.hours_updated_at;
    return `<section class="block">${head()}<p class="note">${tried ? 'Google heeft geen openingsuren voor deze zaak.' : 'Nog niet opgehaald.'}</p>
      <button type="button" class="btn btn--ghost btn--sm" data-act="load-hours">${icon('refresh')}${tried ? 'Opnieuw proberen' : 'Uren ophalen'}</button></section>`;
  }
  const ti = todayIndex();
  return `<section class="block">
      ${head(os.known ? `<span class="block__aside ${os.open ? 'open-now' : ''}">${esc(os.text)}</span>` : '')}
      <table class="hours">
        <tbody>
          ${(weekOpen ? rows : [rows[ti]])
            .map((row) => {
              const isToday = row === rows[ti];
              return `<tr class="${isToday ? 'is-today' : ''}"><th scope="row">${isToday ? 'Vandaag' : esc(row.day)}</th><td>${esc(row.hours)}</td></tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <button type="button" class="linkbtn" data-act="week" aria-expanded="${weekOpen}">${weekOpen ? 'Toon alleen vandaag' : 'Toon de hele week'}${icon(weekOpen ? 'chevronDown' : 'chevronRight')}</button>
    </section>`;
}

function photosHtml() {
  const busy = uploading ? `<span class="block__aside">${esc(uploading)}</span>` : photos.length ? `<span class="block__aside">${photos.length}</span>` : '';
  return `<section class="block">
      <div class="block__head"><h2 class="block__title">Foto's</h2>${busy}</div>
      <div class="photos">
        <label class="photos__add">
          ${icon('camera')}<span>Foto toevoegen</span>
          <input class="sr-only" type="file" accept="image/*" multiple data-photo-input>
        </label>
        ${photos
          .map(
            (p, i) => `<button type="button" class="photos__item" data-act="photo" data-index="${i}" aria-label="Foto ${i + 1} bekijken">
              <img src="${esc(data.photoUrl(data.thumbPath(p.storage_path)))}" alt="" loading="lazy" decoding="async"></button>`,
          )
          .join('')}
      </div>
      ${photos.length ? '' : '<p class="note">Nog geen foto\'s. Maak er een tijdens jullie volgende bezoek.</p>'}
    </section>`;
}

async function loadPhotos(id, { force = false } = {}) {
  if (!force && photosFor === id) return;
  photosFor = id;
  try {
    const list = await data.listPhotos(id);
    if (currentId !== id) return;
    photos = list;
    const r = byId(id);
    if (r) renderBody(r);
  } catch {
    /* foto's zijn bijzaak; de rest van het scherm werkt gewoon */
  }
}

// ---------- acties ----------

async function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const r = byId(currentId);
  if (!r) return;
  switch (btn.dataset.act) {
    case 'close':
      nav.close();
      break;
    case 'share':
      share(r);
      break;
    case 'edit':
      openEditSheet(r, {
        onSaved: () => nav.reload(),
        onDeleted: () => {
          nav.close();
          nav.reload();
        },
        onOpenExisting: (id) => nav.openRestaurant(id),
      });
      break;
    case 'visit':
      openVisitSheet(r, { onSaved: afterVisit });
      break;
    case 'stamp':
      openVisitSheet(r, { person: btn.dataset.pid, onSaved: afterVisit });
      break;
    case 'week':
      weekOpen = !weekOpen;
      renderBody(r);
      break;
    case 'load-hours':
      btn.disabled = true;
      btn.textContent = 'Ophalen…';
      try {
        await data.refreshHours([r], { force: true });
        await nav.reload();
      } catch (err) {
        toast(`Uren ophalen lukte niet: ${errorText(err)}`);
        btn.disabled = false;
        btn.textContent = 'Opnieuw proberen';
      }
      break;
    case 'review-ok':
      try {
        await data.updateRestaurant(r.id, { needs_review: false });
        toast('Gemarkeerd als nagekeken');
        nav.reload();
      } catch (err) {
        toast(`Opslaan lukte niet: ${errorText(err)}`);
      }
      break;
    case 'photo':
      openPhotoViewer(Number(btn.dataset.index));
      break;
    default:
  }
}

function afterVisit(persons) {
  landing = persons;
  nav.reload();
}

async function onChange(e) {
  const input = e.target.closest('[data-photo-input]');
  if (!input || !input.files?.length) return;
  const id = currentId;
  const files = [...input.files];
  input.value = '';
  let done = 0;
  try {
    for (const f of files) {
      uploading = files.length > 1 ? `Uploaden ${done + 1}/${files.length}…` : 'Uploaden…';
      if (currentId === id) renderBody(byId(id));
      await data.uploadPhoto(id, f);
      done += 1;
    }
    toast(done === 1 ? 'Foto toegevoegd' : `${done} foto's toegevoegd`);
  } catch (err) {
    toast(`Foto uploaden lukte niet: ${errorText(err)}`);
  } finally {
    uploading = null;
    if (currentId === id) loadPhotos(id, { force: true });
  }
}

async function share(r) {
  const url = r.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address || ''}`)}`;
  const text = r.address ? `${r.name}, ${r.address}` : r.name;
  if (navigator.share) {
    try {
      await navigator.share({ title: r.name, text, url });
    } catch {
      /* gebruiker annuleerde */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Adres en link gekopieerd');
  } catch {
    toast('Delen lukt niet op dit toestel');
  }
}

function openPhotoViewer(start) {
  let i = start;
  const ov = openOverlay(
    'viewer',
    `<div class="viewer__top">
       <button type="button" class="icon-btn icon-btn--on-ink" data-close aria-label="Sluiten">${icon('close')}</button>
       <span class="viewer__count" data-count></span>
       <button type="button" class="icon-btn icon-btn--on-ink" data-del aria-label="Foto verwijderen">${icon('trash')}</button>
     </div>
     <div class="viewer__stage">
       <button type="button" class="viewer__nav viewer__nav--prev" data-prev aria-label="Vorige foto">${icon('chevronLeft')}</button>
       <img class="viewer__img" data-img alt="">
       <button type="button" class="viewer__nav viewer__nav--next" data-next aria-label="Volgende foto">${icon('chevronRight')}</button>
     </div>`,
  );
  const show = () => {
    if (!photos.length) {
      ov.close();
      return;
    }
    i = (i + photos.length) % photos.length;
    ov.el.querySelector('[data-img]').src = data.photoUrl(photos[i].storage_path);
    ov.el.querySelector('[data-count]').textContent = `${i + 1} / ${photos.length}`;
    ov.el.querySelectorAll('.viewer__nav').forEach((b) => (b.hidden = photos.length < 2));
  };
  ov.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-prev]')) {
      i -= 1;
      show();
    } else if (e.target.closest('[data-next]')) {
      i += 1;
      show();
    } else if (e.target.closest('[data-del]')) {
      const ok = await confirmDialog({ title: 'Foto verwijderen?', message: 'De foto verdwijnt voor jullie allebei.', confirm: 'Verwijderen' });
      if (!ok) return;
      try {
        await data.deletePhoto(photos[i]);
        photos.splice(i, 1);
        toast('Foto verwijderd');
        if (currentId) renderBody(byId(currentId));
        show();
      } catch (err) {
        toast(`Verwijderen lukte niet: ${errorText(err)}`);
      }
    }
  });
  show();
}
