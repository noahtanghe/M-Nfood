// Openingsuren uit Google Places (New): { weekday_text: [7 regels, maandag eerst], periods: [...], permanently_closed }
// periods: { open: { day: 0-6 (0 = zondag), hour, minute }, close: {...} }

import { cap } from './util.js';

const WEEK = 7 * 1440;
const DAYS_SUNDAY_FIRST = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAYS_MONDAY_FIRST = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

const pad = (n) => String(n).padStart(2, '0');
const minuteOfWeek = (d) => d.getDay() * 1440 + d.getHours() * 60 + d.getMinutes();
const mow = (p) => (p.day ?? 0) * 1440 + (p.hour ?? 0) * 60 + (p.minute ?? 0);
const hhmm = (v) => {
  const m = ((v % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Index 0 = maandag, zoals weekday_text. */
export const todayIndex = (d = new Date()) => (d.getDay() + 6) % 7;

export function hasHours(oh) {
  return !!(oh && (oh.permanently_closed || (Array.isArray(oh.periods) && oh.periods.length) || (Array.isArray(oh.weekday_text) && oh.weekday_text.length)));
}

/** Rijen voor de weekweergave: [{ day: 'Maandag', hours: '12:00–14:00, 18:00–22:00' }] */
export function weekRows(oh) {
  if (!oh || !Array.isArray(oh.weekday_text) || oh.weekday_text.length !== 7) return null;
  return oh.weekday_text.map((line, i) => {
    const m = String(line).match(/^([^:]+):\s*(.*)$/);
    const day = m ? m[1].trim() : DAYS_MONDAY_FIRST[i];
    const hours = (m ? m[2] : String(line))
      .replace(/[  ]/g, '')
      .replace(/[  ]/g, ' ')
      .replace(/\s*[–-]\s*/g, '–')
      .trim();
    return { day: cap(day), hours: cap(hours) || 'Onbekend' };
  });
}

/**
 * Huidige toestand: { known, open, text }
 * text is bv. 'Nu open tot 22:00', 'Gesloten, opent om 18:00', 'Gesloten, opent morgen om 12:00'.
 */
export function openState(oh, now = new Date()) {
  if (!oh) return { known: false, open: null, text: '' };
  if (oh.permanently_closed) return { known: true, open: false, closedForGood: true, short: 'Definitief dicht', text: 'Definitief gesloten volgens Google' };
  const periods = Array.isArray(oh.periods) ? oh.periods.filter((p) => p && p.open) : [];
  if (!periods.length) return { known: false, open: null, text: '' };

  const t = minuteOfWeek(now);
  let next = null;
  for (const p of periods) {
    const s = mow(p.open);
    if (!p.close) return { known: true, open: true, short: 'Altijd open', text: 'Altijd open' };
    let e = mow(p.close);
    if (e <= s) e += WEEK;
    if ((t >= s && t < e) || (t + WEEK >= s && t + WEEK < e)) {
      return { known: true, open: true, short: `Open tot ${hhmm(e)}`, text: `Nu open tot ${hhmm(e)}` };
    }
    const upcoming = s > t ? s : s + WEEK;
    if (next === null || upcoming < next) next = upcoming;
  }
  if (next === null) return { known: true, open: false, short: 'Gesloten', text: 'Nu gesloten' };
  const dayDiff = Math.floor(next / 1440) - Math.floor(t / 1440);
  let when;
  if (dayDiff === 0) when = `opent om ${hhmm(next)}`;
  else if (dayDiff === 1) when = `opent morgen om ${hhmm(next)}`;
  else when = `opent ${DAYS_SUNDAY_FIRST[Math.floor(next / 1440) % 7]} om ${hhmm(next)}`;
  return { known: true, open: false, short: 'Gesloten', next: when, text: `Gesloten, ${when}` };
}

export const isOpenNow = (oh, now = new Date()) => {
  const s = openState(oh, now);
  return s.known ? s.open : null;
};
