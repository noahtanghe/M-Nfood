// Startpagina, navigatie en het laden/verversen van data.

import { CITIES, STATUSES } from './config.js';
import {
  state, savePrefs, filtered, statusCounts, cityRestaurants, byId, currentCity,
  filterKey, activeFilterCount, normalizeRestaurant, distanceTo,
} from './state.js';
import { esc, $, loadLocal, saveLocal, debounce, toast, formatDistance, priceHtml } from './util.js';
import { icon, categoryIcon, categoryHue, hydrateIcons } from './icons.js';
import { kindLabel, shortCat, stamps, mediaHtml, bindMedia } from './ui.js';
import { openState } from './hours.js';
import * as mapview from './mapview.js';
import { closeTopLayer, openSheet } from './sheets.js';
import { initDetail, openDetail, closeDetail, refreshDetail, photosChanged, detailOpenId } from './detail.js';
import { initStats, openStats, closeStats, refreshStats } from './stats.js';
import { openFilterSheet } from './filters.js';
import { openAddSheet } from './add.js';
import { openSurprise } from './surprise.js';
import { openSearch } from './search.js';
import * as data from './data.js';

let lastFitKey = null;
let catsKey = '';
let lastCat = null;
let internalNav = false;
let safeTop = 0;

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
  if (Date.now() < loadLocal('mn.hoursNextTry', 0)) return;
  try {
    const n = await data.refreshHours(state.restaurants);
    saveLocal('mn.hoursNextTry', Date.now() + 6 * 3600e3);
    if (n) reloadSoon();
  } catch (err) {
    saveLocal('mn.hoursNextTry', Date.now() + 30 * 60e3);
    console.warn('Openingsuren verversen lukte niet:', err.message || err);
  }
}

// ---------- tekenen ----------

function render({ refit = false } = {}) {
  const emptyCity = state.loaded && !cityRestaurants().length;
  $('#app').classList.toggle('is-empty', emptyCity);
  if (emptyCity && state.view === 'map') setView('list', { save: false });

  renderTopbar();
  renderCats();
  renderStatus();
  renderListHead();
  const list = filtered();
  renderList(list);
  renderDock();

  if (state.selectedId && !list.some((r) => r.id === state.selectedId)) state.selectedId = null;
  if (mapview.mapReady()) {
    mapview.updateMarkers(list, state.selectedId);
    const key = filterKey();
    if (state.view === 'map' && (refit || key !== lastFitKey)) {
      mapview.fitTo(list, currentCity().center);
      lastFitKey = key;
    }
  }
  renderPreview();
}

function renderTopbar() {
  $('#city-name').textContent = currentCity().name;
}

function renderCats() {
  const track = $('#cats');
  const key = state.categories.map((c) => c.name).join('|');
  if (key !== catsKey) {
    catsKey = key;
    const items = [{ name: '', label: 'Alles' }, ...state.categories.map((c) => ({ name: c.name, label: shortCat(c.name) }))];
    track.innerHTML = items
      .map(
        (c) => `<button type="button" class="tab" data-cat="${esc(c.name)}" aria-pressed="false"${c.label !== c.name && c.name ? ` aria-label="${esc(c.name)}"` : ''}>
          <span class="tab__icon hue-${categoryHue(c.name)}">${c.name ? categoryIcon(c.name) : icon('all')}</span>
          <span class="tab__label">${esc(c.label)}</span></button>`,
      )
      .join('');
  }
  const inCity = cityRestaurants();
  let active = null;
  track.querySelectorAll('.tab').forEach((btn) => {
    const name = btn.dataset.cat;
    const on = name === state.cat;
    if (on) active = btn;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    if (name) btn.classList.toggle('is-empty', !inCity.some((r) => r.categories.includes(name)));
  });
  if (active && lastCat !== state.cat) {
    const smooth = lastCat !== null;
    lastCat = state.cat;
    const left = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  }
}

function renderStatus() {
  const seg = $('#statusbar');
  if (!seg.querySelector('.seg__btn')) {
    seg.innerHTML = `<span class="seg__thumb" aria-hidden="true"></span>${STATUSES.map(
      (s) => `<button type="button" class="seg__btn" role="radio" aria-checked="false" data-status="${s.id}"><span class="seg__label">${esc(s.label)}</span><span class="seg__n"></span></button>`,
    ).join('')}`;
  }
  const counts = statusCounts();
  seg.querySelectorAll('.seg__btn').forEach((btn, i) => {
    const on = btn.dataset.status === state.status;
    if (on) seg.style.setProperty('--i', i);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-checked', String(on));
    btn.querySelector('.seg__n').textContent = state.loaded ? counts[btn.dataset.status] : '';
  });

  const n = activeFilterCount();
  const badge = $('#filter-count');
  badge.hidden = !n;
  badge.textContent = n || '';
  $('#btn-filters').classList.toggle('is-active', !!n);
  $('#btn-filters').setAttribute('aria-label', n ? `Filters, ${n} actief` : 'Filters');
}

function renderListHead() {
  // Alleen voor schermlezers: de zichtbare tellers staan in de statusknoppen.
  const n = filtered().length;
  $('#result-count').textContent = state.loaded ? (n === 1 ? '1 zaak' : `${n} zaken`) : '';
}

function cardHtml(r, i) {
  const d = distanceTo(r);
  const os = openState(r.opening_hours);
  const flags = [
    r.needs_review ? '<span class="flag flag--review">Nakijken</span>' : '',
    os.closedForGood ? '<span class="flag flag--closed">Dicht</span>' : '',
  ].join('');
  const extra = [
    os.open ? `<span class="card__open">${esc(os.short)}</span>` : '',
    d != null ? `<span class="card__dist">${formatDistance(d)}</span>` : '',
  ].join('');
  return `<li><button type="button" class="card" data-id="${r.id}">
      ${mediaHtml(r, {
        cls: 'card__media',
        eager: i < 4,
        extra: `${flags ? `<span class="card__flags">${flags}</span>` : ''}${stamps(r, 'card__stamps')}`,
      })}
      <span class="card__body">
        <span class="card__title">${esc(r.name)}</span>
        <span class="card__meta"><span class="card__kind">${esc(kindLabel(r))}</span>${priceHtml(r.price_level)}</span>
        ${extra ? `<span class="card__extra">${extra}</span>` : ''}
      </span>
    </button></li>`;
}

const skeleton = () =>
  Array.from(
    { length: 6 },
    () => `<li><div class="card card--skeleton" aria-hidden="true"><span class="media card__media"></span>
      <span class="card__body"><span class="sk sk--title"></span><span class="sk sk--meta"></span></span></div></li>`,
  ).join('');

function renderList(list) {
  const ul = $('#list');
  const empty = $('#empty');
  if (!state.loaded) {
    if (state.loadError) {
      ul.innerHTML = '';
      empty.hidden = false;
      empty.innerHTML = emptyHtml('De lijst kon niet geladen worden', 'Controleer je verbinding en probeer opnieuw.', '<button type="button" class="btn btn--ink" data-retry>Opnieuw proberen</button>');
    } else {
      empty.hidden = true;
      ul.innerHTML = skeleton();
    }
    return;
  }
  if (!cityRestaurants().length) {
    ul.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = emptyHtml(
      `Nog geen restaurants in ${currentCity().name}`,
      'Voeg het eerste toe. Het verschijnt meteen in de lijst en op de kaart.',
      `<button type="button" class="btn btn--ink" data-add>${icon('plus')}Restaurant toevoegen</button>`,
    );
    return;
  }
  if (!list.length) {
    ul.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = emptyHtml('Geen zaken voor deze keuze', 'Kies een andere categorie of wis de filters.', '<button type="button" class="btn btn--ghost" data-reset>Alles tonen</button>');
    return;
  }
  empty.hidden = true;
  ul.innerHTML = list.map(cardHtml).join('');
}

const emptyHtml = (title, text, action) => `
  <span class="empty__icon">${icon('utensils')}</span>
  <h2 class="empty__title">${esc(title)}</h2>
  <p class="empty__text">${esc(text)}</p>
  ${action}`;

function renderDock() {
  const map = state.view === 'map';
  $('#view-icon').innerHTML = icon(map ? 'list' : 'map');
  $('#view-label').textContent = map ? 'Lijst' : 'Kaart';
}

function renderPreview() {
  const box = $('#map-preview');
  const r = state.view === 'map' && state.selectedId ? byId(state.selectedId) : null;
  if (!r) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const os = openState(r.opening_hours);
  box.hidden = false;
  box.innerHTML = `<button type="button" class="preview" data-open="${r.id}">
      ${mediaHtml(r, { cls: 'preview__thumb' })}
      <span class="preview__main">
        <span class="preview__name">${esc(r.name)}</span>
        <span class="preview__meta"><span>${esc(kindLabel(r))}</span>${priceHtml(r.price_level)}${os.open ? `<span class="card__open">${esc(os.short)}</span>` : ''}</span>
      </span>
      ${stamps(r, 'stamps--sm')}
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

// ---------- weergave: lijst of kaart ----------

function updateMapTop() {
  const bottom = Math.round($('#sticky').getBoundingClientRect().bottom);
  document.documentElement.style.setProperty('--map-top', `${bottom}px`);
}

function ensureMap() {
  if (mapview.mapReady()) return;
  mapview.initMainMap($('#map'), {
    center: currentCity().center,
    onPinTap: (id) => {
      state.selectedId = id;
      mapview.updateMarkers(filtered(), id);
      renderPreview();
    },
    onMapTap: () => {
      if (!state.selectedId) return;
      state.selectedId = null;
      mapview.updateMarkers(filtered(), null);
      renderPreview();
    },
  });
  if (state.userPos) mapview.showUser(state.userPos, { pan: false });
}

function setView(view, { save = true } = {}) {
  if (view === 'map' && state.loaded && !cityRestaurants().length) view = 'list';
  state.view = view;
  if (save) savePrefs();
  const app = $('#app');
  if (view === 'map') {
    window.scrollTo(0, 0);
    app.classList.add('is-map');
    updateMapTop();
    ensureMap();
    requestAnimationFrame(() => {
      mapview.invalidate();
      const list = filtered();
      mapview.updateMarkers(list, state.selectedId);
      mapview.fitTo(list, currentCity().center);
      lastFitKey = filterKey();
    });
  } else {
    app.classList.remove('is-map');
    state.selectedId = null;
  }
  renderDock();
  renderPreview();
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

// ---------- acties ----------

function setCity(id) {
  if (id === state.city) return;
  state.city = id;
  state.cat = '';
  state.selectedId = null;
  savePrefs();
  window.scrollTo(0, 0);
  render({ refit: true });
}

function openCitySheet() {
  const sheet = openSheet({ title: 'Kies een stad', className: 'sheet--city' });
  sheet.body.innerHTML = `<div class="cityopts">${CITIES.map((c) => {
    const n = state.restaurants.filter((r) => r.city_id === c.id).length;
    const on = c.id === state.city;
    return `<button type="button" class="cityopt${on ? ' is-on' : ''}" data-city="${c.id}" aria-pressed="${on}">
        <span class="cityopt__name">${esc(c.name)}</span>
        <span class="cityopt__n">${n === 1 ? '1 restaurant' : `${n} restaurants`}</span>
        <span class="cityopt__check">${on ? icon('check') : ''}</span>
      </button>`;
  }).join('')}</div>`;
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-city]');
    if (!b) return;
    sheet.close();
    setCity(b.dataset.city);
  });
}

function resetSelection() {
  state.cat = '';
  state.status = 'alle';
  state.who = '';
  state.prices.clear();
  state.minScore = 0;
  state.openNow = false;
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

function measureSafeTop() {
  safeTop = $('#shield').offsetHeight;
}

let scrollRaf = 0;
function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const sticky = $('#sticky');
    const stuck = window.scrollY > 4 && sticky.getBoundingClientRect().top <= safeTop + 0.5;
    sticky.classList.toggle('is-stuck', stuck);
  });
}

function bind() {
  $('#btn-city').addEventListener('click', openCitySheet);
  $('#btn-search').addEventListener('click', () => openSearch({ onOpen: openRestaurant }));
  $('#btn-stats').addEventListener('click', () => go('#/stats'));

  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.dataset.cat;
    savePrefs();
    render();
  });

  $('#statusbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    state.status = b.dataset.status;
    if (state.status !== 'geweest') state.who = '';
    savePrefs();
    render();
  });

  $('#btn-filters').addEventListener('click', () =>
    openFilterSheet({
      onChange: () => render(),
      ensureLocation: () => (state.userPos ? Promise.resolve(true) : locate({ pan: false })),
    }),
  );
  $('#btn-view').addEventListener('click', () => setView(state.view === 'map' ? 'list' : 'map'));
  $('#btn-surprise').addEventListener('click', () => openSurprise({ list: filtered(), onOpen: openRestaurant }));
  $('#btn-add').addEventListener('click', addRestaurant);
  $('#btn-locate').addEventListener('click', () => locate({ pan: true }));

  $('#list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) openRestaurant(card.dataset.id);
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
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener(
    'resize',
    debounce(() => {
      measureSafeTop();
      if (state.view === 'map') {
        updateMapTop();
        mapview.invalidate();
      }
    }, 150),
  );
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
  bindMedia(document);
  measureSafeTop();

  initDetail({ close: goBack, reload: () => reload(), openRestaurant });
  initStats({ close: goBack, openRestaurant });
  bind();

  const cached = loadLocal('mn.cache');
  if (cached?.restaurants) applyData(cached);
  render({ refit: true });
  if (state.view === 'map' && state.loaded) setView('map', { save: false });
  if (location.hash) route();

  await reload({ initial: true });
  if (state.view === 'map' && !$('#app').classList.contains('is-map')) setView('map', { save: false });
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
