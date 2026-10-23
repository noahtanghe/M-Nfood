// "We zijn hier geweest": wie was er, met een optionele score van 1 tot 10.

import { PERSON } from './config.js';
import { openSheet, confirmDialog } from './sheets.js';
import { esc, todayISO, toast, errorText, formatDate } from './util.js';
import { icon } from './icons.js';
import { personDot } from './ui.js';
import * as data from './data.js';

export function openVisitSheet(r, { person = null, onSaved } = {}) {
  const sheet = openSheet({ title: 'Wie is er geweest?', className: 'sheet--visit' });
  const existing = (pid) =>
    r[`${pid}_visited`]
      ? { score: r[`${pid}_score`], comment: r[`${pid}_comment`] || '', visited_on: r[`${pid}_visited_on`] || '' }
      : null;

  let who = person ? [person] : null;
  const form = {};
  let date = null;
  let saving = false;

  const subFor = (pid) => {
    const ex = existing(pid);
    if (!ex) return 'Nog niet geweest';
    return ex.score != null ? `Geweest, score ${ex.score}` : 'Geweest, nog geen score';
  };

  function stepWho() {
    sheet.setTitle('Wie is er geweest?');
    sheet.body.innerHTML = `
      <p class="sheet__lead">${esc(r.name)}</p>
      <div class="who">
        <button type="button" class="who__opt" data-who="samen">
          <span class="who__stamps">${personDot('noah')}${personDot('marie')}</span>
          <span class="who__text"><span class="who__name">Samen</span><span class="who__sub">Allebei een score geven</span></span>
          ${icon('chevronRight')}
        </button>
        <button type="button" class="who__opt" data-who="noah">
          <span class="who__stamps">${personDot('noah')}</span>
          <span class="who__text"><span class="who__name">Noah</span><span class="who__sub">${esc(subFor('noah'))}</span></span>
          ${icon('chevronRight')}
        </button>
        <button type="button" class="who__opt" data-who="marie">
          <span class="who__stamps">${personDot('marie')}</span>
          <span class="who__text"><span class="who__name">Marie</span><span class="who__sub">${esc(subFor('marie'))}</span></span>
          ${icon('chevronRight')}
        </button>
      </div>`;
    sheet.setFoot('');
  }

  function personSection(pid) {
    const f = form[pid];
    const p = PERSON[pid];
    const ex = existing(pid);
    const nums = Array.from({ length: 10 }, (_, i) => i + 1)
      .map((n) => `<button type="button" class="scale__n${f.score === n ? ' is-on' : ''}" role="radio" aria-checked="${f.score === n}" aria-label="${n} op 10" data-score="${n}">${n}</button>`)
      .join('');
    return `
      <section class="vp vp--${pid}" data-pid="${pid}">
        <h3 class="vp__title">${personDot(pid)}Score van ${p.name}</h3>
        <div class="scale" role="radiogroup" aria-label="Score van ${p.name}">${nums}</div>
        <p class="vp__hint" data-hint>${hintText(f.score)}</p>
        <label class="field">
          <span class="field__label">Opmerking van ${p.name} <span class="field__opt">optioneel</span></span>
          <textarea class="input" rows="2" data-comment placeholder="Wat viel op?">${esc(f.comment)}</textarea>
        </label>
        ${ex ? `<button type="button" class="linkbtn linkbtn--danger" data-remove="${pid}">Bezoek van ${p.name} wissen</button>` : ''}
      </section>`;
  }

  const hintText = (score) => (score == null ? 'Nog geen score. Dat kan ook later.' : `${score} op 10. Tik nog eens om te wissen.`);

  function stepForm() {
    for (const pid of who) {
      const ex = existing(pid);
      form[pid] ??= { score: ex?.score ?? null, comment: ex?.comment ?? '' };
    }
    date ??= who.map((pid) => existing(pid)?.visited_on).find(Boolean) || todayISO();
    sheet.setTitle(who.length === 2 ? 'Samen geweest' : `${PERSON[who[0]].name} is geweest`);
    sheet.body.innerHTML = `
      ${person ? '' : `<button type="button" class="linkbtn linkbtn--back" data-back>${icon('chevronLeft')}Iemand anders kiezen</button>`}
      <p class="sheet__lead">${esc(r.name)}</p>
      ${who.map(personSection).join('')}
      <label class="field">
        <span class="field__label">Wanneer</span>
        <input type="date" class="input" data-date value="${esc(String(date).slice(0, 10))}" max="${todayISO()}">
      </label>`;
    sheet.setFoot(`<button type="button" class="btn btn--ink btn--block" data-save>Bezoek opslaan</button>`);
  }

  sheet.body.addEventListener('click', async (e) => {
    const whoBtn = e.target.closest('[data-who]');
    if (whoBtn) {
      who = whoBtn.dataset.who === 'samen' ? ['noah', 'marie'] : [whoBtn.dataset.who];
      stepForm();
      return;
    }
    if (e.target.closest('[data-back]')) {
      stepWho();
      return;
    }
    const scoreBtn = e.target.closest('[data-score]');
    if (scoreBtn) {
      const section = scoreBtn.closest('[data-pid]');
      const pid = section.dataset.pid;
      const n = Number(scoreBtn.dataset.score);
      form[pid].score = form[pid].score === n ? null : n;
      section.querySelectorAll('[data-score]').forEach((b) => {
        const on = Number(b.dataset.score) === form[pid].score;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
      });
      section.querySelector('[data-hint]').textContent = hintText(form[pid].score);
      return;
    }
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      const pid = removeBtn.dataset.remove;
      const ok = await confirmDialog({
        title: `Bezoek van ${PERSON[pid].name} wissen?`,
        message: 'De score en opmerking verdwijnen. Het restaurant blijft op de lijst.',
        confirm: 'Wissen',
      });
      if (!ok) return;
      try {
        await data.deleteVisit(r.id, pid);
        sheet.close();
        toast(`Bezoek van ${PERSON[pid].name} gewist`);
        onSaved?.([]);
      } catch (err) {
        toast(`Wissen lukte niet: ${errorText(err)}`);
      }
    }
  });

  sheet.body.addEventListener('input', (e) => {
    const ta = e.target.closest('[data-comment]');
    if (ta) form[ta.closest('[data-pid]').dataset.pid].comment = ta.value;
    if (e.target.matches('[data-date]')) date = e.target.value;
  });

  sheet.foot.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn || saving) return;
    saving = true;
    btn.disabled = true;
    btn.textContent = 'Opslaan…';
    const rows = who.map((pid) => ({
      restaurant_id: r.id,
      person_id: pid,
      score: form[pid].score,
      comment: form[pid].comment.trim() || null,
      visited_on: date || null,
    }));
    try {
      await data.saveVisits(rows);
      sheet.close();
      const when = date && date !== todayISO() ? ` (${formatDate(date)})` : '';
      toast(`Bezoek opgeslagen${when}`);
      onSaved?.(who);
    } catch (err) {
      saving = false;
      btn.disabled = false;
      btn.textContent = 'Bezoek opslaan';
      toast(`Opslaan lukte niet: ${errorText(err)}`);
    }
  });

  if (who) stepForm();
  else stepWho();
  return sheet;
}
