/* ==========================================================================
   app.js — 화면 렌더링과 상호작용
   ========================================================================== */
(function () {
  'use strict';

  const MEALS = Store.MEAL_TYPES;
  const LABEL = Store.MEAL_LABEL;

  const ICONS = {
    breakfast: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v3M5.2 6.2l2 2M18.8 6.2l-2 2"/><path d="M4 15.5h16"/><path d="M7 15.5a5 5 0 0 1 10 0"/><path d="M3 19h18"/></svg>',
    lunch: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/></svg>',
    dinner: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
    snack: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.2"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="14.5" cy="9.2" r=".9" fill="currentColor" stroke="none"/><circle cx="10.5" cy="15" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r=".9" fill="currentColor" stroke="none"/></svg>',
  };

  const PLATE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="4"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const PENCIL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5 17.5 10.5"/></svg>';
  const TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.5 7l.8 12.1A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 4.2 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.9l5.4-.8z"/></svg>';
  const CLOSE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  const MEAL_COLORS = { breakfast: '#0F172A', lunch: '#334155', dinner: '#94A3B8', snack: '#10B981' };

  const THEMES = {
    white: { label: '화이트', color: '#FFFFFF' },
    khaki: { label: '카키', color: '#EEECE0' },
    navy: { label: '네이비', color: '#0A111E' },
  };
  const THEME_ORDER = ['white', 'khaki', 'navy'];

  /** 테마별 색은 CSS 변수에서 읽는다 */
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return String(v || '').trim() || fallback;
  }
  function mealColor(type) {
    return cssVar(`--meal-${type}`, MEAL_COLORS[type]);
  }

  const state = {
    date: U.todayISO(),
    tab: 'record',
    calMonth: null,          // {y, m}
    calSelected: null,
    statsRange: 'week',
    statsAnchor: U.todayISO(),
    chartMode: 'together',
    statsPick: null,         // 그래프에서 골라 정보를 보고 있는 날짜
    meal: null,              // 편집 중인 음식 {id,type,date}
    mealPick: null,          // 사전에서 고른 음식 {food, mult, autoName}
    photo: null,
    lastFavFlash: 0,
    memoFilter: 'all',       // all | day | food
    memoSearch: '',
    memoDirty: false,        // 메모 입력창에 저장하지 않은 변경이 있는지
    memoLoadedDate: null,    // 입력창에 얹어 둔 날짜
  };

  const $ = U.$;
  const $$ = U.$$;

  /* ============================================================== render */

  function render(change) {
    applyTheme(Store.theme());
    renderBadge();
    if (state.tab === 'record') renderRecord();
    if (state.tab === 'calendar') renderCalendar();
    if (state.tab === 'stats') renderStats();
    if (state.tab === 'memo') renderMemo();
    renderSettings();
  }

  /* --------------------------------------------------------------- theme */

  function applyTheme(name) {
    const theme = THEMES[name] ? name : 'white';
    const root = document.documentElement;
    if (theme === 'white') delete root.dataset.theme;
    else root.dataset.theme = theme;

    const meta = $('#metaThemeColor');
    if (meta) meta.setAttribute('content', THEMES[theme].color);

    const quick = $('#btnThemeQuick');
    if (quick) {
      quick.dataset.theme = theme;
      quick.title = `배경 테마: ${THEMES[theme].label} · 누르면 ${THEMES[THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % 3]].label}`;
      quick.setAttribute('aria-label', `배경 테마 바꾸기 — 지금 ${THEMES[theme].label}`);
    }
    const pill = $('#themePill');
    if (pill) pill.textContent = THEMES[theme].label;
    U.$$('#themeOptions .theme-option').forEach((b) => {
      const on = b.dataset.theme === theme;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function renderBadge() {
    const badge = $('#syncBadge');
    const text = $('#syncBadgeText');
    const map = {
      local: ['local', '로컬 저장'],
      connecting: ['connecting', '연결 중'],
      signedout: ['connecting', '로그인 필요'],
      online: ['online', '동기화됨'],
      error: ['error', '동기화 오류'],
    };
    const [s, label] = map[Sync.status] || map.local;
    badge.dataset.state = s;
    text.textContent = label;
    badge.title = Sync.status === 'online'
      ? `Firebase(${Sync.projectId})와 동기화 중`
      : Sync.status === 'error' ? (Sync.error || '동기화 오류') : '이 기기에 저장 중 (localStorage)';
  }

  /* ---------------------------------------------------------------- record */

  function renderRecord() {
    const date = state.date;
    const day = Store.viewDay(date);
    const totals = Store.totals(date);
    const goal = Store.goal();
    const today = U.todayISO();

    // 날짜 표시
    const label = $('#dateLabel');
    label.innerHTML = `${U.fmtLong(date)}${date === today ? '<span class="today-tag">오늘</span>' : date > today ? '<span class="today-tag future-tag">예정</span>' : ''}`;
    const photoCount = day.meals.filter((m) => m.photo).length;
    $('#dateSub').textContent = totals.meals
      ? `${totals.meals}개 기록 · 사진 ${photoCount}장`
      : '아직 기록이 없어요';
    $('#btnToday').disabled = date === today;
    $('#btnToday').style.opacity = date === today ? '.45' : '1';

    // 요약
    const ratio = goal ? totals.kcal / goal : 0;
    $('#sumIn').textContent = U.num(totals.kcal);
    $('#statIn').textContent = U.num(totals.kcal);
    $('#statGoal').textContent = U.num(goal);
    const left = goal - totals.kcal;
    $('#statLeftLabel').textContent = left < 0 ? '초과' : '남은';
    $('#statLeft').textContent = U.num(Math.abs(left));
    $('#statLeft').parentElement.classList.toggle('is-over', left < 0);

    const pct = Math.round(ratio * 100);
    $('#gaugePct').textContent = `${pct}%`;
    const gauge = $('#gauge');
    gauge.classList.toggle('is-over', ratio > 1);
    gauge.classList.toggle('is-empty', totals.kcal === 0);
    const C = 2 * Math.PI * 50;
    $('#gaugeFill').style.strokeDashoffset = String(C * (1 - Math.min(1, ratio)));
    gauge.setAttribute('aria-label', `목표 ${U.num(goal)}kcal 중 ${U.num(totals.kcal)}kcal 섭취 (${pct}%)`);

    const hint = $('#sumHint');
    hint.className = 'summary__hint';
    if (!totals.kcal && day.weight == null) hint.textContent = '아직 기록이 없어요. 첫 끼니를 남겨 보세요.';
    else if (ratio > 1) { hint.textContent = `목표보다 ${U.num(-left)} kcal 더 먹었어요`; hint.classList.add('is-over'); }
    else if (totals.kcal === 0) hint.textContent = '음식만 기록하면 칼로리가 계산돼요';
    else { hint.textContent = `목표까지 ${U.num(left)} kcal 남았어요`; hint.classList.add('is-ok'); }

    // 끼니 분포
    const bar = $('#distBar');
    const legend = $('#distLegend');
    if (!totals.kcal) {
      bar.innerHTML = '';
      bar.classList.add('is-empty');
      legend.innerHTML = '';
    } else {
      bar.classList.remove('is-empty');
      bar.innerHTML = MEALS.map((t) => {
        const v = totals.byType[t];
        if (!v) return '';
        return `<span class="dist__seg" style="width:${(v / totals.kcal * 100).toFixed(2)}%;background:${mealColor(t)}"></span>`;
      }).join('');
      legend.innerHTML = MEALS.map((t) => `
        <li><span class="swatch" style="background:${mealColor(t)}"></span>${LABEL[t]}
          <b style="color:var(--ink-3);font-weight:500">${U.num(totals.byType[t])}</b></li>`).join('');
    }

    renderDayNote(day);
    renderMeals(day, totals);
    renderWeight(day, date);
    renderFavorites();
    renderWeekCard(day, date);
  }

  /** 이번 주(일~토) 7일 막대 — 누르면 그 날짜로 이동 */
  function renderWeekCard(day, date) {
    const d = U.parseISO(date);
    const start = U.addDays(date, -d.getDay());
    const days = Store.datesBetween(start, U.addDays(start, 6));
    const goal = Store.goal();
    const today = U.todayISO();
    let sum = 0, count = 0;

    $('#weekBars').innerHTML = days.map((iso) => {
      const t = Store.totals(iso);
      const over = t.kcal > goal;
      const empty = !t.kcal;
      if (!empty) { sum += t.kcal; count++; }
      const h = empty ? 0 : U.clamp((t.kcal / goal) * 100, 6, 100);
      const cls = ['week-bar'];
      if (over) cls.push('is-over');
      if (empty) cls.push('is-empty');
      if (iso === today) cls.push('is-today');
      if (iso === date) cls.push('is-selected');
      return `<button type="button" class="${cls.join(' ')}" data-date="${iso}"
        aria-label="${U.fmtLong(iso)} ${empty ? '기록 없음' : U.num(t.kcal) + '킬로칼로리'}">
        <span class="week-bar__kcal${empty ? ' is-empty' : ''}">${empty ? '–' : U.num(t.kcal)}</span>
        <span class="week-bar__track"><span class="week-bar__fill" style="height:${h}%"></span></span>
        <span class="week-bar__label">${U.WEEKDAYS[U.parseISO(iso).getDay()]}</span>
      </button>`;
    }).join('');

    $('#weekMeta').textContent = count ? `평균 ${U.num(Math.round(sum / count))} kcal` : '기록 없음';
  }

  function renderMeals(day, totals) {
    const host = $('#mealList');
    host.innerHTML = MEALS.map((type) => {
      const items = day.meals.filter((m) => m.type === type);
      const kcal = totals.byType[type];
      const rows = items.map((m) => `
        <div class="meal-row" data-id="${m.id}" data-type="${type}">
          ${m.photo
            ? `<button class="meal-row__thumb" data-act="photo" data-id="${m.id}" aria-label="사진 크게 보기"><img src="${m.photo}" alt="${U.esc(m.name)} 사진" loading="lazy" /></button>`
            : `<span class="meal-row__thumb meal-row__thumb--empty" aria-hidden="true">${PLATE}</span>`}
          <span class="meal-row__text">
            <span class="meal-row__name">${U.esc(m.name)}</span>
            ${m.note ? `<span class="meal-row__note">${U.esc(m.note)}</span>` : ''}
          </span>
          <span class="meal-row__kcal">${U.num(m.kcal)}</span>
          <span class="meal-row__actions">
            <button class="row-btn" type="button" data-act="edit" data-id="${m.id}" aria-label="${U.esc(m.name)} 수정" title="수정">${PENCIL}<span>수정</span></button>
            <button class="row-btn row-btn--danger" type="button" data-act="delete" data-id="${m.id}" aria-label="${U.esc(m.name)} 삭제" title="삭제">${TRASH}<span>삭제</span></button>
          </span>
        </div>`).join('');

      return `
        <section class="meal meal--${type}" aria-label="${LABEL[type]}">
          <div class="meal__head">
            <span class="meal__icon" aria-hidden="true">${ICONS[type]}</span>
            <span class="meal__title"><strong>${LABEL[type]}</strong><span>${items.length ? items.length + '개' : '기록 없음'}</span></span>
            <span class="meal__kcal">${kcal ? `${U.num(kcal)}<small>kcal</small>` : '—'}</span>
          </div>
          <div class="meals__body">
            ${rows}
            <button class="add-dish" type="button" data-act="add" data-type="${type}">${PLUS}<span>음식 추가</span></button>
          </div>
        </section>`;
    }).join('');
  }

  function renderDayNote(day) {
    const host = $('#dayNoteStrip');
    if (!host) return;
    if (!day.dayNote) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    host.innerHTML = `
      <span class="day-note-strip__label">메모</span>
      <span class="day-note-strip__text">${U.esc(day.dayNote)}</span>
      <button class="day-note-strip__btn" type="button" id="btnGoMemo">수정</button>`;
    const go = $('#btnGoMemo');
    if (go) go.addEventListener('click', () => switchTab('memo'));
  }

  /** 삭제는 바로 반영하고, 토스트의 '되돌리기'로 되살릴 수 있게 한다 */
  function deleteMeal(date, id) {
    const day = Store.viewDay(date);
    const meal = day.meals.find((m) => m.id === id);
    if (!meal) return false;
    const snapshot = JSON.parse(JSON.stringify(meal));
    Store.removeMeal(date, id);
    U.toastAction(`'${snapshot.name}' 기록을 삭제했어요`, {
      action: '되돌리기',
      onAction: () => {
        Store.restoreMeal(date, snapshot);
        U.toast(`'${snapshot.name}' 기록을 되살렸어요`);
      },
    });
    return true;
  }

  /* ---------------------------------------------------------------- memo */

  function renderMemo() {
    const date = state.date;
    const day = Store.viewDay(date);
    const today = U.todayISO();

    const label = $('#memoDateLabel');
    label.innerHTML = `${U.fmtLong(date)}${date === today ? '<span class="today-tag">오늘</span>' : date > today ? '<span class="today-tag future-tag">예정</span>' : ''}`;
    const foodNotes = day.meals.filter((m) => m.note).length;
    const memoDay = Store.totals(date);
    $('#memoDateSub').textContent = memoDay.meals
      ? `${memoDay.meals}개 기록 · ${U.num(memoDay.kcal)} kcal${foodNotes ? ` · 음식 메모 ${foodNotes}개` : ''}`
      : (foodNotes ? `음식 메모 ${foodNotes}개` : '이 날은 아직 기록이 없어요');
    const todayBtn = $('#btnMemoToday');
    todayBtn.disabled = date === today;
    todayBtn.style.opacity = date === today ? '.45' : '1';

    // 입력 중인 글을 지키고, 날짜가 바뀌거나 저장했을 때만 새 값으로 채운다
    const input = $('#memoInput');
    if (state.memoLoadedDate !== date || !state.memoDirty) {
      input.value = day.dayNote || '';
      state.memoLoadedDate = date;
      state.memoDirty = false;
    }
    updateMemoMeta();
    renderMemoFeed();
  }

  function updateMemoMeta() {
    const input = $('#memoInput');
    const len = input.value.length;
    const counter = $('#memoCount');
    counter.textContent = `${U.num(len)} / 1,000`;
    counter.classList.toggle('is-over', len > 900);

    const meta = $('#memoSavedState');
    const day = Store.viewDay(state.date);
    if (state.memoDirty) {
      meta.textContent = '저장하지 않은 변경';
      meta.style.color = 'var(--amber-600)';
    } else {
      meta.textContent = day.dayNote ? `저장됨 · ${U.fmtStamp(day.dayNoteUpdatedAt || day.updatedAt)}` : '아직 메모가 없어요';
      meta.style.color = '';
    }
  }

  /** 일일 메모 + 음식 메모를 최신 날짜순으로 모은다 */
  function memoEntries() {
    const out = [];
    const days = Store.state.days;
    Object.keys(days).forEach((date) => {
      const d = days[date];
      if (d.dayNote) {
        out.push({ kind: 'day', date, text: d.dayNote, at: d.dayNoteUpdatedAt || d.updatedAt || 0 });
      }
      d.meals.forEach((m) => {
        if (m.note) out.push({ kind: 'food', date, text: m.note, at: m.updatedAt || m.createdAt || 0, meal: m });
      });
    });
    out.sort((a, b) => (a.date === b.date ? b.at - a.at : (a.date < b.date ? 1 : -1)));
    return out;
  }

  function memoMark(text, q) {
    const raw = String(text || '');
    if (!q) return U.esc(raw);
    const i = raw.toLowerCase().indexOf(q);
    if (i < 0) return U.esc(raw);
    return `${U.esc(raw.slice(0, i))}<mark class="memo-mark">${U.esc(raw.slice(i, i + q.length))}</mark>${U.esc(raw.slice(i + q.length))}`;
  }

  function memoItemHTML(e, q) {
    if (e.kind === 'day') {
      return `<button type="button" class="memo-item" data-memo-kind="day" data-date="${e.date}">
        <span class="memo-item__top">
          <span class="memo-badge memo-badge--day">일일 메모</span>
          <span class="memo-item__meta">${U.fmtStamp(e.at)}</span>
        </span>
        <span class="memo-item__text">${memoMark(e.text, q)}</span>
      </button>`;
    }
    return `<button type="button" class="memo-item" data-memo-kind="food" data-date="${e.date}" data-meal-id="${e.meal.id}">
      <span class="memo-item__top">
        <span class="memo-badge">${LABEL[e.meal.type]} 메모</span>
        <span class="memo-item__meta">${U.fmtStamp(e.at)}</span>
      </span>
      <span class="memo-item__food">${U.esc(e.meal.name)} · ${U.num(e.meal.kcal)} kcal</span>
      <span class="memo-item__text">${memoMark(e.text, q)}</span>
    </button>`;
  }

  function renderMemoFeed() {
    const host = $('#memoTimeline');
    const all = memoEntries();
    const q = state.memoSearch.trim().toLowerCase();
    let list = all;
    if (state.memoFilter !== 'all') list = list.filter((e) => e.kind === state.memoFilter);
    if (q) {
      list = list.filter((e) => ((e.text || '') + ' ' + (e.meal ? e.meal.name : '')).toLowerCase().indexOf(q) >= 0);
    }

    const count = $('#memoFeedCount');
    count.textContent = all.length ? `${U.num(list.length)} / ${U.num(all.length)}개` : '메모 없음';

    if (!list.length) {
      const searching = !!(q || state.memoFilter !== 'all');
      host.innerHTML = `<div class="memo-empty">
        <strong>${searching ? '조건에 맞는 메모가 없어요' : '아직 모아 볼 메모가 없어요'}</strong>
        <p>${searching ? '다른 낱말로 찾아보거나 전체로 바꿔 보세요.' : '일일 메모를 저장하거나 음식에 메모를 남기면<br>여기에 날짜순으로 쌓입니다.'}</p>
      </div>`;
      return;
    }

    const groups = [];
    list.forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    });

    const today = U.todayISO();
    host.innerHTML = groups.map((g) => `
      <section class="memo-day">
        <div class="memo-day__head">
          <span class="memo-day__date">${U.fmtLong(g.date)}</span>
          ${g.date === today ? '<span class="today-tag">오늘</span>' : ''}
          <span class="memo-day__count">${g.items.length}개</span>
        </div>
        ${g.items.map((e) => memoItemHTML(e, q)).join('')}
      </section>`).join('');
  }

  function saveMemo(opts) {
    const o = opts || {};
    const input = $('#memoInput');
    const date = state.date;
    state.memoDirty = false;
    const note = Store.setDayNote(date, input.value);
    input.value = note;
    updateMemoMeta();
    if (!o.silent) U.toast(note ? '메모를 저장했어요' : '메모를 지웠어요');
  }

  function renderWeight(day, date) {
    const input = $('#weightInput');
    if (document.activeElement !== input) {
      input.value = day.weight == null ? '' : String(day.weight);
    }
    const prev = Store.previousWeight(date);
    const deltaEl = $('#weightDelta');
    if (day.weight != null && prev) {
      const diff = Math.round((day.weight - prev.weight) * 10) / 10;
      const cls = diff < 0 ? 'delta--down' : diff > 0 ? 'delta--up' : 'delta--flat';
      const arrow = diff < 0 ? '↓' : diff > 0 ? '↑' : '·';
      deltaEl.innerHTML = `<span class="delta ${cls}">${arrow} ${Math.abs(diff).toFixed(1)} kg</span>`;
      deltaEl.title = `${U.fmtShort(prev.date)} ${prev.weight}kg 대비`;
    } else if (day.weight != null) {
      deltaEl.innerHTML = '<span class="delta delta--flat">첫 기록</span>';
    } else {
      deltaEl.textContent = '—';
    }

    const series = Store.weightSeries(14);
    Chart.sparkline($('#weightSpark'), series, { height: 44 });
    const note = $('#weightNote');
    if (day.weight != null) {
      note.textContent = series.length > 1
        ? `최근 ${series.length}회 기록 · ${U.fmtShort(series[0].date)} ${series[0].weight}kg → 오늘`
        : '기록이 쌓이면 흐름이 보여요.';
    } else {
      note.textContent = '기록하면 최근 흐름이 여기에 보여요.';
    }
  }

  function renderFavorites() {
    const host = $('#favList');
    const favs = Store.state.favorites;
    if (!favs.length) {
      host.innerHTML = `<li class="fav-empty">자주 먹는 음식을 저장해 두면<br>탭 한 번으로 오늘 끼니에 담을 수 있어요.</li>`;
      return;
    }
    host.innerHTML = favs.map((f) => `
      <li class="fav-row" data-id="${f.id}">
        <span class="fav-row__text">
          <span class="fav-row__name">${U.esc(f.name)}</span>
          <span class="fav-row__kcal">${U.num(f.kcal)} kcal</span>
        </span>
        <span class="fav-row__add">
          ${MEALS.map((t) => `<button class="quick-chip" type="button" data-act="fav-add" data-id="${f.id}" data-type="${t}" aria-label="${U.esc(f.name)} ${LABEL[t]}에 추가" title="${LABEL[t]}에 추가">${LABEL[t].slice(0, 1)}</button>`).join('')}
          <button class="mini-btn" type="button" data-act="fav-del" data-id="${f.id}" aria-label="${U.esc(f.name)} 즐겨찾기에서 삭제" title="삭제">${CLOSE}</button>
        </span>
      </li>`).join('');
  }

  /* -------------------------------------------------------------- calendar */

  function renderCalendar() {
    const { y, m } = state.calMonth;
    const first = new Date(y, m, 1);
    const startOffset = first.getDay();
    const gridStart = new Date(y, m, 1 - startOffset);
    const today = U.todayISO();
    const goal = Store.goal();

    $('#calTitleText').textContent = `${y}년 ${m + 1}월`;
    $('#calTitle').setAttribute('aria-label', `${y}년 ${m + 1}월 — 연도·월 빠른 선택`);

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const iso = U.iso(d);
      const inMonth = d.getMonth() === m;
      const t = Store.totals(iso);
      const dow = d.getDay();
      const classes = ['cal-cell'];
      if (!inMonth) classes.push('is-out');
      if (dow === 0) classes.push('is-sun');
      if (dow === 6) classes.push('is-sat');
      if (iso === today) classes.push('is-today');
      if (iso === state.calSelected) classes.push('is-selected');
      const pct = t.kcal ? Math.min(100, (t.kcal / goal) * 100) : 0;
      cells += `
        <button type="button" class="${classes.join(' ')}" data-date="${iso}" role="gridcell"
          aria-label="${U.fmtFull(iso)}, ${t.kcal ? U.num(t.kcal) + '킬로칼로리' : '기록 없음'}">
          <span class="cal-cell__num">${d.getDate()}</span>
          ${t.kcal ? `<span class="cal-cell__kcal">${U.num(t.kcal)}<small>kcal</small></span>
            <span class="cal-cell__bar"><i class="${t.kcal <= goal ? 'ok' : 'over'}" style="width:${pct.toFixed(1)}%"></i></span>`
            : ''}
        </button>`;
    }
    $('#calGrid').innerHTML = cells;

    // 월 요약
    const days = Store.datesBetween(U.iso(new Date(y, m, 1)), U.iso(new Date(y, m + 1, 0)));
    let recorded = 0, ok = 0, sum = 0;
    days.forEach((iso) => {
      const t = Store.totals(iso);
      if (!t.kcal) return;
      recorded++;
      sum += t.kcal;
      if (t.kcal <= goal) ok++;
    });
    $('#calSummary').innerHTML = `
      <div class="cal-summary__cell">
        <span class="cal-summary__label">기록한 날</span>
        <span class="cal-summary__value">${recorded}<small>일</small></span>
      </div>
      <div class="cal-summary__cell">
        <span class="cal-summary__label">평균 섭취</span>
        <span class="cal-summary__value">${recorded ? U.num(Math.round(sum / recorded)) : '—'}<small>kcal</small></span>
      </div>
      <div class="cal-summary__cell">
        <span class="cal-summary__label">목표 이내</span>
        <span class="cal-summary__value">${recorded ? Math.round((ok / recorded) * 100) : '—'}<small>%</small></span>
      </div>`;

    renderDayPreview();
  }

  function renderDayPreview() {
    const host = $('#dayPreview');
    const date = state.calSelected;
    if (!date) {
      host.innerHTML = `<div class="empty-state"><strong>날짜를 눌러 보세요</strong><p>그날의 식사·사진·몸무게가 여기에서 바로 보여요.</p></div>`;
      return;
    }
    const day = Store.viewDay(date);
    const t = Store.totals(date);
    const goal = Store.goal();
    const photos = day.meals.filter((m) => m.photo);

    const rows = day.meals.length
      ? day.meals.map((m) => `<div class="day-preview__row">
            <span class="day-preview__meal" style="min-width:34px;color:var(--muted);font-weight:500;font-size:13px">${LABEL[m.type]}</span>
            <b>${U.esc(m.name)}</b>${m.note ? `<span class="day-preview__memo">· ${U.esc(m.note)}</span>` : ''}
            <em>${U.num(m.kcal)} kcal</em>
          </div>`).join('')
      : `<div class="empty-state"><strong>이 날은 기록이 없어요</strong><p>지금 바로 채워 넣을 수 있어요.</p></div>`;

    host.innerHTML = `
      <div class="day-preview__head">
        <span class="day-preview__date">${U.fmtLong(date)}</span>
        ${t.kcal ? `<span class="tag ${t.kcal <= goal ? 'tag--ok' : 'tag--over'}">${t.kcal <= goal ? '목표 이내' : '목표 초과'}</span>` : '<span class="tag tag--none">기록 없음</span>'}
        <span class="spacer"></span>
        <span class="card__meta">${t.kcal ? U.num(t.kcal) + ' kcal' : ''}${day.weight != null ? ` · ${day.weight} kg` : ''}</span>
        <button class="btn btn--soft btn--sm" id="btnEditDay" type="button">이 날짜 편집</button>
      </div>
      <div class="day-preview__list">${rows}</div>
      ${day.dayNote ? `<p class="day-preview__note">${U.esc(day.dayNote)}</p>` : ''}
      ${photos.length ? `<div class="day-preview__imgs">${photos.map((m) => `<img src="${m.photo}" alt="${U.esc(m.name)} 사진" data-photo="${m.photo}" />`).join('')}</div>` : ''}`;

    const editBtn = $('#btnEditDay');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        state.date = date;
        switchTab('record');
      });
    }
    U.$$('[data-photo]').forEach((img) => {
      img.addEventListener('click', () => openLightbox(img.dataset.photo));
    });
  }

  /* ----------------------------------------------------------------- stats */

  function statsPeriod() {
    const range = state.statsRange;
    const anchor = state.statsAnchor;
    const d = U.parseISO(anchor);

    if (range === 'week') {
      const s = new Date(d);
      s.setDate(d.getDate() - d.getDay());
      const start = U.iso(s);
      const end = U.addDays(start, 6);
      return { range, start, end };
    }
    if (range === 'month') {
      const start = U.iso(new Date(d.getFullYear(), d.getMonth(), 1));
      const end = U.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      return { range, start, end };
    }
    const start = U.iso(new Date(d.getFullYear(), 0, 1));
    const end = U.iso(new Date(d.getFullYear(), 11, 31));
    return { range, start, end };
  }

  function buildStats() {
    const { range, start, end } = statsPeriod();
    const goal = Store.goal();
    const days = Store.datesBetween(start, end);

    // 일 단위 집계
    const daily = days.map((iso) => {
      const t = Store.totals(iso);
      const day = Store.viewDay(iso);
      return { date: iso, kcal: t.kcal || null, weight: t.weight, meals: t.meals, note: day.dayNote || '' };
    });

    let points = [];
    const dividers = [];
    const nDays = days.length;

    if (range === 'week') {
      points = daily.map((d, i) => ({
        date: d.date,
        label: U.fmtShort(d.date),
        full: U.fmtLong(d.date),
        short: `${U.fmtShort(d.date)} (${U.WEEKDAYS[U.parseISO(d.date).getDay()]})`,
        tick: true,
        ratio: (i + 0.5) / Math.max(1, nDays),
        kcal: d.kcal,
        weight: d.weight,
        count: d.meals,
        note: d.note,
      }));
    } else if (range === 'month') {
      // 1일부터 말일까지 — 하루하루의 기록을 그대로 이어 본다 (빈 날은 선을 끊는다)
      const mo = Number(start.slice(5, 7));
      points = daily.map((d, i) => {
        const day = i + 1;
        return {
          date: d.date,
          label: String(day),
          tickText: String(day),
          tick: day === 1 || day % 5 === 0 || day === nDays,
          full: U.fmtFull(d.date),
          short: `${mo}/${day}`,
          ratio: nDays > 1 ? (day - 1) / (nDays - 1) : 0.5,
          kcal: d.kcal,
          weight: d.weight,
          count: d.meals,
          note: d.note,
        };
      });
    } else {
      // 1월 1일 ~ 12월 31일 하루 단위 + 월 구분선
      points = daily.map((d, i) => {
        const dt = U.parseISO(d.date);
        const dom = dt.getDate();
        const monthStart = dom === 1;
        return {
          date: d.date,
          label: String(dom),
          tickText: monthStart ? `${dt.getMonth() + 1}월` : '',
          tick: monthStart,
          full: U.fmtFull(d.date),
          short: `${dt.getMonth() + 1}/${dom}`,
          ratio: nDays > 1 ? i / (nDays - 1) : 0.5,
          kcal: d.kcal,
          weight: d.weight,
          count: d.meals,
          note: d.note,
        };
      });
      for (let m = 1; m < 12; m++) {
        const idx = days.indexOf(U.iso(new Date(Number(start.slice(0, 4)), m, 1)));
        if (idx > 0) dividers.push({ ratio: idx / (nDays - 1) });
      }
    }

    // 요약 수치 (일 단위 기준)
    const recordedDays = daily.filter((d) => d.kcal || d.weight != null);
    const kcalDays = daily.filter((d) => d.kcal);
    const avgKcal = kcalDays.length ? Math.round(kcalDays.reduce((a, b) => a + b.kcal, 0) / kcalDays.length) : null;
    const okDays = kcalDays.filter((d) => d.kcal <= goal).length;
    const weights = daily.filter((d) => d.weight != null);
    const weightChange = weights.length > 1 ? Math.round((weights[weights.length - 1].weight - weights[0].weight) * 10) / 10 : null;

    return { range, start, end, goal, daily, points, dividers, recordedDays, kcalDays, avgKcal, okDays, weights, weightChange };
  }

  /** 기간을 한 줄로 — '월간 · 2026년 11월' */
  function periodCaption(s) {
    const { range, start, end } = s;
    if (range === 'week') return `주간 · ${U.fmtShort(start)} – ${U.fmtShort(end)}`;
    if (range === 'month') return `월간 · ${start.slice(0, 4)}년 ${Number(start.slice(5, 7))}월`;
    return `연간 · ${start.slice(0, 4)}년`;
  }

  /** 그래프를 그린다 — 일반 카드 / 크게 보기(roomy) 두 곳에서 같은 데이터를 쓴다 */
  function renderStatsChart(s, roomy) {
    const host = roomy ? $('#chartAreaRoomy') : $('#chartArea');
    if (!host) return;
    const hasAny = s.points.some((p) => p.kcal != null || p.weight != null);
    if (!hasAny) {
      host.style.width = '';
      host.innerHTML = `<div class="chart-empty"><strong style="color:var(--ink-2)">이 기간에는 기록이 없어요</strong><span>음식과 몸무게를 기록하면 그래프가 그려집니다.</span></div>`;
      return;
    }
    let width = 0;
    if (roomy) {
      // 좁은 화면에서는 넓은 캔버스를 만들어 가로로 넘겨 보게 한다
      const wrap = host.parentElement;
      const avail = Math.max(320, (wrap ? wrap.clientWidth : 0) - 2);
      width = avail < 700 ? 720 : avail;
      host.style.width = width + 'px';
    } else {
      host.style.width = '';
    }
    Chart.render(host, {
      points: s.points,
      mode: state.chartMode,
      goal: s.goal,
      dividers: s.dividers,
      selected: state.statsPick,
      roomy,
      width: width || undefined,
      onPick: (i, p) => pickStatsDay(p.date),
    });
  }

  /** 그래프에서 고른 날 — 정보 패널 */
  function chartDetailHTML(p, s) {
    const goal = s.goal;
    const diff = p.kcal == null ? null : p.kcal - goal;
    const diffText = diff == null ? '—' : diff === 0 ? '목표와 같음' : `${diff > 0 ? '+' : '−'}${U.num(Math.abs(diff))} kcal`;
    const diffCls = diff == null ? '' : diff > 0 ? 'is-over' : 'is-under';
    const dow = U.WEEKDAYS[U.parseISO(p.date).getDay()];
    return `
      <div class="chart-detail__head">
        <strong class="chart-detail__date">${U.fmtFull(p.date)} (${dow})</strong>
        ${p.kcal == null ? '<span class="tag tag--none">기록 없음</span>'
          : p.kcal <= goal ? '<span class="tag tag--ok">목표 이내</span>' : '<span class="tag tag--over">목표 초과</span>'}
        <span class="spacer"></span>
        <button class="btn btn--primary btn--sm" type="button" data-goto-day="${p.date}">그날 기록 보기</button>
      </div>
      <div class="chart-detail__stats">
        <div class="chart-detail__cell"><span>섭취</span><b>${p.kcal == null ? '—' : `${U.num(p.kcal)}<small>kcal</small>`}</b></div>
        <div class="chart-detail__cell"><span>목표 대비</span><b class="${diffCls}">${diffText}</b></div>
        <div class="chart-detail__cell"><span>몸무게</span><b>${p.weight == null ? '—' : `${U.kg(p.weight)}<small>kg</small>`}</b></div>
        <div class="chart-detail__cell"><span>기록</span><b>${p.count ? `${p.count}<small>개</small>` : '—'}</b></div>
      </div>
      ${p.note
        ? `<p class="chart-detail__memo"><span>메모</span>${U.esc(p.note)}</p>`
        : '<p class="chart-detail__memo is-empty">이 날 남긴 메모가 없어요.</p>'}`;
  }

  function renderChartDetail(host, s, date) {
    if (!host) return;
    const p = date ? s.points.find((x) => x.date === date) : null;
    if (!p) {
      host.hidden = false;
      host.classList.add('is-hint');
      host.innerHTML = '<span class="chart-detail__hint">그래프의 점을 누르면 그날의 섭취 칼로리·목표 대비·몸무게·메모가 여기에 보여요.</span>';
      return;
    }
    host.hidden = false;
    host.classList.remove('is-hint');
    host.innerHTML = chartDetailHTML(p, s);
    host.querySelectorAll('[data-goto-day]').forEach((b) => {
      b.addEventListener('click', () => goToDay(b.dataset.gotoDay));
    });
  }

  function pickStatsDay(date) {
    if (!date) return;
    state.statsPick = state.statsPick === date ? null : date;
    renderStats();
  }

  /** 그래프 크게 보기 — 같은 데이터, 넓은 화면 */
  function renderChartModal(s) {
    const data = s || buildStats();
    const period = $('#chartModalPeriod');
    if (period) period.textContent = periodCaption(data);
    renderStatsChart(data, true);
    renderChartDetail($('#chartDetailRoomy'), data, state.statsPick);
  }

  function openChartModal() {
    openModal('chartModal');
    renderChartModal();
  }

  function syncChartModeSegs() {
    U.$$('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === state.chartMode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function renderStats() {
    const s = buildStats();
    const { range, start, end } = s;

    // 기간 라벨
    const label = range === 'week'
      ? `${U.fmtShort(start)} – ${U.fmtShort(end)}`
      : range === 'month'
        ? `${start.slice(0, 4)}년 ${Number(start.slice(5, 7))}월`
        : `${start.slice(0, 4)}년`;
    $('#statsRangeText').textContent = label;
    $('#statsRangeLabel').setAttribute('aria-label', `${label} — 연도·월 빠른 선택`);
    $('#chartSub').textContent = range === 'week'
      ? `일별 기록 · ${U.fmtFull(start)} – ${U.fmtFull(end)}`
      : range === 'month'
        ? `일별 기록 · 1일부터 말일까지 · 점을 눌러 그날 상태를 확인하세요`
        : `일별 추이 · 월 구분선과 함께 기록이 있는 날을 이어 봅니다`;

    // 요약 카드
    const change = s.weightChange;
    const changeCls = change == null ? '' : change < 0 ? 'stat-card--mint' : change > 0 ? 'stat-card--amber' : '';
    $('#statCards').innerHTML = `
      <article class="stat-card">
        <span class="stat-card__label">평균 섭취</span>
        <strong class="stat-card__value">${s.avgKcal == null ? '—' : U.num(s.avgKcal)}<small>kcal</small></strong>
        <span class="stat-card__sub">${s.kcalDays.length}일 기록 · 목표 ${U.num(s.goal)}</span>
      </article>
      <article class="stat-card ${changeCls}">
        <span class="stat-card__label">체중 변화</span>
        <strong class="stat-card__value">${change == null ? '—' : (change > 0 ? '+' : change < 0 ? '−' : '') + Math.abs(change).toFixed(1)}<small>kg</small></strong>
        <span class="stat-card__sub">${s.weights.length > 1
          ? `${U.fmtShort(s.weights[0].date)} ${s.weights[0].weight}kg → ${U.fmtShort(s.weights[s.weights.length - 1].date)} ${s.weights[s.weights.length - 1].weight}kg`
          : '몸무게 기록이 2회 이상 필요해요'}</span>
      </article>
      <article class="stat-card stat-card--mint">
        <span class="stat-card__label">목표 이내</span>
        <strong class="stat-card__value">${s.kcalDays.length ? `${s.okDays}<small>/${s.kcalDays.length}일</small>` : '—'}</strong>
        <span class="stat-card__sub">${s.kcalDays.length ? `달성률 ${Math.round((s.okDays / s.kcalDays.length) * 100)}%` : '기록이 없어요'}</span>
      </article>`;

    // 그래프 + 고른 날 정보
    renderStatsChart(s, false);
    renderChartDetail($('#chartDetail'), s, state.statsPick);
    syncChartModeSegs();
    if (!$('#chartModal').hidden) renderChartModal(s);

    // 표 — 주간·월간은 날짜별, 연간은 기록이 있는 날만 (365줄은 너무 길어서)
    const tbody = $('#dataTable tbody');
    const rows = range === 'year'
      ? s.points.filter((p) => p.kcal != null || p.weight != null || (p.note || '').trim())
      : s.points;
    $('#tableMeta').textContent = range === 'week' ? '일별'
      : range === 'month' ? '일별'
        : rows.length ? `기록한 날 ${rows.length}일` : '기록 없음';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="is-muted" style="text-align:center;padding:22px 0">이 기간에는 기록이 없어요</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((p) => {
      const okTag = p.kcal == null ? '<span class="tag tag--none">기록 없음</span>'
        : p.kcal <= s.goal ? '<span class="tag tag--ok">이내</span>' : '<span class="tag tag--over">초과</span>';
      return `<tr>
        <td><span class="date-long">${U.esc(p.full || p.label)}</span><span class="date-short">${U.esc(p.short || p.label)}</span></td>
        <td class="${p.kcal == null ? 'is-muted' : ''}">${p.kcal == null ? '—' : U.num(p.kcal)}</td>
        <td class="is-muted">${U.num(s.goal)}</td>
        <td class="${p.weight == null ? 'is-muted' : ''}">${p.weight == null ? '—' : p.weight + ' kg'}</td>
        <td>${okTag}</td>
      </tr>`;
    }).join('');
  }

  /* --------------------------------------------------------------- modals */

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    const focusable = el.querySelector('input:not([type="hidden"]), textarea, button');
    setTimeout(() => {
      const first = el.querySelector('input[type="text"], input[type="number"], textarea');
      if (first) first.focus();
    }, 60);
  }

  function closeModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.hidden = true;
    if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = '';
  }

  function closeAllModals() {
    U.$$('.modal:not([hidden])').forEach((m) => closeModal(m));
    document.body.style.overflow = '';
  }

  /* ------------------------------------------- 음식 사전 · 인분 조절 */

  const FOOD_DB = (typeof window.FoodDB !== 'undefined') ? window.FoodDB : null;
  const suggestControllers = [];

  /** '1공기 210g' · '10개 150g' · '1/2개 100g' → { base, unit } */
  function servingUnit(food) {
    const m = /^(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*([가-힣]+)/.exec(String((food && food.serving) || ''));
    if (!m) return null;
    let base = Number(m[1]);
    if (m[2]) base = base / Number(m[2]);
    return { base, unit: m[3] };
  }

  function numText(n) {
    return String(Math.round(n * 100) / 100);
  }

  /** 기록에 남길 이름 — 예: 1.5배 → '현미밥 1.5공기', '방울토마토 15개' */
  function foodName(food, mult) {
    if (!food) return '';
    if (!mult || mult === 1) return food.name;
    const u = servingUnit(food);
    if (u) {
      const count = u.base * mult;
      if (Math.abs(count * 2 - Math.round(count * 2)) < 1e-9) {
        return `${food.name} ${numText(count)}${u.unit}`.slice(0, 60);
      }
    }
    return `${food.name} ${numText(mult)}인분`.slice(0, 60);
  }

  function renderPortion() {
    const box = $('#portionField');
    if (!box) return;
    const pick = state.mealPick;
    box.hidden = !pick;
    if (!pick) return;
    $('#portionBase').textContent = `${pick.food.serving} · ${U.num(pick.food.kcal)} kcal 기준`;
    U.$$('#portionRow .portion-chip').forEach((chip) => {
      const on = Number(chip.dataset.mult) === pick.mult;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function selectFood(food) {
    if (!food) return;
    state.mealPick = { food, mult: 1, autoName: true };
    $('#mealName').value = food.name;
    $('#mealKcal').value = String(food.kcal);
    renderPortion();
  }

  function applyPortion(mult) {
    const pick = state.mealPick;
    if (!pick || !Number.isFinite(mult)) return;
    pick.mult = mult;
    const kcalEl = $('#mealKcal');
    kcalEl.value = String(Math.round(pick.food.kcal * mult));
    if (pick.autoName) $('#mealName').value = foodName(pick.food, mult);
    kcalEl.classList.remove('is-bump');
    void kcalEl.offsetWidth;
    kcalEl.classList.add('is-bump');
    renderPortion();
  }

  function highlight(text, query) {
    const q = String(query || '').trim();
    if (!q) return U.esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return U.esc(text);
    return U.esc(text.slice(0, i)) + '<mark>' + U.esc(text.slice(i, i + q.length)) + '</mark>' + U.esc(text.slice(i + q.length));
  }

  function attachFoodSuggest(inputId, listId, onPick) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list || !FOOD_DB) return;
    let items = [];
    let active = -1;
    let skipNextFocus = false;

    function close() {
      items = [];
      active = -1;
      list.hidden = true;
      list.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function paint(q) {
      const wasHidden = list.hidden;
      list.innerHTML = items.map((f, i) => `
        <li class="suggest__item${i === active ? ' is-active' : ''}" id="${listId}-${i}" role="option"
            aria-selected="${i === active}" data-idx="${i}">
          <span class="suggest__text">
            <span class="suggest__name">${highlight(f.name, q)}</span>
            <span class="suggest__serving">${U.esc(f.serving)}</span>
          </span>
          <span class="suggest__kcal">${U.num(f.kcal)}<small>kcal</small></span>
        </li>`).join('');
      list.hidden = false;
      fit();
      if (wasHidden) {
        // 처음 열릴 때만 살짝 떠오르게 한다 ( 글자를 칠 때마다 깜박이지 않도록 )
        list.classList.remove('is-enter');
        void list.offsetWidth;
        list.classList.add('is-enter');
      }
      input.setAttribute('aria-expanded', 'true');
      if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
      else input.removeAttribute('aria-activedescendant');
    }

    /** 모달 패널·화면 안에 들어오도록 목록 높이를 맞추고, 아래가 좁으면 위로 띄운다 */
    function fit() {
      const r = input.getBoundingClientRect();
      const panel = input.closest('.modal__panel');
      const p = panel ? panel.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const limit = Math.min(p.bottom, window.innerHeight);
      const below = limit - r.bottom - 16;
      const above = r.top - Math.max(p.top, 0) - 16;
      const up = below < 132 && above > below;
      const h = Math.min(292, Math.max(96, up ? above : below));
      list.classList.toggle('suggest--up', up);
      list.style.maxHeight = `${Math.round(h)}px`;
    }

    window.addEventListener('resize', () => { if (!list.hidden) fit(); });

    function update() {
      const q = input.value.trim();
      if (!q) { close(); return; }
      items = FOOD_DB.search(q, 8);
      active = -1;
      if (!items.length) {
        list.innerHTML = '<li class="suggest__none" role="presentation">사전에 없는 음식이에요. 그대로 저장하면 됩니다.</li>';
        list.hidden = false;
        fit();
        input.setAttribute('aria-expanded', 'true');
        return;
      }
      paint(q);
    }

    function choose(f) {
      if (!f) return;
      onPick(f);
      close();
      input.blur();
    }

    input.addEventListener('input', update);
    input.addEventListener('focus', () => {
      // 수정 모달을 열며 값을 채운 경우엔 추천 목록을 자동으로 띄우지 않는다
      if (skipNextFocus) { skipNextFocus = false; return; }
      if (input.value.trim()) update();
    });
    input.addEventListener('blur', () => {
      setTimeout(() => { if (document.activeElement !== input) close(); }, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.hidden || !items.length) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        paint(input.value.trim());
        const el = list.querySelector('.suggest__item.is-active');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter') {
        if (!list.hidden && items.length) {
          e.preventDefault();
          choose(items[active >= 0 ? active : 0]);
        }
        return;
      }
      if (e.key === 'Escape' && !list.hidden) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });
    list.addEventListener('mousedown', (e) => e.preventDefault());
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.suggest__item');
      if (!li) return;
      choose(items[Number(li.dataset.idx)]);
    });

    suggestControllers.push({ close, armSkip() { skipNextFocus = true; } });
  }

  function closeAllSuggests() {
    suggestControllers.forEach((c) => c.close());
  }

  /* ----------------------------------------------------------- meal modal */

  function openMealModal(opts) {
    const o = opts || {};
    const date = o.date || state.date;
    state.meal = { id: o.id || null, type: o.type || defaultMealType(), date };
    state.photo = null;
    state.mealPick = null;
    closeAllSuggests();
    renderPortion();

    const modal = $('#mealModal');
    $('#mealModalTitle').textContent = o.id ? '음식 수정' : '음식 추가';
    $('#btnMealDelete').hidden = !o.id;

    if (o.id) {
      const day = Store.viewDay(date);
      const meal = day.meals.find((m) => m.id === o.id);
      if (!meal) return;
      $('#mealName').value = meal.name;
      $('#mealKcal').value = meal.kcal;
      $('#mealNote').value = meal.note || '';
      // 사전에 있는 음식이고 칼로리가 기준값과 같다면 인분 조절을 이어서 쓸 수 있게 한다
      const match = FOOD_DB && FOOD_DB.byName(meal.name);
      if (match && match.kcal === meal.kcal) {
        state.mealPick = { food: match, mult: 1, autoName: true };
      }
      state.photo = meal.photo || null;
      state.meal.type = meal.type;
    } else {
      $('#mealForm').reset();
      $('#mealName').value = o.name || '';
      $('#mealKcal').value = o.kcal != null ? o.kcal : '';
      $('#mealNote').value = '';
      $('#mealFavSave').checked = false;
    }

    U.$$('#mealTypeSeg .segmented__item').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.meal === state.meal.type);
    });
    renderPhotoPreview();
    renderPortion();
    closeAllSuggests();
    suggestControllers.forEach((c) => { if (c.armSkip) c.armSkip(); });
    openModal('mealModal');
  }

  function defaultMealType() {
    const h = new Date().getHours();
    if (h < 10) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
  }

  function renderPhotoPreview() {
    const prev = $('#photoPreview');
    const pick = $('#photoPick');
    if (state.photo) {
      prev.hidden = false;
      prev.querySelector('img').src = state.photo;
      pick.hidden = true;
    } else {
      prev.hidden = true;
      pick.hidden = false;
      $('#photoInput').value = '';
    }
  }

  /* ------------------------------------------------------------- handlers */

  function switchTab(tab) {
    state.tab = tab;
    U.$$('.tab').forEach((el) => el.classList.toggle('is-active', el.id === `tab-${tab}`));
    U.$$('.nav__item').forEach((el) => el.classList.toggle('is-active', el.dataset.tab === tab));
    if (tab === 'calendar') {
      if (!state.calMonth) {
        const d = U.parseISO(state.date);
        state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      }
      if (!state.calSelected) state.calSelected = state.date;
      renderCalendar();
    }
    if (tab === 'stats') renderStats();
    if (tab === 'record') renderRecord();
    if (tab === 'memo') renderMemo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function shiftDate(n) {
    if (state.tab === 'memo' && state.memoDirty) saveMemo({ silent: true });
    state.date = U.addDays(state.date, n);
    const d = U.parseISO(state.date);
    state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
    state.calSelected = state.date;
    if (state.tab === 'memo') { state.memoLoadedDate = null; renderMemo(); }
    else renderRecord();
  }

  function openLightbox(src) {
    $('#lightboxImg').src = src;
    $('#lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  /** 그래프·달력에서 고른 날을 오늘(기록) 탭으로 연다 */
  function goToDay(date) {
    if (!date) return;
    state.date = date;
    state.calSelected = date;
    const d = U.parseISO(date);
    state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
    state.memoLoadedDate = null;
    state.memoDirty = false;
    closeMonthPicker();
    closeAllModals();
    switchTab('record');
  }

  /* --------------------------------------------------- 연도·월 빠른 선택 */

  const picker = { y: null, m: null, anchor: null, onPick: null };

  /** 기록이 있는 해 + 최근 10년 + 내년 */
  function pickerYears(currentY) {
    const nowY = new Date().getFullYear();
    const set = new Set();
    for (let y = nowY - 10; y <= nowY + 1; y++) set.add(y);
    set.add(currentY);
    Object.keys(Store.state.days).forEach((d) => set.add(Number(d.slice(0, 4))));
    return Array.from(set).filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
  }

  function paintPicker() {
    const years = $('#pickerYears');
    const months = $('#pickerMonths');
    if (!years || !months || picker.y == null) return;
    years.innerHTML = pickerYears(picker.y).map((y) => `<button type="button" class="picker__year${y === picker.y ? ' is-active' : ''}"
      role="option" aria-selected="${y === picker.y}" data-year="${y}">${y}년</button>`).join('');
    months.innerHTML = Array.from({ length: 12 }, (_, i) => {
      const on = i === picker.m;
      return `<button type="button" class="picker__month${on ? ' is-active' : ''}" data-month="${i}"
        aria-pressed="${on}" aria-label="${picker.y}년 ${i + 1}월">${i + 1}월</button>`;
    }).join('');
    const caption = $('#pickerMonthCaption');
    if (caption) caption.textContent = `${picker.y}년`;
    scrollPickerYears();
  }

  /** 고른 연도가 연도 목록 가운데에 오도록 (보이게 된 뒤에 호출해야 한다) */
  function scrollPickerYears() {
    const years = $('#pickerYears');
    if (!years) return;
    const active = years.querySelector('.picker__year.is-active');
    if (!active) return;
    years.scrollTop = Math.max(0, active.offsetTop - years.clientHeight / 2 + active.offsetHeight / 2);
  }

  function positionPicker() {
    const box = $('#monthPicker');
    const anchor = picker.anchor;
    if (!box || !anchor || box.hidden) return;
    const r = anchor.getBoundingClientRect();
    const bw = Math.min(334, window.innerWidth - 20);
    box.style.width = bw + 'px';
    const bh = box.offsetHeight || 252;
    let left = r.left + r.width / 2 - bw / 2;
    left = U.clamp(left, 10, Math.max(10, window.innerWidth - bw - 10));
    let top = r.bottom + 8;
    if (top + bh > window.innerHeight - 12) top = Math.max(12, r.top - bh - 8);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
  }

  function pickerOutside(e) {
    const box = $('#monthPicker');
    if (!box || box.hidden) return;
    if (box.contains(e.target)) return;
    if (picker.anchor && picker.anchor.contains(e.target)) return;
    closeMonthPicker();
  }

  function pickerScroll(e) {
    const box = $('#monthPicker');
    if (!box || box.hidden) return;
    if (box.contains(e.target)) return;
    closeMonthPicker();
  }

  function closeMonthPicker() {
    const box = $('#monthPicker');
    if (!box || box.hidden) return;
    box.hidden = true;
    if (picker.anchor) picker.anchor.setAttribute('aria-expanded', 'false');
    picker.anchor = null;
    picker.onPick = null;
    document.removeEventListener('pointerdown', pickerOutside, true);
    window.removeEventListener('scroll', pickerScroll, true);
    window.removeEventListener('resize', closeMonthPicker);
  }

  function openMonthPicker(anchor, y, m, onPick) {
    const box = $('#monthPicker');
    if (!box || !anchor) return;
    if (!box.hidden && picker.anchor === anchor) { closeMonthPicker(); return; }
    closeMonthPicker();
    picker.y = y;
    picker.m = m;
    picker.anchor = anchor;
    picker.onPick = onPick;
    paintPicker();
    box.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    positionPicker();
    scrollPickerYears();
    document.addEventListener('pointerdown', pickerOutside, true);
    window.addEventListener('scroll', pickerScroll, true);
    window.addEventListener('resize', closeMonthPicker);
  }

  function bind() {
    // tabs
    U.$$('.nav__item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // date bar
    $('#btnPrevDay').addEventListener('click', () => shiftDate(-1));
    $('#btnNextDay').addEventListener('click', () => shiftDate(1));
    $('#btnToday').addEventListener('click', () => {
      state.date = U.todayISO();
      state.calSelected = state.date;
      const d = U.parseISO(state.date);
      state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      renderRecord();
    });

    // meal list (위임)
    $('#mealList').addEventListener('click', (e) => {
      const row = e.target.closest('.meal-row');
      const actBtn = e.target.closest('[data-act]');
      const act = actBtn ? actBtn.dataset.act : null;

      if (act === 'add') {
        openMealModal({ type: actBtn.dataset.type, date: state.date });
        return;
      }
      if (act === 'delete') {
        e.stopPropagation();
        deleteMeal(state.date, actBtn.dataset.id);
        return;
      }
      if (act === 'photo') {
        e.stopPropagation();
        const day = Store.viewDay(state.date);
        const meal = day.meals.find((m) => m.id === actBtn.dataset.id);
        if (meal && meal.photo) openLightbox(meal.photo);
        return;
      }
      if (act === 'edit') {
        e.stopPropagation();
        openMealModal({ id: actBtn.dataset.id, date: state.date });
        return;
      }
      if (row) {
        openMealModal({ id: row.dataset.id, date: state.date });
      }
    });

    // 끼니 선택
    U.$$('#mealTypeSeg .segmented__item').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!state.meal) return;
        state.meal.type = btn.dataset.meal;
        U.$$('#mealTypeSeg .segmented__item').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });

    // 음식 사전 자동완성 (음식 추가/수정)
    attachFoodSuggest('mealName', 'mealSuggest', (food) => selectFood(food));

    // 이름을 직접 고치면 인분 배수는 칼로리 계산에만 쓰고 이름은 건드리지 않는다.
    // 고른 음식과 전혀 다른 이름으로 바뀌면 인분 조절을 감춘다(기준이 헷갈리지 않게).
    $('#mealName').addEventListener('input', () => {
      const pick = state.mealPick;
      if (!pick) return;
      pick.autoName = false;
      const text = $('#mealName').value.trim();
      if (!text || text.indexOf(pick.food.name) !== 0) {
        state.mealPick = null;
        renderPortion();
      }
    });

    // 인분 칩
    $('#portionRow').addEventListener('click', (e) => {
      const chip = e.target.closest('.portion-chip');
      if (!chip) return;
      applyPortion(Number(chip.dataset.mult));
    });

    // 사진
    $('#photoInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const compressed = await U.compressImage(file);
        state.photo = compressed.dataUrl;
        renderPhotoPreview();
        U.toast(`사진을 ${compressed.width}×${compressed.height}로 줄였어요`);
      } catch (err) {
        U.toast(err.message || '사진을 불러오지 못했어요', 'warn');
      }
    });
    $('#btnPhotoRemove').addEventListener('click', () => {
      state.photo = null;
      renderPhotoPreview();
    });

    // 음식 저장
    $('#mealForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#mealName').value.trim();
      const kcal = U.toInt($('#mealKcal').value);
      if (!name) { U.toast('음식 이름을 적어 주세요', 'warn'); $('#mealName').focus(); return; }
      if (kcal == null || kcal < 0) { U.toast('칼로리를 숫자로 적어 주세요', 'warn'); $('#mealKcal').focus(); return; }
      const date = state.meal.date;

      Store.upsertMeal(date, {
        id: state.meal.id || undefined,
        type: state.meal.type,
        name,
        kcal,
        note: $('#mealNote').value.trim(),
        photo: state.photo,
      });

      if ($('#mealFavSave').checked) {
        Store.addFavorite({ name, kcal });
      }
      const isEdit = !!state.meal.id;
      closeModal('mealModal');
      if (date !== state.date) state.date = date;
      renderRecord();
      U.toast(isEdit ? '기록을 수정했어요' : `${Store.MEAL_LABEL[state.meal.type]}에 추가했어요`);
    });

    $('#btnMealDelete').addEventListener('click', () => {
      if (!state.meal || !state.meal.id) return;
      const date = state.meal.date;
      const id = state.meal.id;
      closeModal('mealModal');
      deleteMeal(date, id);
    });

    // 몸무게
    const weightInput = $('#weightInput');
    const saveWeight = () => {
      const raw = weightInput.value.trim();
      if (raw === '') {
        if (Store.viewDay(state.date).weight != null) {
          Store.setWeight(state.date, null);
          U.toast('몸무게 기록을 지웠어요');
        }
        return;
      }
      const v = U.toFloat(raw);
      if (v == null) return;
      const res = Store.setWeight(state.date, v);
      if (!res.ok) { U.toast(res.error, 'warn'); weightInput.value = Store.viewDay(state.date).weight || ''; return; }
      U.toast(`몸무게 ${res.weight}kg 저장`);
    };
    weightInput.addEventListener('change', saveWeight);
    weightInput.addEventListener('blur', saveWeight);
    weightInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); weightInput.blur(); }
    });
    const stepWeight = (dir) => {
      const cur = U.toFloat(weightInput.value) || Store.viewDay(state.date).weight || 0;
      weightInput.value = (Math.round((cur + dir * 0.1) * 10) / 10).toFixed(1);
      saveWeight();
    };
    $('#btnWeightDown').addEventListener('click', () => stepWeight(-1));
    $('#btnWeightUp').addEventListener('click', () => stepWeight(1));

    // 즐겨찾기
    $('#btnAddFavorite').addEventListener('click', () => {
      $('#favForm').reset();
      openModal('favModal');
    });
    $('#favForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#favName').value.trim();
      const kcal = U.toInt($('#favKcal').value);
      if (!name) { U.toast('음식 이름을 적어 주세요', 'warn'); return; }
      if (kcal == null) { U.toast('칼로리를 숫자로 적어 주세요', 'warn'); return; }
      Store.addFavorite({ name, kcal });
      closeModal('favModal');
      U.toast('즐겨찾기에 저장했어요');
    });
    $('#weekBars').addEventListener('click', (e) => {
      const b = e.target.closest('.week-bar');
      if (!b) return;
      state.date = b.dataset.date;
      renderRecord();
    });

    $('#favList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const fav = Store.state.favorites.find((f) => f.id === btn.dataset.id);
      if (!fav) return;
      if (btn.dataset.act === 'fav-add') {
        Store.addFavoriteToMeal(state.date, btn.dataset.type, fav.id);
        U.toast(`${Store.MEAL_LABEL[btn.dataset.type]}에 '${fav.name}'을 담았어요`);
      }
      if (btn.dataset.act === 'fav-del') {
        if (window.confirm(`'${fav.name}'을 즐겨찾기에서 뺄까요?`)) {
          Store.removeFavorite(fav.id);
          U.toast('즐겨찾기에서 뺐어요');
        }
      }
    });

    // 메모 탭
    $('#btnMemoPrevDay').addEventListener('click', () => shiftDate(-1));
    $('#btnMemoNextDay').addEventListener('click', () => shiftDate(1));
    $('#btnMemoToday').addEventListener('click', () => {
      if (state.memoDirty) saveMemo({ silent: true });
      state.date = U.todayISO();
      state.calSelected = state.date;
      const d = U.parseISO(state.date);
      state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      state.memoLoadedDate = null;
      renderMemo();
    });
    $('#memoInput').addEventListener('input', () => {
      state.memoDirty = true;
      updateMemoMeta();
    });
    $('#memoInput').addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveMemo();
      }
    });
    $('#btnMemoSave').addEventListener('click', () => saveMemo());
    $('#btnMemoClear').addEventListener('click', () => {
      const date = state.date;
      const day = Store.viewDay(date);
      const prev = day.dayNote || $('#memoInput').value;
      if (!String(prev).trim()) { U.toast('지울 메모가 없어요'); return; }
      state.memoDirty = false;
      Store.clearDayNote(date);
      $('#memoInput').value = '';
      updateMemoMeta();
      U.toastAction('메모를 지웠어요', {
        action: '되돌리기',
        onAction: () => {
          Store.setDayNote(date, prev);
          if (state.date === date) { state.memoLoadedDate = null; renderMemo(); }
          U.toast('메모를 되돌렸어요');
        },
      });
    });
    $('#memoFilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      state.memoFilter = b.dataset.filter;
      U.$$('#memoFilter .segmented__item').forEach((x) => x.classList.toggle('is-active', x === b));
      renderMemoFeed();
    });
    $('#memoSearch').addEventListener('input', (e) => {
      state.memoSearch = e.target.value || '';
      renderMemoFeed();
    });
    $('#memoTimeline').addEventListener('click', (e) => {
      const item = e.target.closest('.memo-item');
      if (!item) return;
      const date = item.dataset.date;
      if (item.dataset.memoKind === 'food') {
        state.date = date;
        switchTab('record');
        openMealModal({ id: item.dataset.mealId, date });
        return;
      }
      if (state.memoDirty && state.date !== date) saveMemo({ silent: true });
      state.date = date;
      state.calSelected = date;
      const d = U.parseISO(date);
      state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      state.memoLoadedDate = null;
      state.memoDirty = false;
      renderMemo();
      const input = $('#memoInput');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });

    // 테마
    $('#btnThemeQuick').addEventListener('click', () => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(Store.theme()) + 1) % THEME_ORDER.length];
      Store.setTheme(next);
      U.toast(`배경 테마: ${THEMES[next].label}`);
    });
    $('#themeOptions').addEventListener('click', (e) => {
      const b = e.target.closest('[data-theme]');
      if (!b || !THEMES[b.dataset.theme]) return;
      if (Store.theme() === b.dataset.theme) return;
      Store.setTheme(b.dataset.theme);
      U.toast(`배경 테마를 ${THEMES[b.dataset.theme].label}로 바꿨어요`);
    });

    // 목표
    $('#btnEditGoal').addEventListener('click', () => {
      $('#goalInput').value = Store.goal();
      openModal('goalModal');
    });
    $('#goalPresets').addEventListener('click', (e) => {
      const b = e.target.closest('[data-goal]');
      if (b) $('#goalInput').value = b.dataset.goal;
    });
    $('#goalForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = U.toInt($('#goalInput').value);
      if (v == null || v < 800 || v > 6000) { U.toast('800 ~ 6,000 사이로 정해 주세요', 'warn'); return; }
      Store.setGoal(v);
      closeModal('goalModal');
      U.toast(`목표를 ${U.num(v)} kcal로 바꿨어요`);
    });

    // 달력
    $('#calTitle').addEventListener('click', () => {
      if (!state.calMonth) return;
      openMonthPicker($('#calTitle'), state.calMonth.y, state.calMonth.m, (y, m) => {
        state.calMonth = { y, m };
        renderCalendar();
      });
    });
    $('#btnPrevMonth').addEventListener('click', () => {
      const { y, m } = state.calMonth;
      state.calMonth = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
      renderCalendar();
    });
    $('#btnNextMonth').addEventListener('click', () => {
      const { y, m } = state.calMonth;
      state.calMonth = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
      renderCalendar();
    });
    $('#btnThisMonth').addEventListener('click', () => {
      const d = U.parseISO(U.todayISO());
      state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      renderCalendar();
    });
    $('#calGrid').addEventListener('click', (e) => {
      const cell = e.target.closest('.cal-cell');
      if (!cell) return;
      const iso = cell.dataset.date;
      state.calSelected = iso;
      state.date = iso;
      const d = U.parseISO(iso);
      state.calMonth = { y: d.getFullYear(), m: d.getMonth() };
      renderCalendar();
    });

    // 통계
    $('#rangeSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-range]');
      if (!b) return;
      state.statsRange = b.dataset.range;
      state.statsPick = null;
      U.$$('#rangeSeg .segmented__item').forEach((x) => x.classList.toggle('is-active', x === b));
      renderStats();
    });
    // 기간 제목 → 연도·월 빠른 선택 (주간·월간·연간 모두)
    $('#statsRangeLabel').addEventListener('click', () => {
      const d = U.parseISO(state.statsAnchor);
      openMonthPicker($('#statsRangeLabel'), d.getFullYear(), d.getMonth(), (y, m) => {
        state.statsAnchor = U.iso(new Date(y, m, 1));
        state.statsPick = null;
        renderStats();
      });
    });
    // 함께 보기 / 따로 보기 — 일반 카드와 크게 보기 모달의 토글을 함께 움직인다
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      state.chartMode = b.dataset.mode === 'split' ? 'split' : 'together';
      syncChartModeSegs();
      renderStats();
    });
    $('#btnChartExpand').addEventListener('click', openChartModal);
    // 연도·월 피커 안에서 고르기
    $('#pickerYears').addEventListener('click', (e) => {
      const b = e.target.closest('[data-year]');
      if (!b) return;
      picker.y = Number(b.dataset.year);
      paintPicker();
      positionPicker();
      scrollPickerYears();
    });
    $('#pickerMonths').addEventListener('click', (e) => {
      const b = e.target.closest('[data-month]');
      if (!b) return;
      const y = picker.y;
      const m = Number(b.dataset.month);
      const cb = picker.onPick;
      closeMonthPicker();
      if (cb) cb(y, m);
    });
    const shiftPeriod = (dir) => {
      const d = U.parseISO(state.statsAnchor);
      if (state.statsRange === 'week') d.setDate(d.getDate() + dir * 7);
      else if (state.statsRange === 'month') d.setMonth(d.getMonth() + dir);
      else d.setFullYear(d.getFullYear() + dir);
      state.statsAnchor = U.iso(d);
      state.statsPick = null;
      renderStats();
    };
    $('#btnStatsPrev').addEventListener('click', () => shiftPeriod(-1));
    $('#btnStatsNext').addEventListener('click', () => shiftPeriod(1));

    // 설정
    $('#btnSettings').addEventListener('click', () => {
      renderSettings(true);
      openModal('settingsModal');
    });

    // 모달 닫기
    U.$$('[data-close]').forEach((el) => {
      el.addEventListener('click', () => {
        const modal = el.closest('.modal');
        if (modal) closeModal(modal);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMonthPicker();
        closeAllModals();
        if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; document.body.style.overflow = ''; }
      }
    });
    $('#lightboxClose').addEventListener('click', () => {
      $('#lightbox').hidden = true;
      document.body.style.overflow = '';
    });
    $('#lightbox').addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') { $('#lightbox').hidden = true; document.body.style.overflow = ''; }
    });

    // Firebase
    $('#btnConnect').addEventListener('click', connectFirebase);
    $('#btnPasteConfig').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        $('#fbConfig').value = text;
        U.toast('클립보드에서 붙여넣었어요');
      } catch (e) {
        U.toast('브라우저가 붙여넣기를 막았어요. 직접 붙여넣어 주세요.', 'warn');
      }
    });
    $('#btnSignIn') && $('#btnSignIn').addEventListener('click', signInClick);
    $('#btnSignOut').addEventListener('click', async () => {
      await Sync.signOut();
      U.toast('로그아웃했어요');
      renderSettings(true);
    });
    $('#btnSyncNow').addEventListener('click', async () => {
      const res = await Sync.syncNow();
      U.toast(res.ok ? '동기화했어요' : (res.error || '동기화 실패'), res.ok ? undefined : 'warn');
      renderSettings(true);
    });
    $('#btnForgetConfig').addEventListener('click', async () => {
      if (!window.confirm('이 기기에서 Firebase 연결을 해제할까요?\n로컬 기록은 그대로 남습니다.')) return;
      await Sync.disconnect();
      U.toast('연결을 해제했어요');
      renderSettings(true);
    });

    // 백업
    $('#btnExport').addEventListener('click', () => {
      const json = Store.exportJSON();
      U.download(`meal-log-${U.todayISO()}.json`, json);
      U.toast('JSON 백업을 내려받았어요');
      renderSettings(true);
    });
    $('#importInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const res = Store.importJSON(text);
        if (!res.ok) { U.toast(res.error, 'warn'); return; }
        U.toast(`가져왔어요 · 새 기록 ${res.addedDays}일, 갱신 ${res.updatedDays}일`);
        render();
      } catch (err) {
        U.toast('파일을 읽지 못했어요', 'warn');
      } finally {
        e.target.value = '';
      }
    });
    $('#btnReset').addEventListener('click', () => {
      if (!window.confirm('이 기기의 로컬 기록을 모두 지울까요?\n(동기화된 기록은 Firestore에 남습니다. 먼저 백업을 권해요.)')) return;
      Store.resetLocal();
      closeAllModals();
      U.toast('로컬 기록을 지웠어요');
    });

    // 리사이즈 시 그래프 다시 그리기
    window.addEventListener('resize', U.debounce(() => {
      if (state.tab === 'stats') renderStats();
      if (state.tab === 'record') {
        Chart.sparkline($('#weightSpark'), Store.weightSeries(14), { height: 44 });
      }
    }, 180));

    // 앱이 백그라운드에서 돌아오면 날짜 갱신
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const t = U.todayISO();
        if (state.date === t) renderRecord();
        renderBadge();
      }
    });
  }

  async function connectFirebase() {
    const errBox = $('#fbError');
    errBox.hidden = true;
    const text = $('#fbConfig').value.trim();
    try {
      await Sync.connect(text);
      const cfg = Sync.getConfig();
      U.toast('Firebase에 연결했어요');
      renderSettings(true);
      if (!Sync.isSignedIn()) {
        U.toast('이제 Google로 로그인해 주세요', undefined);
      }
    } catch (e) {
      errBox.hidden = false;
      errBox.textContent = e && e.message ? e.message : '연결에 실패했어요.';
      errBox.className = 'helper helper--tight is-error';
      console.warn(e);
    }
  }

  async function signInClick() {
    try {
      await Sync.signIn();
      U.toast('로그인했어요');
    } catch (e) {
      const msg = e && e.code === 'auth/popup-closed-by-user'
        ? '로그인 창을 닫았어요.'
        : (e && e.message) || '로그인에 실패했어요.';
      U.toast(msg, 'warn');
      const errBox = $('#fbError');
      errBox.hidden = false;
      errBox.textContent = msg + (e && e.code ? ` (${e.code})` : '');
      errBox.className = 'helper helper--tight is-error';
    }
    renderSettings(true);
  }

  function renderSettings(force) {
    const modal = $('#settingsModal');
    if (!modal) return;

    const pill = $('#fbStatusPill');
    const pillMap = {
      local: ['', '연결 안 됨'],
      connecting: ['connecting', '연결 중'],
      signedout: ['connecting', '로그인 필요'],
      online: ['online', '동기화 중'],
      error: ['error', '오류'],
    };
    const [ps, pl] = pillMap[Sync.status] || pillMap.local;
    pill.dataset.state = ps;
    pill.textContent = pl;

    const cfg = Sync.getConfig();
    const connected = !!cfg && (Sync.status === 'online' || Sync.status === 'signedout' || Sync.status === 'connecting' || Sync.status === 'error');
    $('#fbConnected').hidden = !connected;
    $('#fbDisconnected').hidden = connected;

    if (connected) {
      const user = Sync.user;
      const avatar = $('#fbAvatar');
      if (user && user.photoURL) {
        avatar.innerHTML = `<img src="${U.esc(user.photoURL)}" alt="" referrerpolicy="no-referrer" />`;
      } else {
        avatar.textContent = user && user.displayName ? user.displayName.slice(0, 1) : '?';
      }
      $('#fbUser').textContent = user ? (user.displayName || user.email || '로그인됨') : '로그인이 필요해요';
      $('#fbProject').textContent = user ? (user.email || '') : `프로젝트: ${Sync.projectId}`;
      const signOutBtn = $('#btnSignOut');
      const signInBtn = $('#btnSignIn');
      if (!user) {
        if (!signInBtn) {
          const b = document.createElement('button');
          b.id = 'btnSignIn';
          b.type = 'button';
          b.className = 'btn btn--primary btn--sm';
          b.textContent = 'Google 로그인';
          b.addEventListener('click', signInClick);
          signOutBtn.parentElement.insertBefore(b, signOutBtn);
        }
        $('#btnSignIn').hidden = false;
        signOutBtn.hidden = true;
      } else {
        if (signInBtn) signInBtn.hidden = true;
        signOutBtn.hidden = false;
      }
      const st = $('#fbSyncState');
      const dayCount = Object.keys(Store.state.days).length;
      st.className = 'sync-state' + (Sync.status === 'error' ? ' is-error' : Sync.status === 'online' ? ' is-ok' : '');
      st.textContent = Sync.status === 'error'
        ? `오류: ${Sync.error || '알 수 없는 오류'}`
        : Sync.status === 'online'
          ? `실시간 동기화 중 · 이 기기 기록 ${dayCount}일`
          : Sync.status === 'connecting' ? '연결하는 중…' : 'Google 로그인 후 동기화가 시작됩니다.';
      $('#btnSyncNow').disabled = !user;
    } else {
      if (!$('#fbConfig').value && cfg) $('#fbConfig').value = JSON.stringify(cfg, null, 2);
    }

    const meta = Store.state.meta || {};
    const last = meta.lastBackupAt ? new Date(meta.lastBackupAt) : null;
    $('#backupInfo').textContent = last
      ? `마지막 백업: ${last.getFullYear()}. ${last.getMonth() + 1}. ${last.getDate()}. ${String(last.getHours()).padStart(2, '0')}:${String(last.getMinutes()).padStart(2, '0')}`
      : '아직 백업하지 않았어요.';
  }

  /* ---------------------------------------------------------------- start */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((e) => {
        console.warn('[meal-log] 서비스 워커 등록 실패', e);
      });
    });
  }

  function init() {
    Store.init();
    const t = U.todayISO();
    state.date = t;
    state.statsAnchor = t;
    state.calSelected = t;
    const d = U.parseISO(t);
    state.calMonth = { y: d.getFullYear(), m: d.getMonth() };

    bind();

    // 설정 화면의 사전 권수를 실제 데이터에 맞춘다
    if (FOOD_DB) {
      const meta = document.querySelector('.app-meta');
      if (meta) meta.textContent = `식사일지 v1.3.0 · 한국 음식 칼로리 사전 ${FOOD_DB.count}종 · 화이트/카키/네이비 테마 · 로컬 저장 + Firebase 선택 동기화`;
    }

    Store.subscribe((s, change) => {
      render(change);
    });

    Sync.onStatus = () => {
      renderBadge();
      if (!$('#settingsModal').hidden) renderSettings(true);
    };

    // 로컬 변경 → Firebase 업로드
    Store.onChange = (change) => {
      if (!Sync.isSignedIn()) return;
      if (change.source === 'remote') return;
      if (change.type === 'day') Sync.queueDay(change.date);
      if (change.type === 'favorites') Sync.pushFavorites();
      if (change.type === 'settings') Sync.pushSettings();
    };

    render();
    // PWA 바로가기(?tab=stats) 지원
    const wanted = new URLSearchParams(location.search).get('tab');
    if (wanted && ['record', 'calendar', 'stats', 'memo'].includes(wanted) && wanted !== 'record') {
      switchTab(wanted);
    }
    Sync.boot();
    registerSW();
    document.body.dataset.ready = '1';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
