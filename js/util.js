/* ==========================================================================
   util.js — 공용 도우미
   ========================================================================== */
(function (global) {
  'use strict';

  const pad2 = (n) => String(n).padStart(2, '0');

  const U = {
    $: (sel, root) => (root || document).querySelector(sel),
    $$: (sel, root) => Array.from((root || document).querySelectorAll(sel)),

    iso: (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    parseISO(s) {
      const [y, m, d] = String(s).split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    todayISO: () => U.iso(new Date()),
    addDays(iso, n) {
      const d = U.parseISO(iso);
      d.setDate(d.getDate() + n);
      return U.iso(d);
    },
    monthKey: (iso) => iso.slice(0, 7),

    WEEKDAYS: ['일', '월', '화', '수', '목', '금', '토'],
    WEEKDAYS_LONG: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],

    fmtLong(iso) {
      const d = U.parseISO(iso);
      return `${d.getMonth() + 1}월 ${d.getDate()}일 (${U.WEEKDAYS[d.getDay()]})`;
    },
    fmtFull(iso) {
      const d = U.parseISO(iso);
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    },
    fmtShort(iso) {
      const d = U.parseISO(iso);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },

    num: (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('ko-KR')),
    kcal: (n) => `${Number(n || 0).toLocaleString('ko-KR')}`,
    kg: (n, digits) => {
      if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
      const v = Number(n);
      const d = digits == null ? 1 : digits;
      return v.toFixed(d);
    },
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
      ));
    },

    uid() {
      const rnd = (global.crypto && global.crypto.getRandomValues)
        ? Array.from(global.crypto.getRandomValues(new Uint8Array(6)))
        : Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
      return Date.now().toString(36) + rnd.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 6);
    },

    debounce(fn, wait) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    /** 원화/칼로리 숫자만 뽑아내기 */
    toInt(v) {
      const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(n) ? n : null;
    },
    toFloat(v) {
      const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    },

    /**
     * 이미지 → 최대 480px JPEG dataURL (Canvas).
     * quality 를 단계적으로 낮춰 목표 용량(기본 60KB dataURL) 이하로 맞춘다.
     */
    compressImage(file, opts) {
      const o = Object.assign({ maxSize: 480, maxChars: 60000, minQuality: 0.4, startQuality: 0.72 }, opts || {});
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) {
          reject(new Error('이미지 파일이 아니에요.'));
          return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          try {
            const scale = Math.min(1, o.maxSize / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            let q = o.startQuality;
            let out = canvas.toDataURL('image/jpeg', q);
            while (out.length > o.maxChars && q > o.minQuality) {
              q = Math.max(o.minQuality, +(q - 0.08).toFixed(2));
              out = canvas.toDataURL('image/jpeg', q);
            }
            resolve({ dataUrl: out, width: w, height: h, quality: q, bytes: Math.round(out.length * 0.75) });
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('사진을 읽을 수 없어요.'));
        };
        img.src = url;
      });
    },

    toast(msg, kind) {
      const stack = document.getElementById('toastStack');
      if (!stack) return;
      const el = document.createElement('div');
      el.className = 'toast' + (kind === 'warn' ? ' toast--warn' : '');
      el.innerHTML = `<span class="toast__dot"></span><span>${U.esc(msg)}</span>`;
      stack.appendChild(el);
      setTimeout(() => {
        el.classList.add('is-out');
        setTimeout(() => el.remove(), 220);
      }, 2400);
    },

    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    },

    /** 소수 첫째 자리까지의 nice 축 눈금 */
    niceTicks(min, max, count) {
      if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
      if (min === max) { min -= 1; max += 1; }
      const raw = (max - min) / Math.max(1, count);
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / mag;
      const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
      const lo = Math.floor(min / step) * step;
      const hi = Math.ceil(max / step) * step;
      const ticks = [];
      for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(+v.toFixed(6));
      return ticks;
    },
  };

  global.U = U;
})(window);
