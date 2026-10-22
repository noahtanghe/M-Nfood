// Statistieken per stad.

import { state, cityRestaurants, currentCity } from './state.js';
import { esc, formatScore, formatDate } from './util.js';
import { icon, categoryIcon } from './icons.js';
import { lockScroll, unlockScroll } from './sheets.js';
import { stampsSmall, kindLabel } from './ui.js';

const page = () => document.getElementById('stats');
let nav = { close: () => {}, openRestaurant: () => {} };
let isOpen = false;

export function initStats(handlers) {
  nav = { ...nav, ...handlers };
  page().addEventListener('click', (e) => {
    if (e.target.closest('[data-act="close"]')) nav.close();
    const row = e.target.closest('[data-open]');
    if (row) nav.openRestaurant(row.dataset.open);
  });
}

export function openStats() {
  const el = page();
  if (!isOpen) {
    isOpen = true;
    el.hidden = false;
    lockScroll();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
  }
  render();
}

export function closeStats() {
  if (!isOpen) return;
  isOpen = false;
  const el = page();
  el.classList.remove('is-open');
  unlockScroll();
  setTimeout(() => {
    if (!isOpen) el.hidden = true;
  }, 300);
}

export const refreshStats = () => isOpen && render();

const pct = (n, total) => (total ? (n / total) * 100 : 0);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const zaken = (n) => (n === 1 ? '1 zaak' : `${n} zaken`);

function render() {
  const city = currentCity();
  const list = cityRestaurants();
  const el = page();
  const total = list.length;
  const count = (s) => list.filter((r) => r.status === s).length;
  const samen = count('samen');
  const noah = count('noah');
  const marie = count('marie');
  const niet = count('nog_niet');

  const head = `
    <header class="statshead">
      <button type="button" class="icon-btn icon-btn--on-ink" data-act="close" aria-label="Terug naar de lijst">${icon('close')}</button>
      <div class="statshead__text"><h1 class="statshead__title">Statistieken</h1><p class="statshead__city">${esc(city.name)}</p></div>
    </header>`;

  if (!total) {
    el.innerHTML = `<div class="page__scroll" data-scroll>${head}<div class="stats"><p class="note">Nog geen restaurants in ${esc(city.name)}. Zodra jullie er een paar toevoegen, verschijnen hier de cijfers.</p></div></div>`;
    return;
  }

  // per categorie
  const perCat = state.categories
    .map((c) => {
      const inCat = list.filter((r) => r.categories.includes(c.name));
      return { name: c.name, total: inCat.length, visited: inCat.filter((r) => r.status !== 'nog_niet').length };
    })
    .filter((c) => c.total);

  // scores
  const noahScores = list.filter((r) => r.noah_score != null).map((r) => r.noah_score);
  const marieScores = list.filter((r) => r.marie_score != null).map((r) => r.marie_score);
  const shared = list.filter((r) => r.noah_score != null && r.marie_score != null);
  let verdict = 'Nog geen zaken waar jullie allebei een score gaven.';
  if (shared.length) {
    const diff = avg(shared.map((r) => r.noah_score - r.marie_score));
    const n = shared.length === 1 ? 'Op 1 zaak gaven jullie' : `Op ${shared.length} zaken gaven jullie`;
    if (Math.abs(diff) < 0.05) verdict = `${n} allebei een score, en gemiddeld precies even hoog.`;
    else verdict = `${n} allebei een score. ${diff < 0 ? 'Noah' : 'Marie'} is strenger: gemiddeld ${formatScore(Math.round(Math.abs(diff) * 10) / 10)} punt lager.`;
  }

  const top = list
    .filter((r) => r.avg_score != null)
    .sort((a, b) => b.avg_score - a.avg_score || a.name.localeCompare(b.name, 'nl'))
    .slice(0, 5);
  const lastDate = (r) => [r.noah_visited_on, r.marie_visited_on].filter(Boolean).sort().at(-1) || null;
  const recent = list
    .filter((r) => lastDate(r))
    .sort((a, b) => lastDate(b).localeCompare(lastDate(a)))
    .slice(0, 5);

  const seg = (cls, n, label) => (n ? `<span class="bar__seg bar__seg--${cls}" style="width:${pct(n, total)}%" title="${esc(label)}: ${n}"></span>` : '');

  el.innerHTML = `
    <div class="page__scroll" data-scroll>
      ${head}
      <div class="stats">
        <section class="block">
          <div class="block__head"><h2 class="block__title">Waar we al waren</h2><span class="block__aside">${total - niet} van ${total}</span></div>
          <div class="bar" role="img" aria-label="${samen} samen, ${noah} alleen Noah, ${marie} alleen Marie, ${niet} nog niet">
            ${seg('samen', samen, 'Samen')}${seg('noah', noah, 'Alleen Noah')}${seg('marie', marie, 'Alleen Marie')}${seg('niet', niet, 'Nog niet')}
          </div>
          <table class="ledger">
            <tbody>
              <tr><th scope="row"><span class="pin pin--samen"></span>Samen geweest</th><td>${samen}</td></tr>
              <tr><th scope="row"><span class="pin pin--noah"></span>Alleen Noah</th><td>${noah}</td></tr>
              <tr><th scope="row"><span class="pin pin--marie"></span>Alleen Marie</th><td>${marie}</td></tr>
              <tr><th scope="row"><span class="pin pin--nog_niet"></span>Nog niet geweest</th><td>${niet}</td></tr>
            </tbody>
          </table>
          <p class="note">Noah was in ${zaken(samen + noah)}, Marie in ${zaken(samen + marie)}.</p>
        </section>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Per categorie</h2></div>
          <ul class="catstats">
            ${perCat
              .map(
                (c) => `<li class="catstats__row">
                  <span class="catstats__name">${categoryIcon(c.name)}${esc(c.name)}</span>
                  <span class="catstats__bar"><span style="width:${pct(c.visited, c.total)}%"></span></span>
                  <span class="catstats__n">${c.visited}/${c.total}</span>
                </li>`,
              )
              .join('')}
          </ul>
        </section>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Scores</h2></div>
          <table class="ledger">
            <tbody>
              <tr><th scope="row"><span class="pin pin--noah"></span>Noah, gemiddeld</th><td>${noahScores.length ? formatScore(Math.round(avg(noahScores) * 10) / 10) : '–'}<small>${noahScores.length ? ` uit ${noahScores.length}` : ''}</small></td></tr>
              <tr><th scope="row"><span class="pin pin--marie"></span>Marie, gemiddeld</th><td>${marieScores.length ? formatScore(Math.round(avg(marieScores) * 10) / 10) : '–'}<small>${marieScores.length ? ` uit ${marieScores.length}` : ''}</small></td></tr>
            </tbody>
          </table>
          <p class="note">${esc(verdict)}</p>
        </section>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Toppers</h2></div>
          ${top.length ? `<ol class="mini-list">${top.map((r) => miniRow(r, formatScore(r.avg_score))).join('')}</ol>` : '<p class="note">Nog geen scores. Geef na jullie volgende etentje een score en de toppers verschijnen hier.</p>'}
        </section>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Laatst geweest</h2></div>
          ${recent.length ? `<ul class="mini-list">${recent.map((r) => miniRow(r, formatDate(lastDate(r), { day: 'numeric', month: 'short' }))).join('')}</ul>` : '<p class="note">Nog geen bezoeken met een datum.</p>'}
        </section>
      </div>
    </div>`;
}

function miniRow(r, aside) {
  return `<li><button type="button" class="mini-row" data-open="${r.id}">
      <span class="mini-row__main"><span class="mini-row__name">${esc(r.name)}</span><span class="mini-row__kind">${esc(kindLabel(r))}</span></span>
      <span class="mini-row__aside">${esc(aside)}</span>
      ${stampsSmall(r)}
    </button></li>`;
}
