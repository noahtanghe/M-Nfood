// Onderblad met extra filters: prijs, minimale score, nu open.

import { state, savePrefs, filtered, clearFilters } from './state.js';
import { openSheet } from './sheets.js';

const MIN_SCORES = [0, 6, 7, 8, 9];

export function openFilterSheet({ onChange }) {
  const sheet = openSheet({ title: 'Filters', className: 'sheet--filters' });

  function render() {
    const count = filtered().length;
    sheet.body.innerHTML = `
      <section class="fgroup">
        <h3 class="fgroup__title">Prijs</h3>
        <div class="boxes boxes--3" role="group" aria-label="Prijs">
          ${[1, 2, 3]
            .map((n) => {
              const on = state.prices.has(n);
              return `<button type="button" class="box${on ? ' is-on' : ''}" aria-pressed="${on}" data-price="${n}">${'€'.repeat(n)}</button>`;
            })
            .join('')}
        </div>
        <p class="fgroup__hint">Meerdere kiezen mag. Prijzen zijn een ruwe schatting van Google.</p>
      </section>
      <section class="fgroup">
        <h3 class="fgroup__title">Minimale score</h3>
        <div class="boxes boxes--5" role="radiogroup" aria-label="Minimale score">
          ${MIN_SCORES.map((n) => {
            const on = state.minScore === n;
            return `<button type="button" class="box${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-min="${n}">${n ? `${n}+` : 'Alle'}</button>`;
          }).join('')}
        </div>
        <p class="fgroup__hint">Gemiddelde van Noah en Marie. Zaken zonder score vallen weg.</p>
      </section>
      <section class="fgroup">
        <label class="switch">
          <span class="switch__text"><span class="fgroup__title">Nu open</span><span class="fgroup__hint">Volgens de openingsuren van Google.</span></span>
          <input type="checkbox" class="switch__input" data-open ${state.openNow ? 'checked' : ''}>
          <span class="switch__track" aria-hidden="true"></span>
        </label>
      </section>`;
    sheet.setFoot(`
      <button type="button" class="btn btn--ghost" data-clear>Wis filters</button>
      <button type="button" class="btn btn--ink" data-done>${count === 1 ? 'Toon 1 zaak' : `Toon ${count} zaken`}</button>`);
  }

  const changed = () => {
    savePrefs();
    onChange();
    render();
  };

  sheet.body.addEventListener('click', (e) => {
    const p = e.target.closest('[data-price]');
    if (p) {
      const n = Number(p.dataset.price);
      if (state.prices.has(n)) state.prices.delete(n);
      else state.prices.add(n);
      changed();
      return;
    }
    const m = e.target.closest('[data-min]');
    if (m) {
      state.minScore = Number(m.dataset.min);
      changed();
    }
  });
  sheet.body.addEventListener('change', (e) => {
    if (e.target.matches('[data-open]')) {
      state.openNow = e.target.checked;
      changed();
    }
  });
  sheet.foot.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) {
      clearFilters();
      changed();
    } else if (e.target.closest('[data-done]')) {
      sheet.close();
    }
  });

  render();
  return sheet;
}
