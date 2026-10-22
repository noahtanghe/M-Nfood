// Centrale toestand van de app + afgeleide lijsten (filteren, tellen, sorteren).

import { CITIES } from './config.js';
import { loadLocal, saveLocal, norm, distanceKm } from './util.js';
import { isOpenNow } from './hours.js';

const prefs = loadLocal('mn.prefs', {}) || {};

export const state = {
  city: CITIES.some((c) => c.id === prefs.city) ? prefs.city : 'gent',
  cats: new Set(Array.isArray(prefs.cats) ? prefs.cats : []),
  status: prefs.status || 'alle',
  search: '',
  prices: new Set(Array.isArray(prefs.prices) ? prefs.prices : []),
  minScore: Number(prefs.minScore) || 0,
  openNow: !!prefs.openNow,
  sort: prefs.sort || 'naam',
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
    cats: [...state.cats],
    status: state.status,
    prices: [...state.prices],
    minScore: state.minScore,
    openNow: state.openNow,
    sort: state.sort,
  });
}

export const cityById = (id) => CITIES.find((c) => c.id === id) || CITIES[0];
export const currentCity = () => cityById(state.city);
export const byId = (id) => state.restaurants.find((r) => r.id === id) || null;
export const cityRestaurants = (city = state.city) => state.restaurants.filter((r) => r.city_id === city);

export function matchesStatus(r, status) {
  switch (status) {
    case 'nog_niet': return r.status === 'nog_niet';
    case 'geweest': return r.status !== 'nog_niet';
    case 'samen': return r.status === 'samen';
    case 'noah': return r.status === 'noah';
    case 'marie': return r.status === 'marie';
    default: return true;
  }
}

/** Alle filters behalve de status (zodat de statusknoppen hun aantallen kunnen tonen). */
function passesBase(r, now) {
  if (state.cats.size && !r.categories.some((c) => state.cats.has(c))) return false;
  if (state.search) {
    const q = norm(state.search);
    if (!norm(r.name).includes(q) && !norm(r.cuisine_note).includes(q) && !norm(r.address).includes(q)) return false;
  }
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
  const counts = {};
  for (const s of ['alle', 'nog_niet', 'geweest', 'samen', 'noah', 'marie']) counts[s] = base.filter((r) => matchesStatus(r, s)).length;
  return counts;
}

export const distanceTo = (r) => (state.userPos ? distanceKm(state.userPos, r) : null);

const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });
const byName = (a, b) => collator.compare(a.name, b.name);

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
  return sortList(baseFiltered().filter((r) => matchesStatus(r, state.status)));
}

export function activeFilterCount() {
  return (state.prices.size ? 1 : 0) + (state.minScore ? 1 : 0) + (state.openNow ? 1 : 0);
}

/** Sleutel die verandert wanneer de selectie verandert (om de kaart opnieuw te kaderen). */
export function filterKey() {
  return JSON.stringify([state.city, [...state.cats].sort(), state.status, norm(state.search), [...state.prices].sort(), state.minScore, state.openNow]);
}

export function clearFilters() {
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
