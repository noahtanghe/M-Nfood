# M&N Foods

Onze restaurantlijst voor Gent (en straks Kortrijk): waar we al waren, wie er was, welke score we gaven en waar we nog naartoe willen.

**App:** https://mnfoods.netlify.app/ (Netlify zet elke push naar `main` automatisch online)

## Op je gsm zetten (iPhone)

1. Open de link hierboven in **Safari**.
2. Tik op **Deel** en kies **Zet op beginscherm**.
3. Open M&N Foods voortaan via het icoon: schermvullend, zonder Safari-balken.

## Wat de app doet

- Kaart en lijst van alle restaurants, met filters op stad, categorie, status (nog niet, geweest, samen, alleen Noah, alleen Marie), prijs, minimale score en *nu open*.
- Per restaurant: adres, openingsuren, route, website, bellen en de stempels van Noah en Marie.
- **We zijn hier geweest**: kies wie er was en geef optioneel een score van 1 tot 10 met een opmerking.
- Restaurant toevoegen op naam via Google, of zelf met een speld op de kaart.
- Foto's per restaurant, *Verras me* en statistieken.
- Wijzigingen verschijnen live op de gsm van de ander en de laatst geladen lijst blijft zonder bereik zichtbaar.

## Opbouw

| Map | Inhoud |
| --- | --- |
| `index.html`, `css/`, `js/` | De app (gewone HTML, CSS en JavaScript-modules, geen build-stap) |
| `vendor/` | Leaflet 1.9.4 en supabase-js 2.118.0, lokaal zodat de app niet van een CDN afhangt |
| `fonts/`, `icons/` | IBM Plex Mono, Pinyon Script (OFL-licentie) en de app-iconen |
| `sw.js`, `manifest.webmanifest` | Installeerbaar en offline openen |
| `supabase/` | Databaseschema, startdata Gent en de Edge Function `search-place` |

## Supabase

- `supabase/schema.sql` en daarna `supabase/seed.sql` in de SQL Editor uitvoeren (eenmalig).
- Edge Function `search-place` met de secrets `GOOGLE_PLACES_KEY` en `APP_KEY` (= de publishable key). JWT-verificatie staat uit; de functie controleert zelf de `APP_KEY`.
- De app gebruikt enkel de publishable key (`js/config.js`). De secret key en de Google-sleutel staan nooit in deze repo.
- Er is geen login: wie de app-URL kent, kan de lijst aanpassen. Deel de link dus alleen met elkaar.

## Een nieuwe versie uitbrengen

Pas de bestanden aan, verhoog `VERSION` bovenaan `sw.js` en push naar `main`. Netlify zet de nieuwe versie binnen een minuut online; de app haalt ze op zodra je ze opent met bereik.

## Kortrijk toevoegen

Restaurants toevoegen kan rechtstreeks in de app (kies Kortrijk bovenaan en tik op *Restaurant toevoegen*). Voor een hele lijst in één keer kan dezelfde aanpak als `supabase/seed.sql` gebruikt worden.
