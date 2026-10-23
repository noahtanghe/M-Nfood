// Alles wat met Supabase en de zoekfunctie praat.

import { SUPABASE_URL, SUPABASE_KEY, FUNCTION_URL, PHOTO_BUCKET, HOURS_MAX_AGE_DAYS } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export async function loadAll() {
  const [restaurants, categories] = await Promise.all([
    sb.from('restaurant_overview').select('*').then(must),
    sb.from('categories').select('id, name, sort_order').order('sort_order').then(must),
  ]);
  return { restaurants, categories };
}

/** Live updates: roept onChange(tabel, payload) op bij elke wijziging. */
export function subscribe(onChange) {
  const channel = sb.channel('mn-foods');
  for (const table of ['restaurants', 'visits', 'restaurant_categories', 'photos']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => onChange(table, payload));
  }
  channel.subscribe();
  return channel;
}

// ---------- bezoeken ----------

export async function saveVisits(rows) {
  const now = new Date().toISOString();
  must(await sb.from('visits').upsert(rows.map((r) => ({ ...r, updated_at: now })), { onConflict: 'restaurant_id,person_id' }));
}

export async function deleteVisit(restaurantId, personId) {
  must(await sb.from('visits').delete().eq('restaurant_id', restaurantId).eq('person_id', personId));
}

// ---------- restaurants ----------

export async function insertRestaurant(row, categoryIds) {
  const created = must(await sb.from('restaurants').insert(row).select('id').single());
  if (categoryIds.length) {
    must(await sb.from('restaurant_categories').insert(categoryIds.map((category_id) => ({ restaurant_id: created.id, category_id }))));
  }
  return created.id;
}

export async function updateRestaurant(id, patch) {
  must(await sb.from('restaurants').update(patch).eq('id', id));
}

export async function setCategories(restaurantId, categoryIds) {
  must(await sb.from('restaurant_categories').delete().eq('restaurant_id', restaurantId));
  if (categoryIds.length) {
    must(await sb.from('restaurant_categories').insert(categoryIds.map((category_id) => ({ restaurant_id: restaurantId, category_id }))));
  }
}

export async function deleteRestaurant(id) {
  const photos = must(await sb.from('photos').select('storage_path').eq('restaurant_id', id)) || [];
  const paths = photos.flatMap((p) => [p.storage_path, thumbPath(p.storage_path)]);
  if (paths.length) await sb.storage.from(PHOTO_BUCKET).remove(paths);
  must(await sb.from('restaurants').delete().eq('id', id));
}

/** Postgres-fout 23505 = dubbele Google-koppeling. */
export const isDuplicate = (err) => err && (err.code === '23505' || /duplicate key/i.test(err.message || ''));

// ---------- foto's ----------

export const thumbPath = (path) => path.replace(/\.jpg$/i, '_t.jpg');
export const photoUrl = (path) => sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;

export async function listPhotos(restaurantId) {
  return must(await sb.from('photos').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false })) || [];
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('deze foto kan niet gelezen worden'));
    };
    img.src = url;
  });
}

function toJpeg(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('foto verkleinen mislukt'))), 'image/jpeg', quality),
  );
}

export async function uploadPhoto(restaurantId, file) {
  const img = await loadImage(file);
  const [full, thumb] = await Promise.all([toJpeg(img, 1600, 0.82), toJpeg(img, 480, 0.78)]);
  const path = `${restaurantId}/${crypto.randomUUID()}.jpg`;
  const bucket = sb.storage.from(PHOTO_BUCKET);
  must(await bucket.upload(path, full, { contentType: 'image/jpeg', cacheControl: '31536000' }));
  must(await bucket.upload(thumbPath(path), thumb, { contentType: 'image/jpeg', cacheControl: '31536000' }));
  must(await sb.from('photos').insert({ restaurant_id: restaurantId, storage_path: path }));
}

export async function deletePhoto(photo) {
  await sb.storage.from(PHOTO_BUCKET).remove([photo.storage_path, thumbPath(photo.storage_path)]);
  must(await sb.from('photos').delete().eq('id', photo.id));
}

// ---------- Google Places via de Edge Function ----------

async function placesCall(body) {
  let res;
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('geen verbinding met de zoekfunctie');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = data.error || data.message || data.msg || `fout ${res.status}`;
    if (res.status === 401 && data.error === 'Niet toegestaan') msg = 'de zoekfunctie herkent de app niet (controleer de secret APP_KEY)';
    else if (res.status === 401) msg = 'toegang geweigerd: zet "Verify JWT" uit bij search-place in Supabase';
    else if (res.status === 404) msg = 'de functie search-place is niet gevonden in Supabase';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  // De voorbeeldcode van Supabase antwoordt met { message: "Hello …" }: dan is onze code nog niet gedeployed.
  if (!Array.isArray(data.results)) throw new Error('de zoekfunctie in Supabase bevat nog niet de juiste code');
  return data.results;
}

export const searchPlaces = (query, city) => placesCall({ action: 'search', query, city });
export const placeDetails = (placeIds) => placesCall({ action: 'details', placeIds });

/** Zet een Google-resultaat om naar kolommen van de tabel restaurants. */
export function placeToColumns(p) {
  return {
    google_place_id: p.google_place_id,
    google_maps_url: p.google_maps_url || null,
    address: p.address || null,
    lat: p.lat,
    lng: p.lng,
    price_level: p.price_level || null,
    website: p.website || null,
    phone: p.phone || null,
    opening_hours: hoursColumn(p),
    hours_updated_at: new Date().toISOString(),
  };
}

function hoursColumn(p) {
  if (p.opening_hours) return { ...p.opening_hours, permanently_closed: !!p.permanently_closed };
  if (p.permanently_closed) return { weekday_text: [], periods: [], permanently_closed: true };
  return null;
}

/**
 * Haalt openingsuren (en ontbrekende website/telefoon/prijs) op voor restaurants met een
 * Google-koppeling waarvan de uren ontbreken of verouderd zijn. Geeft het aantal bijgewerkte terug.
 */
export async function refreshHours(list, { force = false } = {}) {
  const maxAge = HOURS_MAX_AGE_DAYS * 864e5;
  const now = Date.now();
  const stale = list.filter(
    (r) => r.google_place_id && (force || !r.hours_updated_at || now - Date.parse(r.hours_updated_at) > maxAge),
  );
  let updated = 0;
  for (let i = 0; i < stale.length; i += 20) {
    const chunk = stale.slice(i, i + 20);
    const results = await placeDetails(chunk.map((r) => r.google_place_id));
    const stamp = new Date().toISOString();
    await Promise.all(
      results.map(async (p, idx) => {
        const r = chunk[idx];
        if (!r || !p || p.error) return;
        const patch = { opening_hours: hoursColumn(p), hours_updated_at: stamp };
        if (!r.website && p.website) patch.website = p.website;
        if (!r.phone && p.phone) patch.phone = p.phone;
        if (!r.price_level && p.price_level) patch.price_level = p.price_level;
        if (!r.google_maps_url && p.google_maps_url) patch.google_maps_url = p.google_maps_url;
        if (p.permanently_closed && !r.needs_review) patch.needs_review = true;
        const { error } = await sb.from('restaurants').update(patch).eq('id', r.id);
        if (!error) updated += 1;
      }),
    );
  }
  return updated;
}
