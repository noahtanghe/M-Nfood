// Statistieken per stad.

import { state, cityRestaurants, currentCity } from './state.js';
import { esc, formatScore, formatDate } from './util.js';
import { icon, categoryIcon, categoryHue } from './icons.js';
import { lockScroll, unlockScroll } from './sheets.js';
import { stamps, kindLabel, mediaHtml } from './ui.js';

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
const round1 = (n) => formatScore(Math.round(n * 10) / 10);

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
  const been = total - niet;

  const head = `
    <header class="statshead">
      <button type="button" class="icon-btn" data-act="close" aria-label="Terug naar de lijst">${icon('chevronLeft')}</button>
      <div class="statshead__text"><h1 class="statshead__title">Statistieken</h1><p class="statshead__city">${esc(city.name)}</p></div>
    </header>`;

  if (!total) {
    el.innerHTML = `<div class="page__scroll" data-scroll>${head}<div class="stats"><p class="note">Nog geen restaurants in ${esc(city.name)}. Zodra jullie er een paar toevoegen, verschijnen hier de cijfers.</p></div></div>`;
    return;
  }

  const perCat = state.categories
    .map((c) => {
      const inCat = list.filter((r) => r.categories.includes(c.name));
      return { name: c.name, total: inCat.length, visited: inCat.filter((r) => r.status !== 'nog_niet').length };
    })
    .filter((c) => c.total);

  const noahScores = list.filter((r) => r.noah_score != null).map((r) => r.noah_score);
  const marieScores = list.filter((r) => r.marie_score != null).map((r) => r.marie_score);
  const shared = list.filter((r) => r.noah_score != null && r.marie_score != null);
  let verdict = 'Zodra jullie allebei een zaak scoren, zie je hier wie de strengste is.';
  if (shared.length) {
    const diff = avg(shared.map((r) => r.noah_score - r.marie_score));
    const n = shared.length === 1 ? 'Op 1 zaak gaven jullie' : `Op ${shared.length} zaken gaven jullie`;
    if (Math.abs(diff) < 0.05) verdict = `${n} allebei een score, en gemiddeld precies even hoog.`;
    else verdict = `${n} allebei een score. ${diff < 0 ? 'Noah' : 'Marie'} is strenger: gemiddeld ${round1(Math.abs(diff))} punt lager.`;
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

  const seg = (cls, n) => (n ? `<span class="progress__seg progress__seg--${cls}" style="width:${pct(n, total)}%"></span>` : '');
  const scoreTile = (pid, name, scores) => `
    <div class="tile tile--${pid}">
      <span class="tile__n">${scores.length ? round1(avg(scores)) : '–'}</span>
      <span class="tile__label">${name} gemiddeld${scores.length ? `, uit ${scores.length}` : ''}</span>
    </div>`;

  el.innerHTML = `
    <div class="page__scroll" data-scroll>
      ${head}
      <div class="stats">
        <section class="summary" aria-label="Waar we al waren">
          <p class="summary__big">${been}<span class="summary__of"> van ${total}</span></p>
          <p class="summary__text">restaurants in ${esc(city.name)} bezocht door minstens één van jullie</p>
          <div class="progress" role="img" aria-label="${samen} samen, ${noah} alleen Noah, ${marie} alleen Marie, ${niet} nog niet">
            ${seg('samen', samen)}${seg('noah', noah)}${seg('marie', marie)}
          </div>
        </section>

        <div class="tiles tiles--3">
          <div class="tile tile--samen"><span class="tile__n">${samen}</span><span class="tile__label">Samen</span></div>
          <div class="tile tile--noah"><span class="tile__n">${noah}</span><span class="tile__label">Alleen Noah</span></div>
          <div class="tile tile--marie"><span class="tile__n">${marie}</span><span class="tile__label">Alleen Marie</span></div>
        </div>
        <p class="note">Noah was in ${zaken(samen + noah)}, Marie in ${zaken(samen + marie)}. Nog ${zaken(niet)} te gaan.</p>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Per categorie</h2></div>
          <ul class="catstats">
            ${perCat
              .map(
                (c) => `<li class="catstats__row hue-${categoryHue(c.name)}">
                  <span class="catstats__icon">${categoryIcon(c.name)}</span>
                  <span class="catstats__main">
                    <span class="catstats__top"><span class="catstats__name">${esc(c.name)}</span><span class="catstats__n">${c.visited} van ${c.total}</span></span>
                    <span class="catstats__bar"><span style="width:${pct(c.visited, c.total)}%"></span></span>
                  </span>
                </li>`,
              )
              .join('')}
          </ul>
        </section>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Scores</h2></div>
          <div class="tiles tiles--2">${scoreTile('noah', 'Noah', noahScores)}${scoreTile('marie', 'Marie', marieScores)}</div>
          <p class="note">${esc(verdict)}</p>
        </section>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Toppers</h2></div>
          ${top.length ? `<ul class="mini-list">${top.map((r) => miniRow(r, `${formatScore(r.avg_score)}`, true)).join('')}</ul>` : '<p class="note">Nog geen scores. Geef na jullie volgende etentje een score en de toppers verschijnen hier.</p>'}
        </section>

        <section class="block">
          <div class="block__head"><h2 class="block__title">Laatst geweest</h2></div>
          ${recent.length ? `<ul class="mini-list">${recent.map((r) => miniRow(r, formatDate(lastDate(r), { day: 'numeric', month: 'short' }))).join('')}</ul>` : '<p class="note">Nog geen bezoeken met een datum.</p>'}
        </section>
      </div>
    </div>`;
}

function miniRow(r, aside, isScore = false) {
  return `<li><button type="button" class="mini-row" data-open="${r.id}">
      ${mediaHtml(r, { cls: 'mini-row__thumb' })}
      <span class="mini-row__main"><span class="mini-row__name">${esc(r.name)}</span><span class="mini-row__kind">${esc(kindLabel(r))}</span></span>
      ${isScore ? `<span class="scorebadge">${esc(aside)}</span>` : `<span class="mini-row__aside">${esc(aside)}</span>`}
      ${isScore ? '' : stamps(r, 'stamps--sm')}
    </button></li>`;
}
