// "Verras me": kiest willekeurig een zaak binnen de huidige filters, bij voorkeur een waar jullie nog niet waren.

import { esc, priceHtml, prefersReducedMotion, toast } from './util.js';
import { icon } from './icons.js';
import { openOverlay } from './sheets.js';
import { kindLabel } from './ui.js';

const pickFrom = (arr, avoid) => {
  if (arr.length === 1) return arr[0];
  let r;
  do r = arr[Math.floor(Math.random() * arr.length)];
  while (r === avoid);
  return r;
};

export function openSurprise({ list, onOpen }) {
  const fresh = list.filter((r) => r.status === 'nog_niet');
  const pool = fresh.length ? fresh : list;
  if (!pool.length) {
    toast('Geen zaken binnen je filters om uit te kiezen');
    return;
  }
  const note = fresh.length
    ? `Gekozen uit ${fresh.length === 1 ? '1 zaak' : `${fresh.length} zaken`} waar jullie nog niet waren.`
    : 'Jullie waren overal al, dus gekozen uit alles binnen je filters.';

  const ov = openOverlay(
    'surprise',
    `<div class="surprise__backdrop" data-close></div>
     <div class="surprise__card" role="dialog" aria-modal="true" aria-labelledby="surprise-name">
       <button type="button" class="icon-btn surprise__x" data-close aria-label="Sluiten">${icon('close')}</button>
       <p class="surprise__lead">Wat dacht je van</p>
       <p class="surprise__name" id="surprise-name" aria-live="polite" data-name></p>
       <p class="surprise__meta" data-meta></p>
       <p class="surprise__note">${esc(note)}</p>
       <div class="surprise__actions">
         <button type="button" class="btn btn--ghost" data-again>${icon('dice')}Nog eens</button>
         <button type="button" class="btn btn--ink" data-open>Bekijk</button>
       </div>
     </div>`,
  );

  let chosen = null;
  let timer = null;
  const nameEl = ov.el.querySelector('[data-name]');
  const metaEl = ov.el.querySelector('[data-meta]');

  const show = (r, final) => {
    nameEl.textContent = r.name;
    nameEl.classList.toggle('is-final', final);
    metaEl.innerHTML = final ? `<span>${esc(kindLabel(r))}</span>${priceHtml(r.price_level)}${r.address ? `<span>${esc(r.address.replace(/,\s*\d{4}.*$/, ''))}</span>` : ''}` : '';
  };

  function roll() {
    clearTimeout(timer);
    const target = pickFrom(pool, chosen);
    chosen = target;
    if (prefersReducedMotion() || pool.length < 3) {
      show(target, true);
      return;
    }
    let step = 0;
    const steps = 11;
    const tick = () => {
      step += 1;
      if (step >= steps) {
        show(target, true);
        return;
      }
      show(pool[Math.floor(Math.random() * pool.length)], false);
      timer = setTimeout(tick, 40 + step * 14);
    };
    tick();
  }

  ov.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-again]')) roll();
    else if (e.target.closest('[data-open]') && chosen) {
      clearTimeout(timer);
      const id = chosen.id;
      ov.close();
      onOpen(id);
    }
  });
  roll();
}
