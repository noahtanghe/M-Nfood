// Centrale toestand van de app + afgeleide lijsten (filteren, tellen, sorteren).

import { CITIES } from './config.js';
import { loadLocal, saveLocal, norm, distanceKm } from './util.js';
import { isOpenNow } from './hours.js';

const prefs = loadLocal('mn.prefs', {}) || {};

// Oudere versies bewaarden meerdere categorieën en zes statussen; die zetten we hier om.
const legacyWho = ['samen', 'noah', 'marie'].includes(prefs.status) ? prefs.status : '';
const firstCat = Array.isArray(prefs.cats) ? prefs.cats[0] || '' : '';

export const state = {
  city: CITIES.some((c) => c.id === prefs.city) ? prefs.city : 'gent',
  cat: typeof prefs.cat === 'string' ? prefs.cat : firstCat,
  status: ['alle', 'nog_niet', 'geweest'].includes(prefs.status) ? prefs.status : legacyWho ? 'geweest' : 'alle',
  who: typeof prefs.who === 'string' ? prefs.who : legacyWho,
  prices: new Set(Array.isArray(prefs.prices) ? prefs.prices : []),
  minScore: Number(prefs.minScore) || 0,
  openNow: !!prefs.openNow,
  sort: prefs.sort || 'naam',
  view: prefs.view === 'map' ? 'map' : 'list',
  restaurants: [],
  categories: [],
  loaded: false,
  loadError: null,
  offline: false,
  userPos: null,
  selectedId: null,
};

export function savePrefs() {
  saveLocal('mn.prefs', {
    city: state.city,
    cat: state.cat,
    status: state.status,
    who: state.who,
    prices: [...state.prices],
    minScore: state.minScore,
    openNow: state.openNow,
    sort: state.sort,
    view: state.view,
  });
}

export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[0];
export const currentCity = () => cityById(state.city);
export const byId = (id) => state.restaurants.find((r) => r.id === id) || null;
export const cityRestaurants = (city = state.city) => state.restaurants.filter((r) => r.city_id === city);

const matchesWho = (r) => !state.who || r.status === state.who;

export function matchesStatus(r, status = state.status) {
  switch (status) {
    case 'nog_niet': return r.status === 'nog_niet';
    case 'geweest': return r.status !== 'nog_niet' && matchesWho(r);
    default: return !state.who || matchesWho(r);
  }
}

/** Alle filters behalve de status (zodat de statusknoppen hun aantallen kunnen tonen). */
function passesBase(r, now) {
  if (state.cat && !r.categories.includes(state.cat)) return false;
  if (state.prices.size && !state.prices.has(Number(r.price_level))) return false;
  if (state.minScore && !(Number(r.avg_score) >= state.minScore)) return false;
  if (state.openNow && isOpenNow(r.opening_hours, now) !== true) return false;
  return true;
}

export function baseFiltered() {
  const now = new Date();
  return cityRestaurants().filter((r) => passesBase(r, now));
}

export function statusCounts() {
  const base = baseFiltered();
  return {
    alle: base.filter((r) => matchesStatus(r, 'alle')).length,
    nog_niet: base.filter((r) => matchesStatus(r, 'nog_niet')).length,
    geweest: base.filter((r) => matchesStatus(r, 'geweest')).length,
  };
}

export const distanceTo = (r) => (state.userPos ? distanceKm(state.userPos, r) : null);

const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });
export const byName = (a, b) => collator.compare(a.name, b.name);

export function sortList(list) {
  const out = [...list];
  switch (state.sort) {
    case 'score':
      return out.sort((a, b) => {
        const sa = a.avg_score == null ? -1 : Number(a.avg_score);
        const sb = b.avg_score == null ? -1 : Number(b.avg_score);
        return sb - sa || byName(a, b);
      });
    case 'afstand':
      if (!state.userPos) return out.sort(byName);
      return out.sort((a, b) => (distanceTo(a) ?? 1e9) - (distanceTo(b) ?? 1e9) || byName(a, b));
    case 'prijs':
      return out.sort((a, b) => (Number(a.price_level) || 9) - (Number(b.price_level) || 9) || byName(a, b));
    default:
      return out.sort(byName);
  }
}

export function filtered() {
  return sortList(baseFiltered().filter((r) => matchesStatus(r)));
}

/** Zoeken over alle zaken van de stad, los van de filters. */
export function searchCity(query) {
  const q = norm(query);
  const list = cityRestaurants();
  if (!q) return [...list].sort(byName);
  const hay = (r) => norm([r.name, r.cuisine_note, r.address, ...r.categories].filter(Boolean).join(' '));
  const starts = (r) => (norm(r.name).startsWith(q) ? 0 : 1);
  return list.filter((r) => hay(r).includes(q)).sort((a, b) => starts(a) - starts(b) || byName(a, b));
}

export function activeFilterCount() {
  return (state.who ? 1 : 0) + (state.prices.size ? 1 : 0) + (state.minScore ? 1 : 0) + (state.openNow ? 1 : 0);
}

/** Sleutel die verandert wanneer de selectie verandert (om de kaart opnieuw te kaderen). */
export function filterKey() {
  return JSON.stringify([state.city, state.cat, state.status, state.who, [...state.prices].sort(), state.minScore, state.openNow]);
}

export function clearFilters() {
  state.who = '';
  state.prices.clear();
  state.minScore = 0;
  state.openNow = false;
}

/** Zet ruwe rijen uit restaurant_overview om naar een vaste vorm. */
export function normalizeRestaurant(row) {
  const num = (v) => (v == null || v === '' ? null : Number(v));
  return {
    ...row,
    lat: num(row.lat),
    lng: num(row.lng),
    price_level: num(row.price_level),
    noah_score: num(row.noah_score),
    marie_score: num(row.marie_score),
    avg_score: num(row.avg_score),
    noah_visited: !!row.noah_visited,
    marie_visited: !!row.marie_visited,
    categories: Array.isArray(row.categories) ? row.categories : [],
    status: row.status || 'nog_niet',
  };
}
