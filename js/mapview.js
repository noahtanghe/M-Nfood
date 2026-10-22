// Kaarten (Leaflet): de hoofdkaart, de kleine kaart in het detailscherm en de locatiekiezer.

import { TILE_URL, TILE_ATTRIBUTION } from './config.js';
import { esc, isCoarsePointer } from './util.js';

const L = window.L;

function tiles() {
  return L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION });
}

// Het zichtbare bolletje is klein; de tikzone eromheen is 30 px zodat je het op een gsm goed raakt.
export function pinIcon(status, { selected = false, label = '' } = {}) {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin pin--${status}${selected ? ' is-selected' : ''}"></span>${label ? `<span class="pin__label">${esc(label)}</span>` : ''}`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/** Kader rond de kern van de punten: de buitenste 6% aan elke kant tellen niet mee, zodat één afgelegen zaak niet alles klein maakt. */
function coreBounds(pts) {
  if (pts.length < 12) return L.latLngBounds(pts);
  const q = (values, p) => {
    const s = [...values].sort((a, b) => a - b);
    const i = (s.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  return L.latLngBounds([q(lats, 0.06), q(lngs, 0.06)], [q(lats, 0.94), q(lngs, 0.94)]);
}

// ---------- hoofdkaart ----------

let map = null;
let layer = null;
let userMarker = null;
let isFull = false;
const markers = new Map();

export function initMainMap(el, { center, onPinTap, onMapTap }) {
  map = L.map(el, {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: !isCoarsePointer(),
    touchZoom: true,
    doubleClickZoom: true,
    keyboard: false,
    zoomSnap: 0.5,
    attributionControl: true,
  }).setView(center, 13);
  map.attributionControl.setPrefix(false);
  tiles().addTo(map);
  layer = L.layerGroup().addTo(map);
  map.on('click', () => onMapTap?.());
  map._mnOnPinTap = onPinTap;
  return map;
}

export function updateMarkers(list, selectedId) {
  if (!map) return;
  layer.clearLayers();
  markers.clear();
  for (const r of list) {
    if (r.lat == null || r.lng == null) continue;
    const selected = r.id === selectedId;
    const m = L.marker([r.lat, r.lng], {
      icon: pinIcon(r.status, { selected, label: selected ? r.name : '' }),
      keyboard: false,
      title: r.name,
      zIndexOffset: selected ? 1000 : r.status === 'nog_niet' ? 0 : 100,
      riseOnHover: true,
    });
    m.on('click', () => map._mnOnPinTap?.(r.id));
    m.addTo(layer);
    markers.set(r.id, m);
  }
}

export function fitTo(list, fallbackCenter) {
  if (!map) return;
  const pts = list.filter((r) => r.lat != null && r.lng != null).map((r) => [r.lat, r.lng]);
  if (!pts.length) {
    map.setView(fallbackCenter, 13, { animate: false });
  } else if (pts.length === 1) {
    map.setView(pts[0], 15.5, { animate: false });
  } else {
    map.fitBounds(coreBounds(pts), { padding: [22, 22], maxZoom: 15.5, animate: false });
  }
}

export function panToRestaurant(r) {
  if (!map || r.lat == null) return;
  const z = Math.max(map.getZoom(), 15);
  map.setView([r.lat, r.lng], z, { animate: true });
}

export function setFull(full) {
  if (!map) return;
  isFull = full;
  if (isCoarsePointer()) {
    if (full) map.dragging.enable();
    else map.dragging.disable();
  }
  setTimeout(() => map.invalidateSize({ animate: false }), 30);
  setTimeout(() => map.invalidateSize({ animate: false }), 320);
}

export const mapIsFull = () => isFull;
export const invalidate = () => map && map.invalidateSize({ animate: false });

export function showUser(pos, { pan = true } = {}) {
  if (!map) return;
  const ll = [pos.lat, pos.lng];
  if (!userMarker) {
    userMarker = L.marker(ll, {
      icon: L.divIcon({ className: 'pin-wrap', html: '<span class="me"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false,
      zIndexOffset: 2000,
    }).addTo(map);
  } else {
    userMarker.setLatLng(ll);
  }
  if (pan) map.setView(ll, Math.max(map.getZoom(), 15), { animate: true });
}

// ---------- kleine kaarten ----------

export function miniMap(el, r) {
  const m = L.map(el, {
    zoomControl: false,
    dragging: false,
    touchZoom: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    attributionControl: true,
  }).setView([r.lat, r.lng], 16);
  m.attributionControl.setPrefix(false);
  tiles().addTo(m);
  const marker = L.marker([r.lat, r.lng], { icon: pinIcon(r.status, { selected: true }), interactive: false }).addTo(m);
  return {
    map: m,
    update(next) {
      marker.setIcon(pinIcon(next.status, { selected: true }));
      if (next.lat !== r.lat || next.lng !== r.lng) {
        marker.setLatLng([next.lat, next.lng]);
        m.setView([next.lat, next.lng], 16, { animate: false });
      }
      r = next;
    },
    destroy() {
      m.remove();
    },
    invalidate() {
      m.invalidateSize({ pan: false });
      m.setView([r.lat, r.lng], 16, { animate: false });
    },
  };
}

/** Kaart waarop je een punt kiest door te tikken of de speld te verslepen. */
export function pickerMap(el, { center, point, onPick }) {
  const m = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.5 }).setView(
    point || center,
    point ? 17 : 14,
  );
  m.attributionControl.setPrefix(false);
  tiles().addTo(m);
  let marker = null;
  const place = (ll) => {
    if (!marker) {
      marker = L.marker(ll, { icon: pinIcon('nog_niet', { selected: true }), draggable: true }).addTo(m);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onPick({ lat: p.lat, lng: p.lng });
      });
    } else {
      marker.setLatLng(ll);
    }
  };
  if (point) place(point);
  m.on('click', (e) => {
    place(e.latlng);
    onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
  });
  setTimeout(() => m.invalidateSize(), 60);
  setTimeout(() => m.invalidateSize(), 320);
  return {
    map: m,
    setPoint(ll) {
      place(ll);
      m.setView(ll, 17);
    },
    destroy() {
      m.remove();
    },
  };
}
