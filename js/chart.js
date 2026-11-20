/* ==========================================================================
   chart.js — 직접 그리는 SVG 선 그래프
   · 이중 Y축(칼로리/몸무게) 또는 따로 보기
   · 모든 꼭짓점에 실제 수치 라벨. 라벨끼리·다른 선의 점과 겹치면 자동으로 밀어낸다.
   ========================================================================== */
(function (global) {
  'use strict';

  const NAVY = '#1E293B';
  const MINT = '#10B981';
  const GRID = '#E7EDF3';
  const FAINT = '#94A3B8';

  /** 테마별 색은 CSS 변수에서 읽는다 (화이트/카키/네이비) */
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return String(v || '').trim() || fallback;
  }

  function themeColors() {
    return {
      kcal: cssVar('--chart-kcal', NAVY),
      weight: cssVar('--chart-weight', MINT),
      weightText: cssVar('--chart-weight-text', '#059669'),
      weightAxis: cssVar('--chart-weight-axis', '#34D399'),
      grid: cssVar('--chart-grid', GRID),
      axis: cssVar('--chart-axis', FAINT),
      surface: cssVar('--chart-surface', '#FFFFFF'),
      goal: cssVar('--chart-goal', '#CBD5E1'),
      goalText: cssVar('--chart-goal-text', '#A3B1C2'),
      label: cssVar('--chart-label', '#475569'),
    };
  }

  function textWidth(s, fs) {
    let w = 0;
    for (const ch of String(s)) w += /[0-9.,]/.test(ch) ? fs * 0.56 : fs * 0.62;
    return w;
  }

  function overlaps(a, b) {
    return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
  }

  /** 장애물(다른 시리즈 점·이미 놓인 라벨)을 피해 라벨 y를 고른다 */
  function placeLabel(boxes, cx, baseY, w, h, dir) {
    const offsets = dir === 'up' ? [-13, -24, -36, -48, -60] : [19, 31, 43, 55, 67];
    for (const dy of offsets) {
      const y = baseY + dy;
      const box = { x1: cx - w / 2 - 2, x2: cx + w / 2 + 2, y1: y - h / 2 - 1, y2: y + h / 2 + 1 };
      if (!boxes.some((b) => overlaps(b, box))) {
        boxes.push(box);
        return y;
      }
    }
    const dy = offsets[offsets.length - 1];
    boxes.push({ x1: cx - w / 2, x2: cx + w / 2, y1: baseY + dy - h / 2, y2: baseY + dy + h / 2 });
    return baseY + dy;
  }

  function pointBox(p, r) {
    return { x1: p.x - r, x2: p.x + r, y1: p.y - r, y2: p.y + r };
  }

  /** 몸무게 축: 0.5kg 눈금으로 깔끔하게 */
  function weightScale(values) {
    const nums = values.filter((v) => Number.isFinite(v));
    if (!nums.length) return { ticks: [60, 65, 70, 75, 80], min: 60, max: 80 };
    let min = Math.min(...nums);
    let max = Math.max(...nums);
    if (max - min < 1.2) {
      const mid = (min + max) / 2;
      min = mid - 0.6;
      max = mid + 0.6;
    }
    let lo = Math.floor((min - 0.15) * 2) / 2;
    let hi = Math.ceil((max + 0.15) * 2) / 2;
    const span = hi - lo;
    const step = span <= 2.5 ? 0.5 : span <= 6 ? 1 : 2;
    const ticks = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(2));
    if (ticks.length < 3) {
      lo -= step; hi += step;
      ticks.unshift(+lo.toFixed(2));
      ticks.push(+hi.toFixed(2));
    }
    return { ticks, min: ticks[0], max: ticks[ticks.length - 1] };
  }

  const Chart = {
    render(container, opts) {
      const points = opts.points || [];
      const mode = opts.mode === 'split' ? 'split' : 'together';
      const goal = Number(opts.goal) || 2000;
      container.innerHTML = '';
      if (!points.length) return;
      const th = themeColors();

      const width = Math.max(300, Math.round(container.clientWidth || 720));
      const isNarrow = width < 520;
      const gap = isNarrow ? 26 : 36;
      const togetherH = isNarrow ? 250 : 300;
      const splitH = isNarrow ? 168 : 186;

      const totalH = mode === 'together' ? togetherH : splitH * 2 + gap;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${width} ${totalH}`);
      svg.setAttribute('height', String(totalH));
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', '칼로리와 몸무게 변화 그래프');
      svg.style.height = totalH + 'px';

      const hasKcal = points.some((p) => Number.isFinite(p.kcal));
      const hasWeight = points.some((p) => Number.isFinite(p.weight));

      let markup = `<defs>
          <linearGradient id="kcalArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${th.kcal}" stop-opacity=".09"/>
            <stop offset="100%" stop-color="${th.kcal}" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${th.weight}" stop-opacity=".13"/>
            <stop offset="100%" stop-color="${MINT}" stop-opacity="0"/>
          </linearGradient>
        </defs>`;

      const panels = mode === 'together'
        ? [{ key: 'both', top: 0, height: togetherH, yKcal: true, yWeight: hasWeight }]
        : [
            { key: 'kcal', top: 0, height: splitH, yKcal: true, yWeight: false },
            { key: 'weight', top: splitH + gap, height: splitH, yKcal: false, yWeight: true },
          ];

      const maxKcal = Math.max(goal, ...points.map((p) => Number(p.kcal) || 0));
      const kcalTicks = U.niceTicks(0, maxKcal * 1.06, 5);
      const kcalScale = { ticks: kcalTicks, min: 0, max: kcalTicks[kcalTicks.length - 1] };
      const wScale = weightScale(points.map((p) => p.weight));

      const padL = isNarrow ? 33 : 44;
      const padR = mode === 'together' && hasWeight ? (isNarrow ? 40 : 46) : 16;
      const plotW = width - padL - padR;
      const n = points.length;
      const slot = plotW / Math.max(1, n);
      const xOf = (i) => padL + slot * (i + 0.5);

      panels.forEach((panel) => {
        markup += this._panelMarkup({
          panel, points, width, height: panel.height, goal, kcalScale, weightScale: wScale,
          hasKcal, hasWeight, isNarrow, padL, padR, plotW, slot, xOf, th,
        });
      });

      // x축 라벨 (마지막 패널 기준)
      const last = panels[panels.length - 1];
      const baseY = last.top + last.height - 24;
      markup += `<g>`;
      points.forEach((p, i) => {
        const show = n <= 8 || i % 2 === 0 || i === n - 1;
        if (!show) return;
        markup += `<text x="${xOf(i).toFixed(1)}" y="${baseY + 15}" text-anchor="middle"
          font-size="${isNarrow ? 9.5 : 10.5}" font-weight="600" fill="${th.axis}">${U.esc(p.label)}</text>`;
      });
      markup += `</g>`;

      // 호버 영역
      markup += `<g class="chart-hit">`;
      points.forEach((p, i) => {
        markup += `<rect x="${(xOf(i) - slot / 2).toFixed(1)}" y="${panels[0].top}" width="${slot.toFixed(1)}"
          height="${(last.top + last.height - panels[0].top).toFixed(1)}" fill="transparent"
          data-i="${i}" style="cursor:crosshair"/>`;
      });
      markup += `</g>`;

      svg.innerHTML = markup;
      container.appendChild(svg);

      const tip = document.createElement('div');
      tip.className = 'chart-tip';
      container.appendChild(tip);

      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      guide.setAttribute('stroke', th.goal);
      guide.setAttribute('stroke-width', '1');
      guide.setAttribute('stroke-dasharray', '3 4');
      guide.style.opacity = '0';
      svg.appendChild(guide);

      const showTip = (i) => {
        const p = points[i];
        if (!p) return;
        const x = xOf(i);
        guide.setAttribute('x1', x); guide.setAttribute('x2', x);
        guide.setAttribute('y1', panels[0].top + 10);
        guide.setAttribute('y2', last.top + last.height - 24);
        guide.style.opacity = '1';
        tip.innerHTML = `<b>${U.esc(p.full || p.label)}</b><br>
          <span class="chart-tip__kcal">칼로리 ${p.kcal == null ? '기록 없음' : U.num(p.kcal) + ' kcal'}</span><br>
          <span class="chart-tip__weight">몸무게 ${p.weight == null ? '기록 없음' : U.kg(p.weight)}</span>`;
        tip.style.left = U.clamp(x, 74, width - 74) + 'px';
        tip.style.top = (panels[0].top + 30) + 'px';
        tip.classList.add('is-on');
      };
      const hideTip = () => {
        tip.classList.remove('is-on');
        guide.style.opacity = '0';
      };
      svg.querySelectorAll('.chart-hit rect').forEach((r) => {
        r.addEventListener('pointerenter', () => showTip(Number(r.dataset.i)));
        r.addEventListener('pointerdown', () => showTip(Number(r.dataset.i)));
        r.addEventListener('pointerleave', hideTip);
      });
      svg.addEventListener('pointerleave', hideTip);
    },

    _panelMarkup(ctx) {
      const { panel, points, width, height, goal, kcalScale, weightScale: wScale,
        hasKcal, hasWeight, isNarrow, padL, padR, plotW, slot, xOf, th } = ctx;

      const top = panel.top + 25;
      const bottom = panel.top + height - 24;
      const plotH = bottom - top;
      const scaleFor = (v, scale) => top + plotH - ((v - scale.min) / (scale.max - scale.min || 1)) * plotH;

      const kcalPts = points.map((p, i) => (Number.isFinite(p.kcal) ? { x: xOf(i), y: scaleFor(p.kcal, kcalScale), v: p.kcal } : null));
      const weightPts = points.map((p, i) => (Number.isFinite(p.weight) ? { x: xOf(i), y: scaleFor(p.weight, wScale), v: p.weight } : null));

      let out = `<g class="chart-panel" data-panel="${panel.key}">`;

      // 가로 그리드
      const ticks = panel.yKcal ? kcalScale.ticks : wScale.ticks;
      ticks.forEach((t) => {
        const y = scaleFor(t, panel.yKcal ? kcalScale : wScale);
        out += `<line x1="${padL}" x2="${width - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"
          stroke="${th.grid}" stroke-width="1"/>`;
        out += `<text x="${padL - 7}" y="${(y + 3.4).toFixed(1)}" text-anchor="end" font-size="${isNarrow ? 9 : 10}"
          font-weight="600" fill="${th.axis}">${U.num(t)}</text>`;
      });

      if (panel.yKcal && panel.key === 'both') {
        out += `<text x="${padL - 7}" y="${panel.top + 12}" text-anchor="end" font-size="9.5" font-weight="700"
          fill="${th.axis}" letter-spacing=".04em">KCAL</text>`;
      }
      if (panel.key === 'kcal') {
        out += `<text x="${padL}" y="${panel.top + 12}" font-size="10.5" font-weight="700"
          fill="${th.label}" letter-spacing="-.01em">칼로리 <tspan fill="${th.axis}" font-weight="600">kcal</tspan></text>`;
      }
      if (panel.key === 'weight') {
        out += `<text x="${padL}" y="${panel.top + 12}" font-size="10.5" font-weight="700"
          fill="${th.weightText}" letter-spacing="-.01em">몸무게 <tspan fill="${th.weightAxis}" font-weight="600">kg</tspan></text>`;
      }

      // 목표선
      if (panel.yKcal && hasKcal) {
        const gy = scaleFor(goal, kcalScale);
        if (gy >= top - 1 && gy <= bottom + 1) {
          out += `<line x1="${padL}" x2="${width - padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}"
            stroke="${th.goal}" stroke-width="1.3" stroke-dasharray="5 5"/>`;
          out += `<text x="${padL + 4}" y="${(gy - 6).toFixed(1)}" text-anchor="start" font-size="9.5"
            font-weight="700" fill="${th.goalText}">목표 ${U.num(goal)}</text>`;
        }
      }

      const drawSeries = (pts, color, scale, gradId, dir, labelColor, obstacles, kind) => {
        const valid = pts.filter(Boolean);

        if (gradId && valid.length > 1) {
          let run = [];
          const flush = () => {
            if (run.length > 1) {
              const d = `M${run[0].x.toFixed(1)} ${bottom.toFixed(1)} ` +
                run.map((pt) => `L${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ') +
                ` L${run[run.length - 1].x.toFixed(1)} ${bottom.toFixed(1)} Z`;
              out += `<path d="${d}" fill="url(#${gradId})" stroke="none"/>`;
            }
            run = [];
          };
          pts.forEach((pt) => { if (pt) run.push(pt); else flush(); });
          flush();
        }

        let d = '', pen = false;
        pts.forEach((pt) => {
          if (!pt) { pen = false; return; }
          d += `${pen ? 'L' : 'M'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
          pen = true;
        });
        if (d) {
          out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.4"
            stroke-linejoin="round" stroke-linecap="round"/>`;
        }

        valid.forEach((pt) => {
          out += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.2" fill="${th.surface}"
            stroke="${color}" stroke-width="2.4"/>`;
        });

        // 수치 라벨 — 다른 시리즈의 점과 이미 놓인 라벨을 장애물로 삼는다
        const boxes = obstacles.map((p) => pointBox(p, 7));
        valid.forEach((pt) => {
          const label = labelText(pt.v, kind || 'kcal');
          const fs = isNarrow ? 9.5 : 10.5;
          const w = textWidth(label, fs);
          const h = fs + 2;
          const ly = placeLabel(boxes, pt.x, pt.y, w, h, dir);
          out += `<rect x="${(pt.x - w / 2 - 2.5).toFixed(1)}" y="${(ly - h / 2 - 0.5).toFixed(1)}"
            width="${(w + 5).toFixed(1)}" height="${(h + 1).toFixed(1)}" rx="4"
            fill="${th.surface}" fill-opacity=".96"/>`;
          out += `<text x="${pt.x.toFixed(1)}" y="${(ly + fs * 0.34).toFixed(1)}" text-anchor="middle"
            font-size="${fs}" font-weight="700" fill="${labelColor}"
            style="font-variant-numeric:tabular-nums">${U.esc(label)}</text>`;
        });
      };

      const labelText = (v, kind) => (kind === 'kcal' ? U.num(Math.round(v)) : U.kg(v));

      if (panel.yKcal && hasKcal) {
        drawSeries(kcalPts, th.kcal, kcalScale, 'kcalArea', 'up', th.kcal, weightPts.filter(Boolean), 'kcal');
      }
      if (hasWeight && (panel.yWeight || panel.key === 'weight')) {
        drawSeries(weightPts, th.weight, wScale, panel.key === 'weight' ? 'weightArea' : null,
          panel.yKcal ? 'down' : 'up', th.weightText, kcalPts.filter(Boolean), 'weight');
      }

      // 오른쪽 몸무게 축 (함께 보기)
      if (panel.yWeight && panel.yKcal) {
        const rx = width - padR + 7;
        out += `<text x="${rx}" y="${panel.top + 12}" text-anchor="start" font-size="9.5" font-weight="700"
          fill="${th.weightAxis}" letter-spacing=".04em">KG</text>`;
        wScale.ticks.forEach((t) => {
          const y = scaleFor(t, wScale);
          out += `<text x="${rx}" y="${(y + 3.4).toFixed(1)}" text-anchor="start" font-size="${isNarrow ? 9 : 10}"
            font-weight="600" fill="${th.weightAxis}">${U.kg(t)}</text>`;
        });
      }

      if (!hasKcal && panel.yKcal) {
        out += `<text x="${padL + plotW / 2}" y="${top + plotH / 2}" text-anchor="middle" font-size="12"
          fill="${th.axis}">칼로리 기록이 없어요</text>`;
      }
      if (!hasWeight && panel.key === 'weight') {
        out += `<text x="${padL + plotW / 2}" y="${top + plotH / 2}" text-anchor="middle" font-size="12"
          fill="${th.axis}">몸무게 기록이 없어요</text>`;
      }

      return out + `</g>`;
    },

    /** 작은 몸무게 스파크라인 */
    sparkline(container, series, opts) {
      const color = opts && opts.color ? opts.color : cssVar('--chart-weight', MINT);
      const surface = cssVar('--chart-surface', '#FFFFFF');
      const o = Object.assign({ color, height: 44 }, opts || {});
      container.innerHTML = '';
      if (!series || series.length < 1) return;
      const w = Math.max(120, Math.round(container.clientWidth || 260));
      const h = o.height;
      const pad = 8;
      const values = series.map((s) => s.weight);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;
      const n = series.length;
      const slot = (w - pad * 2) / Math.max(1, n - 1);
      const pts = series.map((s, i) => ({
        x: pad + (n === 1 ? (w - pad * 2) / 2 : i * slot),
        y: pad + (1 - (s.weight - min) / span) * (h - pad * 2),
      }));
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.setAttribute('height', String(h));
      svg.setAttribute('width', '100%');
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const area = `M${pts[0].x.toFixed(1)} ${h} ` + pts.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        + ` L${pts[pts.length - 1].x.toFixed(1)} ${h} Z`;
      const last = pts[pts.length - 1];
      svg.innerHTML = `
        <path d="${area}" fill="${o.color}" fill-opacity=".08"/>
        <path d="${d}" fill="none" stroke="${o.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.4" fill="${surface}" stroke="${o.color}" stroke-width="2"/>
      `;
      container.appendChild(svg);
    },
  };

  global.Chart = Chart;
})(window);
