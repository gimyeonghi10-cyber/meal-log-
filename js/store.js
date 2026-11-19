/* ==========================================================================
   store.js — 데이터 계층
   localStorage 가 원본, Firebase 는 선택적 동기화 미러.
   ========================================================================== */
(function (global) {
  'use strict';

  const LS_KEY = 'mealLog.v2';
  const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
  const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
  const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

  function todayISO() { return U.todayISO(); }

  function emptyState() {
    return {
      version: 2,
      days: {},
      favorites: [],
      settings: { goal: 2000 },
      meta: { createdAt: Date.now(), lastBackupAt: null },
    };
  }

  function normMeal(m, type) {
    return {
      id: m.id || U.uid(),
      type: MEAL_TYPES.includes(m.type) ? m.type : (type || 'breakfast'),
      name: String(m.name == null ? '' : m.name).slice(0, 60),
      kcal: Math.max(0, Math.round(Number(m.kcal) || 0)),
      note: String(m.note == null ? '' : m.note).slice(0, 80),
      photo: typeof m.photo === 'string' && m.photo.startsWith('data:image/') ? m.photo : null,
      createdAt: Number(m.createdAt) || Date.now(),
      updatedAt: Number(m.updatedAt) || Date.now(),
    };
  }

  function normDay(d, date) {
    const day = {
      date: d.date || date,
      meals: Array.isArray(d.meals) ? d.meals.map((m) => normMeal(m)).filter((m) => m.name) : [],
      weight: d.weight == null || d.weight === '' ? null : Number(d.weight),
      updatedAt: Number(d.updatedAt) || Date.now(),
    };
    if (!Number.isFinite(day.weight) || day.weight <= 0) day.weight = null;
    return day;
  }

  function normFav(f) {
    return {
      id: f.id || U.uid(),
      name: String(f.name == null ? '' : f.name).slice(0, 60),
      kcal: Math.max(0, Math.round(Number(f.kcal) || 0)),
      createdAt: Number(f.createdAt) || Date.now(),
      updatedAt: Number(f.updatedAt) || Date.now(),
    };
  }

  const Store = {
    MEAL_TYPES,
    MEAL_LABEL,
    MEAL_ORDER,

    state: emptyState(),
    _subs: new Set(),
    _persistTimer: null,

    /* ------------------------------------------------------------- init */

    init() {
      let raw = null;
      try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = null; }
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          this.state = this._normalizeState(parsed);
        } catch (e) {
          console.warn('[meal-log] 저장된 기록을 읽지 못했습니다.', e);
          this.state = emptyState();
        }
      }
      return this.state;
    },

    _normalizeState(src) {
      const s = emptyState();
      s.meta = Object.assign(s.meta, src.meta || {});
      s.settings.goal = U.clamp(U.toInt(src.settings && src.settings.goal) || 2000, 800, 6000);
      if (src.days && typeof src.days === 'object') {
        Object.keys(src.days).forEach((date) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          s.days[date] = normDay(src.days[date], date);
        });
      }
      if (Array.isArray(src.favorites)) {
        s.favorites = src.favorites.map(normFav).filter((f) => f.name);
      }
      return s;
    },

    /* ------------------------------------------------------------ events */

    subscribe(fn) {
      this._subs.add(fn);
      fn(this.state, { type: 'init' });
      return () => this._subs.delete(fn);
    },

    _emit(change) {
      const c = change || { type: 'update' };
      this._subs.forEach((fn) => {
        try { fn(this.state, c); } catch (e) { console.error(e); }
      });
      if (this.onChange) {
        try { this.onChange(c); } catch (e) { console.error(e); }
      }
    },

    /* --------------------------------------------------------- persist */

    persist() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.state));
        return true;
      } catch (e) {
        console.warn('[meal-log] 저장 실패', e);
        U.toast('저장 공간이 부족해요. 사진을 줄이거나 백업 후 오래된 기록을 정리해 주세요.', 'warn');
        return false;
      }
    },

    /* ------------------------------------------------------------ reads */

    getDay(date) {
      return this.state.days[date] || null;
    },

    /** 화면 렌더용: 항상 객체를 돌려준다 (기록을 새로 만들지 않음) */
    viewDay(date) {
      const d = this.state.days[date];
      if (!d) return { date, meals: [], weight: null, updatedAt: 0 };
      return d;
    },

    goal() {
      return this.state.settings.goal || 2000;
    },

    totals(date) {
      const day = this.state.days[date];
      const out = { kcal: 0, byType: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }, count: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }, meals: 0, weight: null, hasData: false };
      if (!day) return out;
      out.weight = day.weight;
      day.meals.forEach((m) => {
        const k = Number(m.kcal) || 0;
        out.kcal += k;
        if (out.byType[m.type] != null) out.byType[m.type] += k;
        if (out.count[m.type] != null) out.count[m.type] += 1;
        out.meals += 1;
      });
      out.hasData = out.meals > 0 || day.weight != null;
      return out;
    },

    /** 기간 내 날짜 키 배열 (오름차순) */
    datesBetween(startISO, endISO) {
      const out = [];
      let cur = startISO;
      let guard = 0;
      while (cur <= endISO && guard++ < 800) {
        out.push(cur);
        cur = U.addDays(cur, 1);
      }
      return out;
    },

    /** 몸무게가 기록된 날짜들 (오름차순) */
    weightSeries(limit) {
      const dates = Object.keys(this.state.days)
        .filter((d) => this.state.days[d].weight != null)
        .sort();
      const sliced = limit ? dates.slice(-limit) : dates;
      return sliced.map((date) => ({ date, weight: this.state.days[date].weight }));
    },

    /** 기준일 이전(포함) 가장 가까운 몸무게 기록 */
    previousWeight(date) {
      const dates = Object.keys(this.state.days)
        .filter((d) => d < date && this.state.days[d].weight != null)
        .sort();
      if (!dates.length) return null;
      const last = dates[dates.length - 1];
      return { date: last, weight: this.state.days[last].weight };
    },

    /* ---------------------------------------------------------- writes */

    _touchDay(date) {
      const day = this.state.days[date];
      if (day) day.updatedAt = Date.now();
      return day;
    },

    _ensureDay(date) {
      if (!this.state.days[date]) {
        this.state.days[date] = { date, meals: [], weight: null, updatedAt: Date.now() };
      }
      return this.state.days[date];
    },

    upsertMeal(date, meal) {
      const day = this._ensureDay(date);
      const now = Date.now();
      const clean = normMeal(meal, meal.type);
      const idx = day.meals.findIndex((m) => m.id === clean.id);
      if (idx >= 0) {
        clean.createdAt = day.meals[idx].createdAt;
        clean.updatedAt = now;
        day.meals[idx] = clean;
      } else {
        clean.createdAt = now;
        clean.updatedAt = now;
        day.meals.push(clean);
      }
      day.meals.sort((a, b) => (MEAL_ORDER[a.type] - MEAL_ORDER[b.type]) || (a.createdAt - b.createdAt));
      day.updatedAt = now;
      this.persist();
      this._emit({ type: 'day', date, source: 'local' });
      return clean;
    },

    removeMeal(date, id) {
      const day = this.state.days[date];
      if (!day) return false;
      const before = day.meals.length;
      day.meals = day.meals.filter((m) => m.id !== id);
      if (day.meals.length === before) return false;
      if (!day.meals.length && day.weight == null) {
        delete this.state.days[date];
      } else {
        day.updatedAt = Date.now();
      }
      this.persist();
      this._emit({ type: 'day', date, source: 'local' });
      return true;
    },

    moveMeal(date, id, type) {
      const day = this.state.days[date];
      if (!day || !MEAL_TYPES.includes(type)) return false;
      const meal = day.meals.find((m) => m.id === id);
      if (!meal) return false;
      meal.type = type;
      meal.updatedAt = Date.now();
      day.meals.sort((a, b) => (MEAL_ORDER[a.type] - MEAL_ORDER[b.type]) || (a.createdAt - b.createdAt));
      day.updatedAt = Date.now();
      this.persist();
      this._emit({ type: 'day', date, source: 'local' });
      return true;
    },

    setWeight(date, kg) {
      const value = kg == null || kg === '' ? null : Number(kg);
      if (value != null && (!Number.isFinite(value) || value <= 0 || value > 400)) {
        return { ok: false, error: '0보다 크고 400kg 이하로 입력해 주세요.' };
      }
      const day = this._ensureDay(date);
      day.weight = value == null ? null : Math.round(value * 10) / 10;
      if (!day.meals.length && day.weight == null) {
        delete this.state.days[date];
      } else {
        day.updatedAt = Date.now();
      }
      this.persist();
      this._emit({ type: 'day', date, source: 'local' });
      return { ok: true, weight: day.weight };
    },

    setGoal(goal) {
      const g = U.clamp(U.toInt(goal) || 2000, 800, 6000);
      this.state.settings.goal = g;
      this.persist();
      this._emit({ type: 'settings', source: 'local' });
      return g;
    },

    addFavorite(fav) {
      const clean = normFav(fav);
      if (!clean.name) return null;
      const dup = this.state.favorites.find(
        (f) => f.name.replace(/\s+/g, '') === clean.name.replace(/\s+/g, '') && Number(f.kcal) === clean.kcal
      );
      if (dup) return dup;
      clean.createdAt = Date.now();
      clean.updatedAt = Date.now();
      this.state.favorites.push(clean);
      this.persist();
      this._emit({ type: 'favorites', source: 'local' });
      return clean;
    },

    removeFavorite(id) {
      const before = this.state.favorites.length;
      this.state.favorites = this.state.favorites.filter((f) => f.id !== id);
      if (this.state.favorites.length === before) return false;
      this.persist();
      this._emit({ type: 'favorites', source: 'local' });
      return true;
    },

    addFavoriteToMeal(date, type, favId) {
      const fav = this.state.favorites.find((f) => f.id === favId);
      if (!fav) return null;
      return this.upsertMeal(date, { type, name: fav.name, kcal: fav.kcal, note: '' });
    },

    /* ------------------------------------------------------ sync bridge */

    /** 원격에서 받은 하루치를 반영 (updatedAt 이 더 최신일 때만) */
    applyRemoteDay(date, remote) {
      const local = this.state.days[date];
      if (local && (local.updatedAt || 0) >= (remote.updatedAt || 0)) return false;
      this.state.days[date] = normDay(remote, date);
      return true;
    },

    applyRemoteFavorites(list) {
      const remoteMap = new Map((list || []).map((f) => [f.id, normFav(f)]));
      const localMap = new Map(this.state.favorites.map((f) => [f.id, f]));
      const merged = [];
      remoteMap.forEach((r, id) => {
        const l = localMap.get(id);
        merged.push(l && l.updatedAt > r.updatedAt ? l : r);
        localMap.delete(id);
      });
      localMap.forEach((l) => merged.push(l));
      this.state.favorites = merged.sort((a, b) => a.createdAt - b.createdAt);
      return true;
    },

    setMeta(key, value) {
      this.state.meta[key] = value;
      this.persist();
    },

    /* ---------------------------------------------------------- backup */

    exportPayload() {
      return {
        app: 'meal-log',
        version: 2,
        exportedAt: new Date().toISOString(),
        settings: this.state.settings,
        days: this.state.days,
        favorites: this.state.favorites,
      };
    },

    exportJSON() {
      this.state.meta.lastBackupAt = Date.now();
      this.persist();
      return JSON.stringify(this.exportPayload(), null, 2);
    },

    /** 병합 가져오기: 같은 날짜는 updatedAt 이 최신인 쪽을 남긴다. */
    importJSON(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'JSON 파일을 읽을 수 없어요.' }; }
      if (!data || typeof data !== 'object' || (!data.days && !data.favorites)) {
        return { ok: false, error: '식사일지 백업 파일이 아니에요.' };
      }
      const incoming = this._normalizeState(data);
      let addedDays = 0, updatedDays = 0, addedFavs = 0;

      Object.keys(incoming.days).forEach((date) => {
        const cur = this.state.days[date];
        const next = incoming.days[date];
        if (!cur) { this.state.days[date] = next; addedDays++; }
        else if ((next.updatedAt || 0) > (cur.updatedAt || 0)) { this.state.days[date] = next; updatedDays++; }
      });

      incoming.favorites.forEach((f) => {
        const exists = this.state.favorites.some((x) => x.id === f.id);
        if (!exists) { this.state.favorites.push(f); addedFavs++; }
      });

      if (data.settings && U.toInt(data.settings.goal)) {
        this.state.settings.goal = U.clamp(U.toInt(data.settings.goal), 800, 6000);
      }

      this.persist();
      this._emit({ type: 'import', source: 'local' });
      return { ok: true, addedDays, updatedDays, addedFavs };
    },

    resetLocal() {
      this.state = emptyState();
      try { localStorage.removeItem(LS_KEY); } catch (e) { /* noop */ }
      this._emit({ type: 'reset', source: 'local' });
    },

    /** 테스트/디버그용 전체 교체 */
    replaceAll(next) {
      this.state = this._normalizeState(next || {});
      this.persist();
      this._emit({ type: 'replace', source: 'local' });
    },
  };

  global.Store = Store;
})(window);
