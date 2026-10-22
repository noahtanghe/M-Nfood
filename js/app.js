// Hoofdscherm, navigatie en het laden/verversen van data.

import { CITIES, STATUSES, SORTS } from './config.js';
import {
  state, savePrefs, filtered, statusCounts, cityRestaurants, byId, currentCity,
  filterKey, activeFilterCount, normalizeRestaurant, distanceTo,
} from './state.js';
import { esc, $, loadLocal, saveLocal, debounce, toast, formatDistance, priceHtml, isCoarsePointer } from './util.js';
import { icon, categoryIcon, hydrateIcons } from './icons.js';
import { kindLabel, stampsSmall } from './ui.js';
import { isOpenNow } from './hours.js';
import * as mapview from './mapview.js';
import { closeTopLayer, pushLayer, lockScroll, unlockScroll } from './sheets.js';
import { initDetail, openDetail, closeDetail, refreshDetail, photosChanged, detailOpenId } from './detail.js';
import { initStats, openStats, closeStats, refreshStats } from './stats.js';
import { openFilterSheet } from './filters.js';
import { openAddSheet } from './add.js';
import { openSurprise } from './surprise.js';
import * as data from './data.js';

let lastFitKey = null;
let catsKey = '';
let internalNav = false;
let releaseFullMap = null;

// ---------- navigatie (hash-routes: #/r/<id>, #/stats) ----------

function go(hash) {
  internalNav = true;
  if (location.hash === hash) route();
  else location.hash = hash;
}

function goBack() {
  if (internalNav && history.length > 1) history.back();
  else location.hash = '';
}

const openRestaurant = (id) => go(`#/r/${id}`);

function route() {
  while (closeTopLayer()) {
    /* sluit open bladen en dialogen */
  }
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('r/')) {
    closeStats();
    const id = decodeURIComponent(h.slice(2));
    if (!openDetail(id) && state.loaded) {
      closeDetail();
      history.replaceState(null, '', location.pathname + location.search);
      toast('Dit restaurant staat niet (meer) op de lijst');
    }
  } else if (h === 'stats') {
    closeDetail();
    openStats();
  } else {
    closeDetail();
    closeStats();
  }
}

// ---------- data ----------

function applyData(d) {
  state.restaurants = (d.restaurants || []).map(normalizeRestaurant);
  state.categories = d.categories || [];
  state.loaded = true;
}

let reloading = null;
let reloadAgain = false;
async function reload({ initial = false } = {}) {
  if (reloading) {
    reloadAgain = true;
    return reloading;
  }
  reloading = (async () => {
    try {
      const d = await data.loadAll();
      applyData(d);
      saveLocal('mn.cache', { restaurants: d.restaurants, categories: d.categories, at: Date.now() });
      state.offline = false;
      state.loadError = null;
    } catch (err) {
      state.loadError = err;
      state.offline = true;
      console.warn('Laden mislukt', err);
    }
    render({ refit: initial });
    refreshDetail();
    refreshStats();
    renderBanner();
  })();
  try {
    await reloading;
  } finally {
    reloading = null;
  }
  if (reloadAgain) {
    reloadAgain = false;
    await reload();
  }
}
const reloadSoon = debounce(() => reload(), 400);

async function maybeRefreshHours() {
  const last = loadLocal('mn.hoursRefreshAt', 0);
  if (Date.now() - last < 6 * 3600e3) return;
  saveLocal('mn.hoursRefreshAt', Date.now());
  try {
    const n = await data.refreshHours(state.restaurants);
    if (n) reloadSoon();
  } catch (err) {
    console.warn('Openingsuren verversen lukte niet:', err.message || err);
  }
}

// ---------- tekenen ----------

function render({ refit = false } = {}) {
  renderCities();
  renderCats();
  renderStatus();
  renderToolbar();
  const list = filtered();
  renderList(list);
  const emptyCity = state.loaded && !cityRestaurants().length;
  const card = $('#mapcard');
  if (card.hidden !== emptyCity) {
    card.hidden = emptyCity;
    $('#legend').hidden = emptyCity;
    if (!emptyCity) {
      refit = true;
      setTimeout(() => {
        mapview.invalidate();
        mapview.fitTo(filtered(), currentCity().center);
      }, 30);
    }
  }
  if (state.selectedId && !list.some((r) => r.id === state.selectedId)) state.selectedId = null;
  mapview.updateMarkers(list, state.selectedId);
  const key = filterKey();
  if (refit || key !== lastFitKey) {
    mapview.fitTo(list, currentCity().center);
    lastFitKey = key;
  }
  renderPreview();
  $('#map-count').textContent = list.length === 1 ? '1 zaak' : `${list.length} zaken`;
}

function renderCities() {
  $('#cities').innerHTML = CITIES.map((c) => {
    const n = state.restaurants.filter((r) => r.city_id === c.id).length;
    const on = c.id === state.city;
    return `<button type="button" class="cities__tab${on ? ' is-on' : ''}" aria-pressed="${on}" data-city="${c.id}">${esc(c.name)}<span class="cities__n">${state.loaded ? n : ''}</span></button>`;
  }).join('');
}

function renderCats() {
  const track = $('#cats');
  const key = state.categories.map((c) => c.name).join('|');
  if (key !== catsKey) {
    catsKey = key;
    const items = [{ name: '', label: 'Alles' }, ...state.categories.map((c) => ({ name: c.name, label: c.name }))];
    track.innerHTML = items
      .map(
        (c) => `<button type="button" class="cat" data-cat="${esc(c.name)}" aria-pressed="false">
          <span class="cat__tile">${c.name ? categoryIcon(c.name) : icon('all')}</span>
          <span class="cat__label">${esc(c.label)}</span></button>`,
      )
      .join('');
  }
  const inCity = cityRestaurants();
  track.querySelectorAll('.cat').forEach((btn) => {
    const name = btn.dataset.cat;
    const on = name ? state.cats.has(name) : state.cats.size === 0;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    if (name) btn.classList.toggle('is-empty', !inCity.some((r) => r.categories.includes(name)));
  });
}

function renderStatus() {
  const bar = $('#statusbar');
  if (!bar.childElementCount) {
    bar.innerHTML = STATUSES.map(
      (s) => `<button type="button" class="status" data-status="${s.id}" aria-pressed="false">${esc(s.label)}<span class="status__n"></span></button>`,
    ).join('');
  }
  const counts = statusCounts();
  bar.querySelectorAll('.status').forEach((btn) => {
    const on = btn.dataset.status === state.status;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.status__n').textContent = state.loaded ? counts[btn.dataset.status] : '';
  });
}

function renderToolbar() {
  const n = activeFilterCount();
  const badge = $('#filter-count');
  badge.hidden = !n;
  badge.textContent = n || '';
  $('#btn-filters').classList.toggle('is-active', !!n);
  $('#result-count').textContent = state.loaded ? resultText() : '';
  const sel = $('#sort');
  if (sel.value !== state.sort) sel.value = state.sort;
}

function resultText() {
  const n = filtered().length;
  const total = cityRestaurants().length;
  const base = n === 1 ? '1 zaak' : `${n} zaken`;
  return n === total ? base : `${base} van ${total}`;
}

function rowHtml(r) {
  const d = distanceTo(r);
  const open = isOpenNow(r.opening_hours);
  const tag = r.needs_review
    ? '<span class="row__tag row__tag--review">nakijken</span>'
    : open === true
      ? '<span class="row__tag row__tag--open">open</span>'
      : '';
  return `<li><button type="button" class="row" data-id="${r.id}">
      <span class="row__main">
        <span class="row__name">${esc(r.name)}</span>
        <span class="row__meta">
          <span class="row__kind">${esc(kindLabel(r))}</span>
          <span class="row__price">${priceHtml(r.price_level)}</span>
          <span class="row__dist">${d != null ? formatDistance(d) : ''}</span>
          ${tag}
        </span>
      </span>
      ${stampsSmall(r)}
    </button></li>`;
}

function renderList(list) {
  const ul = $('#list');
  const empty = $('#empty');
  ul.classList.toggle('has-dist', !!state.userPos);
  if (!state.loaded) {
    ul.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = state.loadError
      ? `<p>De lijst kon niet geladen worden. Controleer je verbinding.</p><button type="button" class="btn btn--ink" data-retry>Opnieuw proberen</button>`
      : `<p>Lijst laden…</p>`;
    return;
  }
  if (!cityRestaurants().length) {
    ul.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = `<p>Nog geen restaurants in ${esc(currentCity().name)}. Voeg het eerste toe en het verschijnt meteen op de kaart.</p>
      <button type="button" class="btn btn--ink" data-add>${icon('plus')}Restaurant toevoegen</button>`;
    return;
  }
  if (!list.length) {
    ul.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = `<p>Geen zaken die bij deze keuze passen.</p><button type="button" class="btn btn--ghost" data-reset>Alles tonen</button>`;
    return;
  }
  empty.hidden = true;
  ul.innerHTML = list.map(rowHtml).join('');
}

function renderPreview() {
  const box = $('#map-preview');
  const r = state.selectedId ? byId(state.selectedId) : null;
  if (!r) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `<button type="button" class="preview" data-open="${r.id}">
      <span class="preview__main">
        <span class="preview__name">${esc(r.name)}</span>
        <span class="preview__meta"><span>${esc(kindLabel(r))}</span>${priceHtml(r.price_level)}</span>
      </span>
      ${stampsSmall(r)}
      <span class="preview__go">${icon('chevronRight')}</span>
    </button>`;
}

function renderBanner() {
  const b = $('#banner');
  if (state.offline && state.restaurants.length) {
    b.hidden = false;
    b.innerHTML = `<span>Geen verbinding. Je ziet de laatst geladen lijst.</span><button type="button" data-retry>Opnieuw</button>`;
  } else {
    b.hidden = true;
    b.innerHTML = '';
  }
}

// ---------- kaart ----------

function openFullMap() {
  if (releaseFullMap) return;
  $('#mapcard').classList.add('is-full');
  mapview.setFull(true);
  lockScroll();
  releaseFullMap = pushLayer(closeFullMap);
  setTimeout(() => mapview.fitTo(filtered(), currentCity().center), 340);
}

function closeFullMap() {
  if (!releaseFullMap) return;
  releaseFullMap();
  releaseFullMap = null;
  $('#mapcard').classList.remove('is-full');
  mapview.setFull(false);
  unlockScroll();
  setTimeout(() => mapview.fitTo(filtered(), currentCity().center), 340);
}

function locate({ pan = true, silent = false } = {}) {
  if (!navigator.geolocation) {
    if (!silent) toast('Locatie is niet beschikbaar op dit toestel');
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapview.showUser(state.userPos, { pan });
        render();
        refreshDetail();
        resolve(true);
      },
      (err) => {
        if (!silent) toast(err.code === 1 ? 'Geef de app toegang tot je locatie om afstanden te zien' : 'Je locatie kon niet bepaald worden');
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

// ---------- events ----------

function resetSelection() {
  state.cats.clear();
  state.status = 'alle';
  state.search = '';
  state.prices.clear();
  state.minScore = 0;
  state.openNow = false;
  $('#search').value = '';
  savePrefs();
  render();
}

function addRestaurant() {
  openAddSheet({
    onAdded: async (id) => {
      await reload();
      openRestaurant(id);
    },
    onOpenExisting: (id) => openRestaurant(id),
  });
}

function bind() {
  $('#cities').addEventListener('click', (e) => {
    const b = e.target.closest('[data-city]');
    if (!b || b.dataset.city === state.city) return;
    state.city = b.dataset.city;
    state.selectedId = null;
    savePrefs();
    render({ refit: true });
  });

  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const name = b.dataset.cat;
    if (!name) state.cats.clear();
    else if (state.cats.has(name)) state.cats.delete(name);
    else state.cats.add(name);
    savePrefs();
    render();
  });

  $('#statusbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    state.status = b.dataset.status;
    savePrefs();
    render();
  });

  const onSearch = debounce(() => render(), 120);
  $('#search').addEventListener('input', (e) => {
    state.search = e.target.value;
    onSearch();
  });

  $('#btn-filters').addEventListener('click', () => openFilterSheet({ onChange: () => render() }));
  $('#btn-surprise').addEventListener('click', () => openSurprise({ list: filtered(), onOpen: openRestaurant }));
  $('#btn-add').addEventListener('click', addRestaurant);
  $('#btn-stats').addEventListener('click', () => go('#/stats'));
  $('#btn-map-full').addEventListener('click', openFullMap);
  $('#btn-map-close').addEventListener('click', closeFullMap);
  $('#btn-locate').addEventListener('click', () => locate({ pan: true }));

  $('#sort').addEventListener('change', async (e) => {
    state.sort = e.target.value;
    savePrefs();
    if (state.sort === 'afstand' && !state.userPos) await locate({ pan: false });
    render();
  });

  $('#list').addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) openRestaurant(row.dataset.id);
  });
  $('#map-preview').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) openRestaurant(b.dataset.open);
  });
  $('#empty').addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) addRestaurant();
    else if (e.target.closest('[data-reset]')) resetSelection();
    else if (e.target.closest('[data-retry]')) reload({ initial: true });
  });
  $('#banner').addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) reload();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeTopLayer()) return;
    if (detailOpenId() || location.hash === '#/stats') goBack();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reloadSoon();
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', debounce(() => mapview.invalidate(), 150));
}

function onRealtime(table, payload) {
  if (table === 'photos') photosChanged(payload.new?.restaurant_id || payload.old?.restaurant_id);
  reloadSoon();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker niet geregistreerd', err));
}

// ---------- start ----------

export async function start() {
  hydrateIcons();
  $('#btn-stats').innerHTML = icon('chart');
  $('#search-icon').innerHTML = icon('search');
  $('#btn-map-full').innerHTML = icon('expand');
  $('#btn-locate').innerHTML = icon('locate');
  $('#btn-map-close').innerHTML = icon('close');
  $('#sort').innerHTML = SORTS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
  $('#sort').value = state.sort;

  initDetail({ close: goBack, reload: () => reload(), openRestaurant });
  initStats({ close: goBack, openRestaurant });

  mapview.initMainMap($('#map'), {
    center: currentCity().center,
    onPinTap: (id) => {
      state.selectedId = id;
      mapview.updateMarkers(filtered(), id);
      renderPreview();
    },
    onMapTap: () => {
      if (state.selectedId) {
        state.selectedId = null;
        mapview.updateMarkers(filtered(), null);
        renderPreview();
      } else if (isCoarsePointer() && !mapview.mapIsFull()) {
        openFullMap();
      }
    },
  });

  bind();

  const cached = loadLocal('mn.cache');
  if (cached?.restaurants) applyData(cached);
  render({ refit: true });
  if (location.hash) route();

  await reload({ initial: true });
  if (location.hash) route();

  data.subscribe(onRealtime);
  setTimeout(maybeRefreshHours, 1500);

  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        if (p.state === 'granted') locate({ pan: false, silent: true });
      })
      .catch(() => {});
  }
  registerServiceWorker();
}
