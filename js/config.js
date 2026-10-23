// Publieke instellingen van de app. De publishable key is bedoeld om in de browser te staan;
// de secret key en de Google-sleutel staan hier nooit (die zitten als secret in Supabase).
export const SUPABASE_URL = 'https://hlkkxebahjcejduqkmff.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_EGkZjBbDcqwZsK4pNzVBzg_merlYEEj';
export const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/search-place`;
export const PHOTO_BUCKET = 'photos';

// Breedte van de Google-foto's. Eén maat voor alle schermen, zodat elke foto maar één keer binnenkomt.
export const PHOTO_WIDTH = 800;

// Openingsuren worden opnieuw opgehaald als ze ouder zijn dan dit.
export const HOURS_MAX_AGE_DAYS = 14;

export const PEOPLE = [
  { id: 'noah', name: 'Noah', initial: 'N' },
  { id: 'marie', name: 'Marie', initial: 'M' },
];
export const PERSON = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

export const CITIES = [
  { id: 'gent', name: 'Gent', center: [51.0543, 3.7174] },
  { id: 'kortrijk', name: 'Kortrijk', center: [50.828, 3.2649] },
];

export const STATUSES = [
  { id: 'alle', label: 'Alles' },
  { id: 'nog_niet', label: 'Nog niet' },
  { id: 'geweest', label: 'Geweest' },
];

export const WHO = [
  { id: '', label: 'Maakt niet uit' },
  { id: 'samen', label: 'Samen' },
  { id: 'noah', label: 'Alleen Noah' },
  { id: 'marie', label: 'Alleen Marie' },
];

export const SORTS = [
  { id: 'naam', label: 'Naam' },
  { id: 'score', label: 'Score' },
  { id: 'afstand', label: 'Afstand' },
  { id: 'prijs', label: 'Prijs' },
];

// Kleuren voor zaken zonder foto: rustige tinten uit dezelfde familie als de rest van de app.
export const TONES = ['#24533f', '#6e7428', '#8c4a2b', '#3a2a20', '#4f5e3a', '#7a5a2e', '#2f4b45', '#6b3a2c'];

// Standaardtegels van OpenStreetMap (geen sleutel nodig). De gedempte kleur komt uit css/app.css.
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
