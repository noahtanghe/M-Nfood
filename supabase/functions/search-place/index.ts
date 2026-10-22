// M&N Foods — Edge Function "search-place"
// Zoekt restaurants op naam en haalt details (adres, prijs, openingsuren) op via
// Google Places API (New). De Google-sleutel staat als secret in Supabase, nooit in de app.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_PLACES_KEY = jouw Google-sleutel
//   APP_KEY           = de publishable key van je project (sb_publishable_...)
//
// Aanroepen (POST, JSON):
//   { "action": "search",  "query": "Gigi", "city": "gent" }
//   { "action": "details", "placeIds": ["ChIJ...", "ChIJ..."] }   // max 20 per keer

const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_KEY") ?? "";
const APP_KEY = Deno.env.get("APP_KEY") ?? "";

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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
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
    "https://places.googleapis.com/v1/places:searchText",
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
      google(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=nl`,
        { method: "GET" },
        FIELDS.join(","),
      )
    ),
  );
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? mapPlace(r.value)
      : { google_place_id: placeIds[i], error: String(r.reason?.message ?? r.reason) }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Alleen POST" }, 405);

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
