// Lijn-iconen (24×24, 1,5 px lijn). Categorie-iconen zijn eigen tekeningen.

const P = {
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5 10 17 19 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.8 8.8h.01M15.2 8.8h.01M12 12h.01M8.8 15.2h.01M15.2 15.2h.01" stroke-width="2.6"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  share: '<path d="M12 3.5v11"/><path d="m8 7.5 4-4 4 4"/><path d="M6 11.5H5v8.5h14v-8.5h-1"/>',
  pencil: '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  route: '<path d="M3.5 11 20.5 3.5 13 20.5l-2-7.5z"/>',
  map: '<path d="M9 4 3.5 6.2v13.6L9 17.6l6 2.4 5.5-2.2V4.2L15 6.4z"/><path d="M9 4v13.6M15 6.4V20"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.6 5.3 3.6 8.5s-1.2 6-3.6 8.5c-2.4-2.5-3.6-5.3-3.6-8.5S9.6 6 12 3.5z"/>',
  phone: '<path d="M5.5 4h3l1.8 4.6-2.2 1.5a11 11 0 0 0 5.8 5.8l1.5-2.2L20 15.5v3a1.5 1.5 0 0 1-1.6 1.5C10.6 19.5 4.5 13.4 4 5.6A1.5 1.5 0 0 1 5.5 4z"/>',
  camera: '<path d="M4 8h3.4L9 5.5h6L16.6 8H20a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.3" r="3.6"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
  refresh: '<path d="M19.5 11A7.5 7.5 0 0 0 6 6.6L4.5 8M4.5 4v4h4M4.5 13A7.5 7.5 0 0 0 18 17.4l1.5-1.4M19.5 20v-4h-4"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  // categorieën
  all: '<rect x="4.5" y="4.5" width="6" height="6"/><rect x="13.5" y="4.5" width="6" height="6"/><rect x="4.5" y="13.5" width="6" height="6"/><rect x="13.5" y="13.5" width="6" height="6"/>',
  brunch: '<path d="M5 10h11v3.8a5.2 5.2 0 0 1-5.2 5.2h-.6A5.2 5.2 0 0 1 5 13.8z"/><path d="M16 11.5h1.4a2.3 2.3 0 0 1 0 4.6H15.6"/><path d="M3.5 21h14"/><path d="M8.5 3.8c-.9 1 .9 1.9 0 3.2M12.3 3.8c-.9 1 .9 1.9 0 3.2"/>',
  burger: '<path d="M4.5 10.5a7.5 5.6 0 0 1 15 0z"/><path d="M3.8 13.6c1.4-1 2.7 1 4.1 0s2.7 1 4.1 0 2.7 1 4.1 0 2.7 1 4.1 0"/><path d="M5 16.6h14v.4a2.6 2.6 0 0 1-2.6 2.6H7.6A2.6 2.6 0 0 1 5 17z"/><path d="M10 7.6h.01M13.6 7h.01" stroke-width="2"/>',
  asian: '<path d="M3.5 12.5A8.5 6.8 0 0 0 20.5 12.5z"/><path d="M9.3 21h5.4"/><path d="M12.8 10 19.5 3.2M10.2 10l7.4-5.6"/>',
  fondue: '<path d="M5 11h14v3.4a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><path d="M5 12.6H3.2M19 12.6h1.8"/><path d="M12.6 11 16.8 4"/><circle cx="17.6" cy="3.2" r="1.3"/><path d="M8.6 11v2.2"/>',
  pizza: '<path d="M12 21.2 3.3 6.6a17 17 0 0 1 17.4 0z"/><path d="M4.9 9.2a14 14 0 0 1 14.2 0"/><circle cx="10.3" cy="12.4" r="1.25"/><circle cx="13.9" cy="11.2" r="1"/><circle cx="12.4" cy="15.8" r="1.05"/>',
  olive: '<path d="M4 20.5C9 16.8 12.8 11.5 15.4 3.5"/><path d="M9.4 14.6c-2.7.3-4.5-.7-5.4-2.7 2.5-.6 4.3.3 5.4 2.7z"/><path d="M12.6 9.2c.4-2.5 2-4 4.5-4.4.2 2.5-1.4 4-4.5 4.4z"/><ellipse cx="14.6" cy="15.6" rx="2.1" ry="2.7" transform="rotate(-35 14.6 15.6)"/><ellipse cx="18.9" cy="11.2" rx="1.8" ry="2.3" transform="rotate(-35 18.9 11.2)"/>',
  tea: '<path d="M8 4h8c0 3-1.7 4.6-1.7 7.4S16 15.8 16 18.5H8c0-2.7 1.7-4.3 1.7-7.1S8 7 8 4z"/><path d="M9.6 7.3h4.8"/><path d="M4.5 21h15"/>',
  taco: '<path d="M3 10a9 9 0 0 0 18 0"/><path d="M3 10c1.5-1.4 3-.1 4.5-1.2S10.5 9.9 12 8.8s3 1.2 4.5.1 3 .2 4.5 1.1"/><path d="M8 13.6h.01M12 14.8h.01M16 13.6h.01" stroke-width="2"/>',
  tapas: '<ellipse cx="12" cy="16.8" rx="9" ry="3.4"/><circle cx="7.9" cy="12.6" r="2"/><circle cx="12.2" cy="11.2" r="2.1"/><circle cx="16.3" cy="13" r="1.8"/><path d="M12.2 9.1V4.6"/>',
  sushi: '<ellipse cx="12" cy="8" rx="7" ry="3.4"/><path d="M5 8v8.4c0 1.9 3.1 3.4 7 3.4s7-1.5 7-3.4V8"/><ellipse cx="12" cy="8" rx="3.1" ry="1.4"/>',
  leaf: '<path d="M20 4C11 4 5.5 8.6 5.5 15.4c0 1.6.4 3 1 4.1 1.1.6 2.5 1 4.1 1C17.4 20.5 20 13 20 4z"/><path d="M4 21 14.5 10.5"/>',
  fries: '<path d="M6 10.5h12l-2.4 10.5H8.4z"/><path d="M8 10.5 7.1 3.8M10.5 10.5l-.2-7.6M13.5 10.5l.3-7.1M16 10.5l1.2-6"/>',
  cloche: '<path d="M3 17.5h18"/><path d="M4.6 17.5a7.4 7.4 0 0 1 14.8 0"/><path d="M12 10.1V8.6"/><circle cx="12" cy="7.5" r="1.1"/><path d="M2.5 20.2h19"/>',
  beer: '<path d="M6 8h10v11.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 6 19.5z"/><path d="M16 10.3h1.6a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H16"/><path d="M6 8a2.6 2.6 0 0 1 2.9-2.6 2.9 2.9 0 0 1 5.1-.3A2.4 2.4 0 0 1 16 8"/><path d="M9.2 11.5v6M12.8 11.5v6"/>',
  dish: '<path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 10V8"/>',
};

const CATEGORY_ICON = {
  'Ontbijt & brunch': 'brunch',
  Amerikaans: 'burger',
  Aziatisch: 'asian',
  Fondue: 'fondue',
  Italiaans: 'pizza',
  Mediterraans: 'olive',
  Turks: 'tea',
  Mexicaans: 'taco',
  'Tapas & sharing': 'tapas',
  Sushi: 'sushi',
  Vegetarisch: 'leaf',
  Vlaams: 'fries',
  'Fine dining': 'cloche',
  'Café & bar': 'beer',
};

export function icon(name, cls = '') {
  return `<svg class="ico${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.dish}</svg>`;
}

export const categoryIcon = (categoryName, cls = '') => icon(CATEGORY_ICON[categoryName] || 'dish', cls);

// Vul alle elementen met data-icon="naam" (statische knoppen in index.html).
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon);
  });
}
