/* ==========================================================================
   chart.js — 직접 그리는 SVG 선 그래프
   · 이중 Y축(칼로리/몸무게) 또는 따로 보기
   · 점을 x 위치(ratio)로 배치한다. 주간은 칸 가운데, 월간·연간은 날짜 간격 비율.
   · 꼭짓점 수치 라벨은 점이 많으면 간격을 벌려(자동 stride) 겹치지 않게 하고,
     선택한 점·최고·최저는 항상 남긴다. 라벨끼리 부딪히면 자동으로 비켜 놓는다.
   · 점을 가리키면 툴팁, 누르면 opts.onPick 으로 그날 정보를 넘긴다.
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

  /** 툴팁·정보 패널용 짧은 메모 */
  function brief(text, max) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  const NEAR_UP = [-13, -24, 19, -36, 31, -48, 43, -60];
  const NEAR_DOWN = [19, 31, -13, 43, -24, 55, -36, 67];
  const NEAR_UP_WIDE = [-14, -27, 20, -40, 33, -53, 46, -66, 59, -79];
  const NEAR_DOWN_WIDE = [20, 33, -14, 46, -27, 59, -40, 72, -53, 85];

  /**
   * 장애물(다른 시리즈의 점·이미 놓인 라벨)을 피해 라벨 자리를 고른다.
   * 위아래로 조금씩, 그리고 좌우로도 살짝 비켜 본다. 자리가 없으면 null —
   * 점에서 멀리 떨어진 라벨보다는 라벨을 생략하는 편이 깔끔하다.
   * dirs 는 시도할 방향 목록이다. 전체화면에서는 반대쪽(지그재그)까지 시도해
   * 겹치지 않는 한 최대한 많은 수치를 남긴다.
   * 반환값 { x, y } — 그릴 좌표.
   */
  function placeLabel(boxes, cx, baseY, w, h, dirs, bounds) {
    const nudge = Math.min(9, w / 3);
    const dxs = [0, -nudge, nudge, -nudge * 2, nudge * 2];
    const lo = bounds ? bounds.x1 : -Infinity;
    const hi = bounds ? bounds.x2 : Infinity;
    const top = bounds && bounds.y1 != null ? bounds.y1 : -Infinity;
    const bottom = bounds && bounds.y2 != null ? bounds.y2 : Infinity;
    const tries = Array.isArray(dirs) ? dirs : [dirs];
    for (const near of tries) {
      for (const dy of near) {
        for (const dx of dxs) {
          const x = Math.min(hi, Math.max(lo, cx + dx));
          const y = baseY + dy;
          if (y - h / 2 < top || y + h / 2 > bottom) continue;
          const box = { x1: x - w / 2 - 2, x2: x + w / 2 + 2, y1: y - h / 2 - 2, y2: y + h / 2 + 2 };
          if (!boxes.some((b) => overlaps(b, box))) {
            boxes.push(box);
            return { x, y };
          }
        }
      }
    }
    return null;
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
      const o = opts || {};
      const points = o.points || [];
      const mode = o.mode === 'split' ? 'split' : 'together';
      const goal = Number(o.goal) || 2000;
      const roomy = !!o.roomy;
      const expanded = !!o.expanded;
      container.innerHTML = '';
      if (!points.length) return;
      const th = themeColors();

      // 전체화면에서는 화면 폭을 그대로 쓴다(좁은 화면에서도 가로 스크롤 없이 꽉 차게)
      const minW = expanded ? 300 : roomy ? 520 : 280;
      const width = Math.max(minW, Math.round(o.width || container.clientWidth || 720));
      const isNarrow = width < 520;
      const gap = isNarrow ? 28 : roomy ? 46 : 36;
      const togetherH = roomy ? (isNarrow ? 300 : 410) : (isNarrow ? 250 : 300);
      const splitH = roomy ? (isNarrow ? 200 : 250) : (isNarrow ? 168 : 186);

      // 남은 높이를 받으면 그 높이를 꽉 채운다
      let totalH = mode === 'together' ? togetherH : splitH * 2 + gap;
      if (expanded && Number.isFinite(o.height) && o.height > 0) {
        totalH = Math.max(200, Math.round(o.height));
      }
      const hasKcal = points.some((p) => Number.isFinite(p.kcal));
      const hasWeight = points.some((p) => Number.isFinite(p.weight));

      const panels = mode === 'together'
        ? [{ key: 'both', top: 0, height: totalH, yKcal: true, yWeight: hasWeight }]
        : [
            { key: 'kcal', top: 0, height: Math.round((totalH - gap) / 2), yKcal: true, yWeight: false },
            { key: 'weight', top: Math.round((totalH - gap) / 2) + gap,
              height: Math.round((totalH - gap) / 2), yKcal: false, yWeight: true },
          ];
      totalH = panels[panels.length - 1].top + panels[panels.length - 1].height;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${width} ${totalH}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(totalH));
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', '칼로리와 몸무게 변화 그래프');
      svg.style.height = totalH + 'px';

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

      const maxKcal = Math.max(goal, ...points.map((p) => Number(p.kcal) || 0));
      const kcalTicks = U.niceTicks(0, maxKcal * 1.06, 5);
      const kcalScale = { ticks: kcalTicks, min: 0, max: kcalTicks[kcalTicks.length - 1] };
      const wScale = weightScale(points.map((p) => p.weight));

      const padL = isNarrow ? 33 : 44;
      const padR = mode === 'together' && hasWeight ? (isNarrow ? 40 : 46) : 16;
      const plotW = width - padL - padR;
      const n = points.length;
      const ratioOf = (i) => {
        const r = points[i] && points[i].ratio;
        if (Number.isFinite(r)) return U.clamp(r, 0, 1);
        return n === 1 ? 0.5 : (i + 0.5) / n;
      };
      const xOf = (i) => padL + ratioOf(i) * plotW;
      const selectedIdx = o.selected ? points.findIndex((p) => p.date === o.selected) : -1;

      const panelCtx = {
        points, width, goal, kcalScale, weightScale: wScale, hasKcal, hasWeight,
        isNarrow, padL, padR, plotW, xOf, th, selectedIdx, roomy, expanded,
      };
      panels.forEach((panel) => {
        markup += this._panelMarkup(Object.assign({ panel }, panelCtx, { height: panel.height }));
      });

      const last = panels[panels.length - 1];
      const baseY = last.top + last.height - 24;

      // 세로 구분선 (연간 그래프의 월 경계 등)
      (o.dividers || []).forEach((d) => {
        const x = padL + U.clamp(d.ratio, 0, 1) * plotW;
        markup += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${(panels[0].top + 20).toFixed(1)}"
          y2="${baseY.toFixed(1)}" stroke="${th.grid}" stroke-width="1" stroke-dasharray="2 5"/>`;
      });

      // x축 라벨 — 점이 스스로 tick 여부를 정한다 (월간: 5일 간격, 연간: 매월 1일)
      markup += '<g class="chart-x">';
      points.forEach((p, i) => {
        if (p.tick === false) return;
        const text = p.tickText != null && p.tickText !== '' ? p.tickText : p.label;
        markup += `<text x="${xOf(i).toFixed(1)}" y="${(baseY + 15).toFixed(1)}" text-anchor="middle"
          font-size="${isNarrow ? 10 : 11}" font-weight="400" fill="${th.axis}">${U.esc(text)}</text>`;
      });
      markup += '</g>';

      // 가리키기·누르기 영역 (이웃 점과의 중간을 경계로 나눈다)
      markup += '<g class="chart-hit">';
      points.forEach((p, i) => {
        const left = i === 0 ? padL : (xOf(i - 1) + xOf(i)) / 2;
        const right = i === n - 1 ? padL + plotW : (xOf(i) + xOf(i + 1)) / 2;
        const w = Math.max(4, right - left);
        markup += `<rect x="${left.toFixed(1)}" y="${panels[0].top}" width="${w.toFixed(1)}"
          height="${(last.top + last.height - panels[0].top).toFixed(1)}" fill="transparent"
          data-i="${i}" style="cursor:pointer"/>`;
      });
      markup += '</g>';

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
      guide.style.pointerEvents = 'none';
      svg.appendChild(guide);

      const showTip = (i) => {
        const p = points[i];
        if (!p) return;
        const x = xOf(i);
        guide.setAttribute('x1', x); guide.setAttribute('x2', x);
        guide.setAttribute('y1', panels[0].top + 10);
        guide.setAttribute('y2', baseY);
        guide.style.opacity = '1';
        const diff = p.kcal == null ? null : p.kcal - goal;
        const diffText = diff == null ? ''
          : diff === 0 ? ' · 목표와 같음'
            : diff > 0 ? ` · 목표 +${U.num(diff)} kcal` : ` · 목표 −${U.num(-diff)} kcal`;
        tip.innerHTML = `<b>${U.esc(p.full || p.label)}</b>
          <span class="chart-tip__kcal">섭취 ${p.kcal == null ? '기록 없음' : U.num(p.kcal) + ' kcal' + diffText}</span>
          <span class="chart-tip__weight">몸무게 ${p.weight == null ? '기록 없음' : U.kg(p.weight) + ' kg'}</span>
          ${p.note ? `<span class="chart-tip__note">메모 ${U.esc(brief(p.note, 34))}</span>` : ''}
          <span class="chart-tip__hint">눌러서 그날 기록 보기</span>`;
        tip.style.left = U.clamp(x, 88, width - 88) + 'px';
        // 툴팁은 그 점 바로 위에 — 위/아래 끝을 넘지 않게
        const p0 = panels[0];
        const pt = p0.top + 25;
        const pb = p0.top + p0.height - 24;
        const ph = pb - pt;
        const scale = Number.isFinite(p.kcal) ? kcalScale : Number.isFinite(p.weight) ? wScale : null;
        const value = Number.isFinite(p.kcal) ? p.kcal : p.weight;
        const yAt = scale && Number.isFinite(value)
          ? pt + ph - ((value - scale.min) / (scale.max - scale.min || 1)) * ph
          : pb;
        tip.style.top = U.clamp(yAt - 14, 106, pb) + 'px';
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
        r.addEventListener('click', () => {
          hideTip();
          if (typeof o.onPick === 'function') o.onPick(Number(r.dataset.i), points[Number(r.dataset.i)]);
        });
      });
      svg.addEventListener('pointerleave', hideTip);
      // 다시 그린 뒤 포인터가 남아 있어도 툴팁이 차트를 가리지 않도록, 누를 때는 숨긴다
      svg.addEventListener('pointerup', () => hideTip());
    },

    _panelMarkup(ctx) {
      const { panel, points, width, height, goal, kcalScale, weightScale: wScale,
        hasKcal, hasWeight, isNarrow, padL, padR, plotW, xOf, th, selectedIdx, expanded } = ctx;

      const top = panel.top + 25;
      const bottom = panel.top + height - 24;
      const plotH = bottom - top;
      const scaleFor = (v, scale) => top + plotH - ((v - scale.min) / (scale.max - scale.min || 1)) * plotH;

      const kcalPts = points.map((p, i) => (Number.isFinite(p.kcal) ? { x: xOf(i), y: scaleFor(p.kcal, kcalScale), v: p.kcal, i } : null));
      const weightPts = points.map((p, i) => (Number.isFinite(p.weight) ? { x: xOf(i), y: scaleFor(p.weight, wScale), v: p.weight, i } : null));

      let out = `<g class="chart-panel" data-panel="${panel.key}">`;

      // 가로 그리드
      const ticks = panel.yKcal ? kcalScale.ticks : wScale.ticks;
      ticks.forEach((t) => {
        const y = scaleFor(t, panel.yKcal ? kcalScale : wScale);
        out += `<line x1="${padL}" x2="${width - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"
          stroke="${th.grid}" stroke-width="1"/>`;
        out += `<text x="${padL - 7}" y="${(y + 3.4).toFixed(1)}" text-anchor="end" font-size="${isNarrow ? 9.5 : 10.5}"
          font-weight="400" fill="${th.axis}">${U.num(t)}</text>`;
      });

      if (panel.yKcal && panel.key === 'both') {
        out += `<text x="${padL - 7}" y="${panel.top + 12}" text-anchor="end" font-size="10.5" font-weight="500"
          fill="${th.axis}" letter-spacing=".04em">KCAL</text>`;
      }
      if (panel.key === 'kcal') {
        out += `<text x="${padL}" y="${panel.top + 12}" font-size="11.5" font-weight="500"
          fill="${th.label}" letter-spacing="-.01em">칼로리 <tspan fill="${th.axis}" font-weight="400">kcal</tspan></text>`;
      }
      if (panel.key === 'weight') {
        out += `<text x="${padL}" y="${panel.top + 12}" font-size="11.5" font-weight="500"
          fill="${th.weightText}" letter-spacing="-.01em">몸무게 <tspan fill="${th.weightAxis}" font-weight="400">kg</tspan></text>`;
      }

      // 두 시리즈가 같은 '이미 놓인 라벨' 목록을 나눠 쓴다(선이 교차해도 라벨이 겹치지 않게).
      // 연간(365일)처럼 점이 촘촘하면 점 자체는 장애물로 두지 않는다 — 점이 선 위에
      // 빽빽해 라벨 자리를 다 막아 버리기 때문. 전체화면에서는 라벨끼리의 충돌만 본다.
      const pitch = points.length > 1 ? plotW / (points.length - 1) : plotW;
      const dotsDense = points.length > 1 && pitch < (expanded ? 14 : 8);
      const placeBoxes = expanded && dotsDense
        ? [selectedIdx >= 0 ? kcalPts.find((pt) => pt && pt.i === selectedIdx) : null,
           selectedIdx >= 0 ? weightPts.find((pt) => pt && pt.i === selectedIdx) : null]
            .filter(Boolean).map((pt) => pointBox(pt, 8))
        : kcalPts.filter(Boolean).map((pt) => pointBox(pt, 7))
          .concat(weightPts.filter(Boolean).map((pt) => pointBox(pt, 7)));
      // 패널 제목(칼로리 kcal / 몸무게 kg)도 수치 라벨이 덮지 않도록 장애물로 둔다
      if (panel.key === 'kcal' || panel.key === 'weight') {
        const title = panel.key === 'kcal' ? '칼로리 kcal' : '몸무게 kg';
        placeBoxes.push({ x1: padL - 2, x2: padL + textWidth(title, 11.5) + 4, y1: panel.top + 1, y2: panel.top + 18 });
      }

      // 목표선
      if (panel.yKcal && hasKcal) {
        const gy = scaleFor(goal, kcalScale);
        if (gy >= top - 1 && gy <= bottom + 1) {
          out += `<line x1="${padL}" x2="${width - padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}"
            stroke="${th.goal}" stroke-width="1.3" stroke-dasharray="5 5"/>`;
          if (!isNarrow) {
            const goalLabel = `목표 ${U.num(goal)}`;
            const gw = textWidth(goalLabel, 10.5);
            out += `<text x="${padL + 4}" y="${(gy - 6).toFixed(1)}" text-anchor="start" font-size="10.5"
              font-weight="500" fill="${th.goalText}">${U.esc(goalLabel)}</text>`;
            // 수치 라벨이 목표선 글자를 덮지 않도록 장애물로 등록
            placeBoxes.push({ x1: padL, x2: padL + 8 + gw, y1: gy - 17, y2: gy - 1 });
          }
        }
      }

      const fs = expanded ? (isNarrow ? 10.5 : 11.5) : (isNarrow ? 9.5 : 10.5);
      const labelW = textWidth('8,888', fs) + 9;
      const labels = [];


      /** 라벨을 붙일 점 고르기 — x 간격을 지키며 고르고, 첫·끝·최고·최저·고른 날은 자리가 나면 함께 남긴다 */
      const pickLabels = (valid) => {
        if (!valid.length) return [];
        if (expanded) {
          // 전체화면 — 실제 픽셀 충돌만 피하면서 최대한 많은 수치를 붙인다.
          // 라벨 두 개가 겹치지 않을 만큼(자기 폭만큼)만 x 간격을 두고,
          // 자리가 귀한 점(고른 날·최고·최저)을 먼저 놓은 뒤 왼쪽부터 채운다.
          const gapPx = labelW + 2;
          const ordered = [];
          const push = (pt, minGap) => {
            if (!pt || ordered.indexOf(pt) >= 0) return false;
            if (ordered.some((k) => Math.abs(k.x - pt.x) < (minGap == null ? gapPx : minGap))) return false;
            ordered.push(pt);
            return true;
          };
          let hi = valid[0], lo = valid[0];
          valid.forEach((pt) => { if (pt.v > hi.v) hi = pt; if (pt.v < lo.v) lo = pt; });
          if (selectedIdx >= 0) push(valid.find((pt) => pt.i === selectedIdx));
          push(hi);
          push(lo);
          let lastX = -1e9;
          valid.forEach((pt) => {
            if (pt.x - lastX < gapPx) return;
            if (push(pt)) lastX = pt.x;
          });
          // 넓은 화면에서만 자리가 남았을 때 조밀한 간격으로 한 번 더
          // (좁은 화면은 두 줄로 쌓이며 지저분해지고, 연간처럼 점이 아주 많으면
          //  한 번에 다 보여 주는 것보다 일정 간격으로 고른 수치가 읽기 좋다)
          if (!isNarrow && valid.length <= 62) {
            let lastX2 = -1e9;
            valid.forEach((pt) => {
              if (ordered.indexOf(pt) >= 0) return;
              if (pt.x - lastX2 < labelW * 0.5) return;
              if (push(pt, labelW * 0.5)) lastX2 = pt.x;
            });
          }
          return ordered;
        }
        const gapPx = Math.max(isNarrow ? 42 : 30, labelW + 2);
        const keep = [];
        let lastX = -1e9;
        valid.forEach((pt) => {
          if (pt.x - lastX >= gapPx) { keep.push(pt); lastX = pt.x; }
        });
        if (valid.length && keep[0] !== valid[0]) keep.unshift(valid[0]);
        const tail = valid[valid.length - 1];
        if (keep[keep.length - 1] !== tail) keep.push(tail);
        let hi = valid[0], lo = valid[0];
        valid.forEach((pt) => { if (pt.v > hi.v) hi = pt; if (pt.v < lo.v) lo = pt; });
        const extras = [hi, lo];
        if (selectedIdx >= 0) {
          const sel = valid.find((pt) => pt.i === selectedIdx);
          if (sel) extras.push(sel);
        }
        extras.forEach((pt) => {
          if (keep.includes(pt)) return;
          if (keep.some((k) => Math.abs(k.x - pt.x) < gapPx * 0.7)) return;
          keep.push(pt);
        });
        return keep.sort((a, b) => a.x - b.x);
      };

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
        const bridges = [];
        let prevPt = null;
        pts.forEach((pt) => {
          if (!pt) { pen = false; return; }
          if (!pen && prevPt) bridges.push([prevPt, pt]);
          d += `${pen ? 'L' : 'M'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
          pen = true;
          prevPt = pt;
        });
        // 기록이 빠진 날을 건너는 부분은 점선으로만 이어 흐름을 보여 준다 (값을 채워 넣지 않음)
        bridges.forEach(([a, b]) => {
          out += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"
            stroke="${color}" stroke-width="1.3" stroke-dasharray="2 4" stroke-opacity=".55" stroke-linecap="round"/>`;
        });
        if (d) {
          out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.4"
            stroke-linejoin="round" stroke-linecap="round"/>`;
        }

        // 점이 아주 촘촘하면(연간 365일) 점은 생략하고 선만 그려 뭉개지지 않게 한다
        const dense = valid.length > 1 && pitch < (expanded ? 3.2 : 6);
        const r = dense ? 2.4 : 4.2;
        valid.forEach((pt) => {
          const isSel = pt.i === selectedIdx;
          if (dense && !isSel) return;
          if (isSel) {
            out += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${(r + 5).toFixed(1)}"
              fill="${color}" fill-opacity=".16" stroke="none"/>`;
          }
          out += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${isSel ? r + 1.4 : r}" fill="${th.surface}"
            stroke="${color}" stroke-width="${isSel ? 2.8 : 2.2}"/>`;
        });

        // 라벨 자리는 여기서만 계산해 두고, 두 시리즈를 모두 그린 뒤 맨 위에 얹는다
        // (나중에 그린 점이 먼저 놓인 라벨을 가리는 일이 없게).
        const chosen = pickLabels(valid);
        // 전체화면은 반대쪽 자리까지 번갈아 시도해(지그재그) 더 많은 수치를 남긴다
        const dirs = expanded
          ? (dir === 'up' ? [NEAR_UP_WIDE, NEAR_DOWN_WIDE] : [NEAR_DOWN_WIDE, NEAR_UP_WIDE])
          : [dir === 'up' ? NEAR_UP : NEAR_DOWN];
        chosen.forEach((pt) => {
          if (expanded && labels.length >= 180) return;
          const label = labelText(pt.v, kind || 'kcal');
          const w = textWidth(label, fs);
          const h = fs + 2;
          const at = placeLabel(placeBoxes, pt.x, pt.y, w, h, dirs, {
            // 아래로는 x축 눈금 글자(y = bottom+15 부근)를 덮지 않는 데까지만
            x1: padL + w / 2, x2: width - padR - w / 2, y1: panel.top + 2, y2: bottom + 2,
          });
          if (!at) return;   // 자리가 없으면 생략
          labels.push({ x: at.x, y: at.y, w, h, fs, label, color: labelColor, strong: pt.i === selectedIdx });
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

      // 수치 라벨 — 배경을 먼저 모두 깔고 글자를 그 위에 얹는다(라벨끼리 겹쳐도 글자가 가려지지 않게).
      labels.forEach((b) => {
        out += `<rect x="${(b.x - b.w / 2 - 2.5).toFixed(1)}" y="${(b.y - b.h / 2 - 0.5).toFixed(1)}"
          width="${(b.w + 5).toFixed(1)}" height="${(b.h + 1).toFixed(1)}" rx="4"
          fill="${th.surface}" fill-opacity=".96"/>`;
      });
      labels.forEach((b) => {
        out += `<text x="${b.x.toFixed(1)}" y="${(b.y + b.fs * 0.34).toFixed(1)}" text-anchor="middle"
          font-size="${b.fs}" font-weight="${b.strong ? 600 : 500}" fill="${b.color}"
          style="font-variant-numeric:tabular-nums">${U.esc(b.label)}</text>`;
      });

      // 오른쪽 몸무게 축 (함께 보기)
      if (panel.yWeight && panel.yKcal) {
        const rx = width - padR + 7;
        out += `<text x="${rx}" y="${panel.top + 12}" text-anchor="start" font-size="10.5" font-weight="500"
          fill="${th.weightAxis}" letter-spacing=".04em">KG</text>`;
        wScale.ticks.forEach((t) => {
          const y = scaleFor(t, wScale);
          out += `<text x="${rx}" y="${(y + 3.4).toFixed(1)}" text-anchor="start" font-size="${isNarrow ? 9.5 : 10.5}"
            font-weight="400" fill="${th.weightAxis}">${U.kg(t)}</text>`;
        });
      }

      if (!hasKcal && panel.yKcal) {
        out += `<text x="${padL + plotW / 2}" y="${top + plotH / 2}" text-anchor="middle" font-size="12.5"
          fill="${th.axis}">칼로리 기록이 없어요</text>`;
      }
      if (!hasWeight && panel.key === 'weight') {
        out += `<text x="${padL + plotW / 2}" y="${top + plotH / 2}" text-anchor="middle" font-size="12.5"
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
