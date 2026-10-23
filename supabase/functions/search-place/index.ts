// M&N Foods — Edge Function "search-place"
// Zoekt restaurants op naam, haalt details (adres, prijs, openingsuren) op en levert een foto
// via Google Places API (New). De Google-sleutel staat als secret in Supabase, nooit in de app.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_PLACES_KEY = jouw Google-sleutel
//   APP_KEY           = de publishable key van je project (sb_publishable_...)
// "Verify JWT" staat uit; de functie controleert zelf of het verzoek van de app komt.
//
// Aanroepen:
//   POST { "action": "search",  "query": "Gigi", "city": "gent" }
//   POST { "action": "details", "placeIds": ["ChIJ...", "ChIJ..."] }      // max 20 per keer
//   GET  ?action=photo&place=<google place id>&w=800&key=<APP_KEY>       // geeft de foto zelf terug

const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_KEY") ?? "";
const APP_KEY = Deno.env.get("APP_KEY") ?? "";
const GOOGLE = Deno.env.get("GOOGLE_BASE") ?? "https://places.googleapis.com"; // alleen anders bij testen

const CITIES: Record<string, { name: string; lat: number; lng: number }> = {
  gent: { name: "Gent", lat: 51.0543, lng: 3.7174 },
  kortrijk: { name: "Kortrijk", lat: 50.828, lng: 3.2649 },
};

const FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "priceLevel",
  "websiteUri",
  "internationalPhoneNumber",
  "googleMapsUri",
  "regularOpeningHours",
  "businessStatus",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Photo-Author",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...extra },
  });
}

const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 3,
};

// Google-formaat → formaat van de tabel restaurants
// deno-lint-ignore no-explicit-any
function mapPlace(p: any) {
  return {
    google_place_id: p.id,
    name: p.displayName?.text ?? null,
    address: (p.formattedAddress ?? "").replace(/, (België|Belgium)$/, "") || null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    price_level: PRICE[p.priceLevel] ?? null,
    website: p.websiteUri ?? null,
    phone: p.internationalPhoneNumber ?? null,
    google_maps_url: p.googleMapsUri ?? null,
    opening_hours: p.regularOpeningHours
      ? {
          weekday_text: p.regularOpeningHours.weekdayDescriptions ?? [],
          periods: p.regularOpeningHours.periods ?? [],
        }
      : null,
    permanently_closed: p.businessStatus === "CLOSED_PERMANENTLY",
  };
}

async function google(url: string, init: RequestInit, fieldMask: string) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Google ${res.status}`);
  return data;
}

async function search(query: string, cityId: string) {
  const city = CITIES[cityId] ?? CITIES.gent;
  const data = await google(
    `${GOOGLE}/v1/places:searchText`,
    {
      method: "POST",
      body: JSON.stringify({
        textQuery: `${query} ${city.name}`,
        languageCode: "nl",
        regionCode: "BE",
        maxResultCount: 5,
        locationBias: {
          circle: { center: { latitude: city.lat, longitude: city.lng }, radius: 10000 },
        },
      }),
    },
    FIELDS.map((f) => `places.${f}`).join(","),
  );
  return (data.places ?? []).map(mapPlace);
}

async function details(placeIds: string[]) {
  const results = await Promise.allSettled(
    placeIds.slice(0, 20).map((id) =>
      google(`${GOOGLE}/v1/places/${encodeURIComponent(id)}?languageCode=nl`, { method: "GET" }, FIELDS.join(","))
    ),
  );
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? mapPlace(r.value)
      : { google_place_id: placeIds[i], error: String(r.reason?.message ?? r.reason) }
  );
}

// Eerste Google-foto van een zaak. De browser en de app bewaren ze 30 dagen, zodat Google
// per toestel maar één keer per foto aangesproken wordt.
async function photo(placeId: string, width: number) {
  const meta = await fetch(`${GOOGLE}/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": "photos" },
  });
  if (!meta.ok) return json({ error: `Google ${meta.status}` }, meta.status === 404 ? 404 : 502);
  const first = (await meta.json()).photos?.[0];
  if (!first?.name) {
    return json({ error: "Geen foto bij Google" }, 404, { "Cache-Control": "public, max-age=86400" });
  }
  const img = await fetch(`${GOOGLE}/v1/${first.name}/media?maxWidthPx=${width}&key=${encodeURIComponent(GOOGLE_KEY)}`);
  if (!img.ok || !img.body) return json({ error: `Google-foto ${img.status}` }, 502);
  const author = first.authorAttributions?.[0]?.displayName ?? "";
  return new Response(img.body, {
    headers: {
      ...cors,
      "Content-Type": img.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=2592000",
      "X-Photo-Author": encodeURIComponent(author),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("action") !== "photo") return json({ error: "Onbekende action" }, 400);
    // Een <img> kan geen headers meesturen, dus hier komt de sleutel mee in de URL.
    if (!APP_KEY || url.searchParams.get("key") !== APP_KEY) return json({ error: "Niet toegestaan" }, 401);
    if (!GOOGLE_KEY) return json({ error: "GOOGLE_PLACES_KEY ontbreekt" }, 500);
    const place = url.searchParams.get("place") ?? "";
    if (!/^[A-Za-z0-9_-]{8,}$/.test(place)) return json({ error: "Ongeldige place" }, 400);
    const width = Math.min(1600, Math.max(100, Number.parseInt(url.searchParams.get("w") ?? "800", 10) || 800));
    try {
      return await photo(place, width);
    } catch (e) {
      return json({ error: String((e as Error).message ?? e) }, 502);
    }
  }

  if (req.method !== "POST") return json({ error: "Niet ondersteund" }, 405);

  // Alleen de app zelf mag deze functie gebruiken (beschermt je Google-quotum).
  if (!APP_KEY || req.headers.get("apikey") !== APP_KEY) {
    return json({ error: "Niet toegestaan" }, 401);
  }
  if (!GOOGLE_KEY) return json({ error: "GOOGLE_PLACES_KEY ontbreekt" }, 500);

  try {
    const body = await req.json();
    if (body.action === "search") {
      const query = String(body.query ?? "").trim();
      if (query.length < 2) return json({ error: "Zoekterm te kort" }, 400);
      return json({ results: await search(query, String(body.city ?? "gent")) });
    }
    if (body.action === "details") {
      const ids = Array.isArray(body.placeIds) ? body.placeIds.map(String) : [];
      if (!ids.length) return json({ error: "Geen placeIds" }, 400);
      return json({ results: await details(ids) });
    }
    return json({ error: "Onbekende action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
});
