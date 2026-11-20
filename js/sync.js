/* ==========================================================================
   sync.js — 선택적 Firebase 동기화
   · 설정 모달에서 붙여넣은 웹 구성(JSON)으로 초기화
   · Google 로그인 → users/{uid}/days/{date}, users/{uid}/favorites/{id}
   · 설정이 없거나 실패하면 조용히 로컬 모드 유지
   ========================================================================== */
(function (global) {
  'use strict';

  const CFG_KEY = 'mealLog.firebase.config';
  const SDK_VERSION = '10.12.2';
  const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/`;

  function readConfig() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /** Firebase 콘솔의 JS 스니펫/JSON 어느 쪽이든 받아 객체로 */
  function parseConfig(text) {
    if (!text) throw new Error('설정 값이 비어 있어요.');
    let s = String(text).trim();
    s = s.replace(/^```(?:json|js|javascript)?/i, '').replace(/```$/, '').trim();
    s = s.replace(/^(?:const|let|var)\s+\w+\s*=\s*/i, '').replace(/;\s*$/, '').trim();
    if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);

    let obj = null;
    try {
      obj = JSON.parse(s);
    } catch (e) {
      // JS 객체 리터럴 → JSON
      const jsonish = s
        .replace(/\/\/[^\n]*/g, '')
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/,\s*([}\]])/g, '$1');
      try { obj = JSON.parse(jsonish); } catch (e2) {
        throw new Error('JSON 형식을 읽을 수 없어요. Firebase 콘솔의 firebaseConfig 값을 그대로 붙여넣어 주세요.');
      }
    }
    if (!obj || typeof obj !== 'object') throw new Error('설정 객체가 아니에요.');
    const missing = ['apiKey', 'projectId', 'appId'].filter((k) => !obj[k]);
    if (missing.length) throw new Error(`필수 항목이 없어요: ${missing.join(', ')}`);
    if (!obj.authDomain) obj.authDomain = `${obj.projectId}.firebaseapp.com`;
    return obj;
  }

  const Sync = {
    status: 'local',          // local | connecting | signedout | online | error
    error: '',
    user: null,
    projectId: '',
    onStatus: null,
    _sdk: null,
    _app: null,
    _auth: null,
    _db: null,
    _unsubDays: null,
    _unsubFavs: null,
    _unsubSettings: null,
    _pushedFavIds: new Set(),
    _pushTimers: new Map(),
    _initialised: false,

    isEnabled() { return this.status === 'online' || this.status === 'connecting' || this.status === 'signedout'; },
    isSignedIn() { return !!this.user; },

    _setStatus(status, error) {
      this.status = status;
      if (error !== undefined) this.error = error || '';
      if (typeof this.onStatus === 'function') {
        try { this.onStatus(this); } catch (e) { console.error(e); }
      }
    },

    getConfig() { return readConfig(); },

    /* ------------------------------------------------------- bootstrap */

    async boot() {
      const cfg = readConfig();
      if (!cfg) { this._setStatus('local'); return; }
      try {
        await this.connect(cfg, { silent: true });
      } catch (e) {
        console.warn('[meal-log] Firebase 연결 실패', e);
        this._setStatus('error', e.message || '연결에 실패했어요.');
      }
    },

    async _loadSdk() {
      if (this._sdk) return this._sdk;
      const [appMod, authMod, fsMod] = await Promise.all([
        import(SDK_BASE + 'firebase-app.js'),
        import(SDK_BASE + 'firebase-auth.js'),
        import(SDK_BASE + 'firebase-firestore.js'),
      ]);
      this._sdk = { appMod, authMod, fsMod };
      return this._sdk;
    },

    async connect(configOrText, opts) {
      const o = opts || {};
      const cfg = typeof configOrText === 'string' ? parseConfig(configOrText) : configOrText;
      if (!cfg || !cfg.apiKey) throw new Error('Firebase 설정이 올바르지 않아요.');

      this._setStatus('connecting', '');
      const { appMod, authMod, fsMod } = await this._loadSdk();

      if (this._app) {
        try { await appMod.deleteApp(this._app); } catch (e) { /* noop */ }
        this._app = null;
      }
      this._app = appMod.initializeApp(cfg, 'meal-log-' + (cfg.projectId || 'app'));
      this._auth = authMod.getAuth(this._app);
      this._db = fsMod.getFirestore(this._app);
      this._fsMod = fsMod;
      this._authMod = authMod;
      this.projectId = cfg.projectId || '';

      try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* noop */ }

      // 리디렉션 로그인 결과 확인 (모바일 팝업 차단 대비)
      try { await authMod.getRedirectResult(this._auth); } catch (e) { /* noop */ }

      authMod.onAuthStateChanged(this._auth, (user) => {
        this.user = user || null;
        if (user) {
          this._startListeners(user.uid).catch((err) => {
            console.error(err);
            this._setStatus('error', err.message || '데이터를 불러오지 못했어요.');
          });
        } else {
          this._stopListeners();
          this._setStatus('signedout');
        }
      });

      if (!o.silent) this._setStatus(this.user ? 'online' : 'signedout');
      return true;
    },

    async signIn() {
      if (!this._auth) throw new Error('먼저 Firebase 설정을 저장해 주세요.');
      const provider = new this._authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await this._authMod.signInWithPopup(this._auth, provider);
      } catch (e) {
        const code = e && e.code ? e.code : '';
        if (/popup-blocked|popup-closed-by-user|cancelled-popup-request|operation-not-supported|web-storage-unsupported/.test(code)) {
          if (code === 'popup-closed-by-user' || code === 'cancelled-popup-request') throw e;
          await this._authMod.signInWithRedirect(this._auth, provider);
        } else {
          throw e;
        }
      }
    },

    async signOut() {
      if (!this._auth) return;
      await this._authMod.signOut(this._auth);
      this._stopListeners();
      this._setStatus('signedout');
    },

    async disconnect() {
      this._stopListeners();
      if (this._app) {
        try { await this._sdk.appMod.deleteApp(this._app); } catch (e) { /* noop */ }
      }
      this._app = null; this._auth = null; this._db = null; this.user = null;
      try { localStorage.removeItem(CFG_KEY); } catch (e) { /* noop */ }
      this._setStatus('local');
    },

    /* -------------------------------------------------------- listeners */

    _stopListeners() {
      [this._unsubDays, this._unsubFavs, this._unsubSettings].forEach((fn) => {
        if (typeof fn === 'function') { try { fn(); } catch (e) { /* noop */ } }
      });
      this._unsubDays = this._unsubFavs = this._unsubSettings = null;
    },

    async _startListeners(uid) {
      const fs = this._fsMod;
      const db = this._db;
      this._stopListeners();

      const daysCol = fs.collection(db, 'users', uid, 'days');
      const favCol = fs.collection(db, 'users', uid, 'favorites');
      const settingsRef = fs.doc(db, 'users', uid, 'profile', 'settings');

      // 1. 최초 병합
      try {
        const [daysSnap, favSnap, settingsSnap] = await Promise.all([
          fs.getDocs(daysCol), fs.getDocs(favCol), fs.getDoc(settingsRef).catch(() => null),
        ]);
        const remoteDates = new Set();
        daysSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const date = data.date || docSnap.id;
          remoteDates.add(date);
          Store.applyRemoteDay(date, Object.assign({}, data, { date }));
        });
        const remoteFavs = [];
        favSnap.forEach((docSnap) => remoteFavs.push(Object.assign({ id: docSnap.id }, docSnap.data())));
        if (remoteFavs.length) Store.applyRemoteFavorites(remoteFavs);
        if (settingsSnap && settingsSnap.exists() && settingsSnap.data().goal) {
          const remoteGoalAt = Number(settingsSnap.data().updatedAt) || 0;
          if (remoteGoalAt && remoteGoalAt >= (Number(Store.state.meta.goalUpdatedAt) || 0)) {
            Store.state.settings.goal = U.clamp(U.toInt(settingsSnap.data().goal) || 2000, 800, 6000);
          }
        }
        if (settingsSnap && settingsSnap.exists() && settingsSnap.data().theme) {
          const remoteTheme = settingsSnap.data().theme;
          if (['white', 'khaki', 'navy'].indexOf(remoteTheme) >= 0 && remoteTheme !== Store.theme()) {
            Store.setTheme(remoteTheme, { source: 'remote' });
          }
        }

        // 로컬에만 있는 날짜 / 원격보다 최신인 날짜는 올린다
        Object.keys(Store.state.days).forEach((date) => {
          const local = Store.state.days[date];
          if (!remoteDates.has(date)) this.pushDay(date, true);
          else {
            const remote = daysSnap.docs.find((d) => (d.data().date || d.id) === date);
            if (remote && (local.updatedAt || 0) > (Number(remote.data().updatedAt) || 0)) this.pushDay(date, true);
          }
        });
        if (!remoteFavs.length && Store.state.favorites.length) this.pushFavorites(true);
        this.pushSettings(true);

        Store.persist();
        Store._emit({ type: 'sync', source: 'remote' });
      } catch (e) {
        console.warn('[meal-log] 초기 동기화 실패', e);
        this._setStatus('error', e.message || '동기화에 실패했어요. Firestore 규칙을 확인해 주세요.');
        return;
      }

      // 2. 실시간 구독
      this._unsubDays = fs.onSnapshot(daysCol, (snap) => {
        let changed = false;
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'removed') return;
          const data = ch.doc.data();
          const date = data.date || ch.doc.id;
          if (Store.applyRemoteDay(date, Object.assign({}, data, { date }))) changed = true;
        });
        if (changed) {
          Store.persist();
          Store._emit({ type: 'sync', source: 'remote' });
        }
      }, (err) => {
        this._setStatus('error', err.message || '실시간 동기화 오류');
      });

      this._unsubFavs = fs.onSnapshot(favCol, (snap) => {
        const list = [];
        snap.forEach((d) => list.push(Object.assign({ id: d.id }, d.data())));
        if (snap.docChanges().every((c) => c.type === 'removed') && !list.length) {
          if (Store.state.favorites.length) {
            Store.state.favorites = [];
            Store.persist();
            Store._emit({ type: 'sync', source: 'remote' });
          }
          return;
        }
        // 다른 기기에서 지운 즐겨찾기는 이 기기에서도 사라지게 한다
        const ids = new Set(list.map((f) => f.id));
        this._pushedFavIds.forEach((id) => {
          if (!ids.has(id)) {
            Store.state.favorites = Store.state.favorites.filter((f) => f.id !== id);
          }
        });
        if (list.length || snap.docChanges().some((c) => c.type === 'added' || c.type === 'modified')) {
          Store.applyRemoteFavorites(list);
          Store.persist();
          Store._emit({ type: 'sync', source: 'remote' });
        }
      }, (err) => {
        this._setStatus('error', err.message || '즐겨찾기 동기화 오류');
      });

      this._unsubSettings = fs.onSnapshot(settingsRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const goal = U.toInt(data.goal);
        if (goal && goal !== Store.state.settings.goal) {
          Store.state.settings.goal = U.clamp(goal, 800, 6000);
          Store.persist();
          Store._emit({ type: 'settings', source: 'remote' });
        }
        const theme = data.theme;
        if (['white', 'khaki', 'navy'].indexOf(theme) >= 0 && theme !== Store.theme()) {
          Store.setTheme(theme, { source: 'remote' });
        }
      }, () => { /* noop */ });

      this._pushedFavIds = new Set(Store.state.favorites.map((f) => f.id));
      this._setStatus('online', '');
    },

    /* ----------------------------------------------------------- pushes */

    queueDay(date) {
      if (!this.isSignedIn()) return;
      clearTimeout(this._pushTimers.get(date));
      this._pushTimers.set(date, setTimeout(() => {
        this._pushTimers.delete(date);
        this.pushDay(date);
      }, 400));
    },

    async pushDay(date, immediate) {
      if (!this.isSignedIn() || !this._db) return;
      const fs = this._fsMod;
      const uid = this.user.uid;
      const day = Store.state.days[date];
      const ref = fs.doc(this._db, 'users', uid, 'days', date);
      try {
        if (!day) { await fs.deleteDoc(ref); return; }
        await fs.setDoc(ref, {
          date,
          weight: day.weight == null ? null : day.weight,
          dayNote: day.dayNote || '',
          dayNoteUpdatedAt: day.dayNoteUpdatedAt || 0,
          meals: day.meals.map((m) => ({
            id: m.id, type: m.type, name: m.name, kcal: m.kcal,
            note: m.note || '', photo: m.photo || null,
            createdAt: m.createdAt || Date.now(), updatedAt: m.updatedAt || Date.now(),
          })),
          updatedAt: day.updatedAt || Date.now(),
        });
      } catch (e) {
        console.warn('[meal-log] 업로드 실패', date, e);
        this._setStatus('error', '업로드 실패: ' + (e.message || e.code || ''));
      }
    },

    async pushFavorites(immediate) {
      if (!this.isSignedIn() || !this._db) return;
      const fs = this._fsMod;
      const uid = this.user.uid;
      try {
        const currentIds = new Set(Store.state.favorites.map((f) => f.id));
        for (const fav of Store.state.favorites) {
          await fs.setDoc(fs.doc(this._db, 'users', uid, 'favorites', fav.id), {
            name: fav.name, kcal: fav.kcal,
            createdAt: fav.createdAt || Date.now(),
            updatedAt: fav.updatedAt || Date.now(),
          });
        }
        for (const oldId of this._pushedFavIds) {
          if (!currentIds.has(oldId)) {
            await fs.deleteDoc(fs.doc(this._db, 'users', uid, 'favorites', oldId));
          }
        }
        this._pushedFavIds = currentIds;
      } catch (e) {
        console.warn('[meal-log] 즐겨찾기 업로드 실패', e);
      }
    },

    async pushSettings(immediate) {
      if (!this.isSignedIn() || !this._db) return;
      const fs = this._fsMod;
      try {
        await fs.setDoc(fs.doc(this._db, 'users', this.user.uid, 'profile', 'settings'), {
          goal: Store.goal(),
          theme: Store.theme(),
          updatedAt: Date.now(),
        }, { merge: true });
      } catch (e) {
        console.warn('[meal-log] 설정 업로드 실패', e);
      }
    },

    async syncNow() {
      if (!this.isSignedIn()) return { ok: false, error: '로그인이 필요해요.' };
      try {
        const uid = this.user.uid;
        const fs = this._fsMod;
        const daysSnap = await fs.getDocs(fs.collection(this._db, 'users', uid, 'days'));
        const remoteDates = new Set();
        daysSnap.forEach((d) => {
          const data = d.data();
          const date = data.date || d.id;
          remoteDates.add(date);
          Store.applyRemoteDay(date, Object.assign({}, data, { date }));
        });
        for (const date of Object.keys(Store.state.days)) {
          if (!remoteDates.has(date)) await this.pushDay(date);
        }
        await this.pushFavorites();
        await this.pushSettings();
        Store.persist();
        Store._emit({ type: 'sync', source: 'remote' });
        this._setStatus('online', '');
        return { ok: true };
      } catch (e) {
        this._setStatus('error', e.message || '동기화 실패');
        return { ok: false, error: e.message || '동기화 실패' };
      }
    },
  };

  Sync.parseConfig = parseConfig;
  global.Sync = Sync;
})(window);
