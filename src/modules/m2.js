// 平面图形（7.2）：认识、边／顶点／曲线、小挑战（7.3）。纯平面画面，不用 3D
import { INK } from '../core/ink.js';
import { reducedMotion } from '../core/stage3d.js';
import { FLAT, FLAT_IDS, countOf, hasVertex, flatSVG, flatIcon, PAL } from '../core/flat.js';
import { renderQuiz, shuffle, pick } from '../core/quiz.js';
import { keysHTML, toggleKeys } from '../core/keys.js';

const KIND = { edge: { zh: '直线边', unit: '条', color: 'line' }, vert: { zh: '顶点', unit: '个' }, curve: { zh: '曲线', unit: '条', color: 'curve' } };
const FINGER = '<svg class="finger" viewBox="0 0 84 84"><rect x="32" y="4" width="22" height="48" rx="11" fill="#fff" stroke="#3B2A1A" stroke-width="5"/><rect x="14" y="40" width="58" height="40" rx="16" fill="#fff" stroke="#3B2A1A" stroke-width="5"/></svg>';
const K = [['<kbd>空白键</kbd>', '揭晓／下一步'], ['<kbd>←</kbd><kbd>→</kbd>', '上一项／下一项']];

let S, host, panel, chipsEl, flatEl, sqEl, ctxRef, offMode, ro;

// ———— 数据：数量表（由数据得出）————
const total = (id, k) => { const c = countOf(id); return k === 'edge' ? c.lines : k === 'vert' ? c.verts : c.curves; };
export function m2Table() {
  return FLAT_IDS.map((id) => ({ id, name: FLAT[id].name, ...countOf(id) }));
}

// ———— 平面画面 ————
const C0 = 200, KK = 100; // 画面中心、图形缩放（viewBox 0..400）
function verts(id) { return FLAT[id].poly.map(([x, y]) => [C0 + x * KK, C0 + y * KK]); }

function flatMarks(id, k, n, cur) {
  let svg = '', badges = '';
  const sq = (x, y, cls, html) => (badges += `<div class="sbadge mk ${cls}${''}" style="left:${(x / 400) * 100}%;top:${(y / 400) * 100}%">${html}</div>`);
  if (k === 'edge' && FLAT[id].poly) {
    const V = verts(id);
    for (let i = 0; i < n; i++) {
      const A = V[i], B = V[(i + 1) % V.length], isCur = i === cur;
      svg += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${INK}" stroke-width="${isCur ? 24 : 20}" stroke-linecap="butt"/><line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${isCur ? '#FFC93C' : '#F2564B'}" stroke-width="${isCur ? 16 : 12}" stroke-linecap="butt"/>`;
      const mx = (A[0] + B[0]) / 2 - C0, my = (A[1] + B[1]) / 2 - C0, ml = Math.hypot(mx, my) || 1;
      sq((A[0] + B[0]) / 2 + (mx / ml) * 46, (A[1] + B[1]) / 2 + (my / ml) * 46, `edge line${isCur ? ' cur' : ''}`, `<span class="n">${i + 1}<small>直线</small></span>`);
    }
  }
  if (k === 'vert' && FLAT[id].poly) {
    const V = verts(id);
    for (let i = 0; i < n; i++) {
      const Vt = V[i], isCur = i === cur, dx = Vt[0] - C0, dy = Vt[1] - C0, dl = Math.hypot(dx, dy) || 1;
      svg += `<circle cx="${Vt[0]}" cy="${Vt[1]}" r="${isCur ? 25 : 22}" fill="${isCur ? 'rgba(255,201,60,.55)' : 'rgba(255,255,255,.2)'}" stroke="${isCur ? INK : '#F2564B'}" stroke-width="${isCur ? 9 : 8}"/>`;
      sq(Vt[0] + (dx / dl) * 62, Vt[1] + (dy / dl) * 62, `fvert${isCur ? ' cur' : ''}`, `<span class="n">${i + 1}</span>`);
    }
  }
  if (k === 'curve' && id === 'circle' && n >= 1) {
    const L = 2 * Math.PI * KK;
    svg += `<circle cx="${C0}" cy="${C0}" r="${KK}" fill="none" stroke="${INK}" stroke-width="22"/><circle id="curveRing" cx="${C0}" cy="${C0}" r="${KK}" fill="none" stroke="#3E8EDE" stroke-width="14" stroke-dasharray="${L}" stroke-dashoffset="${reducedMotion() ? 0 : L}" transform="rotate(-90 ${C0} ${C0})"/>`;
    sq(C0 + KK * 0.72 + 38, C0 - KK * 0.72 - 38, 'edge curve cur', '<span class="n">1<small>曲线</small></span>');
  }
  return { svg, badges };
}

function renderFlat() {
  if (!flatEl) return;
  const id = FLAT_IDS[S.idx];
  const col = S.colors[id];
  let marks = { svg: '', badges: '' }, extra = '';
  if (S.tab === 'know' && S.kind) marks = flatMarks(id, S.kind, S.n, S.cur);
  if (S.tab === 'know' && S.kind && total(id, S.kind) === 0) extra = `<div class="callout">没有${KIND[S.kind].zh}</div>${FINGER}`;
  sqEl.innerHTML = `<svg viewBox="0 0 400 400" role="img" aria-label="${FLAT[id].name}">${flatSVG(id, { cx: C0, cy: C0, k: KK, color: col, sw: 7 })}${marks.svg}</svg>${marks.badges}${extra}`;
  const ring = sqEl.querySelector('#curveRing');
  if (ring) { ring.getBoundingClientRect(); ring.style.transition = 'stroke-dashoffset 1.2s ease-in-out'; ring.setAttribute('stroke-dashoffset', 0); }
}

function fitFlat() {
  if (!flatEl || !sqEl) return;
  const w = flatEl.clientWidth, h = flatEl.clientHeight - (S.tab === 'know' ? 76 : 0), s = Math.max(Math.min(w, h) - 24, 120);
  sqEl.style.width = sqEl.style.height = s + 'px';
  flatEl.style.paddingBottom = S.tab === 'know' ? '76px' : '0';
}

// ———— 小挑战：图中有几个……（答案由图形数据数出来）————
const CH_Q = [
  { id: 'tri', text: '三角形', test: (s) => s === 'tri' },
  { id: 'circle', text: '圆形', test: (s) => s === 'circle' },
  { id: 'square', text: '正方形', test: (s) => s === 'square' },
  { id: 'angled', text: '有顶点的图形', test: (s) => hasVertex(s) },
];
export function makeChallenge() {
  const cells = shuffle([...Array(9).keys()]).slice(0, 6 + Math.floor(Math.random() * 4));
  const items = cells.map((c) => {
    const shape = pick(FLAT_IDS), r = c;
    return { shape, color: pick(PAL), col: r % 3, row: Math.floor(r / 3), rot: shape === 'tri' ? pick([0, 180]) : shape === 'rect' ? pick([0, 90]) : 0 };
  });
  const q = pick(CH_Q);
  const answer = items.filter((it) => q.test(it.shape)).length;
  return { items, q, answer };
}
export function challengeSVG(ch, mark = false) {
  let n = 0, s = '';
  ch.items.forEach((it) => {
    const cx = 70 + it.col * 130, cy = 70 + it.row * 130;
    const m = mark && ch.q.test(it.shape);
    s += flatSVG(it.shape, { cx, cy, k: 38, rot: it.rot, color: it.color, sw: 5, extra: `data-shape="${it.shape}"` });
    if (m) { n++; s += `<circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="#F2564B" stroke-width="6" stroke-dasharray="10 8"/><g><circle cx="${cx + 42}" cy="${cy - 42}" r="18" fill="#3B2A1A"/><text x="${cx + 42}" y="${cy - 34}" font-size="24" font-weight="900" fill="#fff" text-anchor="middle">${n}</text></g>`; }
  });
  return `<svg viewBox="0 0 400 400" role="img" aria-label="数一数">${s}</svg>`;
}
// 自动检查：从画面上真正画出来的元素数一遍，与答案比对
export function checkChallenge(ch, svgEl) {
  const drawn = [...svgEl.querySelectorAll('[data-shape]')].map((e) => e.getAttribute('data-shape'));
  const counted = drawn.filter((s) => ch.q.test(s)).length;
  return drawn.length === ch.items.length && counted === ch.answer;
}

function newChallenge() {
  const ch = makeChallenge();
  const nums = new Set([ch.answer]); const cand = shuffle([...Array(10).keys()].filter((x) => x !== ch.answer && Math.abs(x - ch.answer) <= 3));
  while (nums.size < 3) nums.add(cand.pop());
  const arr = shuffle([...nums]);
  S.ch = { ch, shown: false, q: { title: `图中有几个${ch.q.text}？`, labels: arr.map(String), correct: arr.indexOf(ch.answer), cols: 3, done: false, goodMsg: `数一数，真的是 ${ch.answer} 个。`, badMsg: `正确答案是 ${ch.answer} 个。看，一个一个数。`, onDone: () => { S.ch.shown = true; paintChallenge(); } } };
}
function paintChallenge() {
  const ch = S.ch.ch;
  sqEl.innerHTML = challengeSVG(ch, S.ch.shown);
  ch.verified = checkChallenge(ch, sqEl.querySelector('svg'));
}

// ———— 面板 ————
const TABS = [['know', '认识'], ['chal', '小挑战']];
const tabsHTML = () => `<div class="tabs grid">${TABS.map(([k, t]) => `<button class="btn small${S.tab === k ? ' on' : ''}" data-a="tab-${k}">${t}</button>`).join('')}</div>`;
const KEYS = () => keysHTML(K);

function toolsHTML() {
  const k = S.kind;
  return `<div class="grp6">
    <button class="btn s2 red${k === 'edge' ? ' on' : ''}" data-a="kind-edge">直线边</button>
    <button class="btn s2 purple${k === 'vert' ? ' on' : ''}" data-a="kind-vert">顶点</button>
    <button class="btn s2 blue${k === 'curve' ? ' on' : ''}" data-a="kind-curve">曲线</button>
    <button class="btn s4 green" data-a="step"${k ? '' : ' disabled'}>数下一个</button>
    <button class="btn s2 orange" data-a="all"${k ? '' : ' disabled'}>全部</button></div>`;
}
function describe(id, k) {
  const T = total(id, k);
  if (T === 0) return `没有${KIND[k].zh}`;
  return `一共 ${T} ${KIND[k].unit}${KIND[k].zh}` + (k === 'edge' ? '，都是直的' : k === 'curve' ? '，沿着圆周绕一圈' : '');
}
function readout() {
  const id = FLAT_IDS[S.idx], k = S.kind;
  if (!k) return `<div class="readout"><div class="line">${S.name ? `这是<b>${FLAT[id].name}</b>。` : '先猜一猜：这是什么图形？'}<br>想数一数，就按「直线边」「顶点」「曲线」。</div></div>`;
  const T = total(id, k);
  let line;
  if (T === 0) line = `<b>${describe(id, k)}</b>。` + (k === 'curve' ? '边都是直直的。' : k === 'vert' ? '摸一摸，圆圆的，找不到尖尖的顶点。' : '圆的边是弯弯的。');
  else if (S.n === 0) line = '点「数下一个」或按空白键，一个一个数。';
  else if (S.n < T) line = `第 ${S.n} ${KIND[k].unit}${KIND[k].zh}`;
  else line = `<b>${describe(id, k)}</b>`;
  return `<div class="readout"><div class="big">${S.n}</div><div class="line">${line}</div></div>`;
}

function newKnowQ() {
  const id = FLAT_IDS[S.idx];
  if (Math.random() < 0.5) {
    const ids = shuffle([id, ...shuffle(FLAT_IDS.filter((x) => x !== id)).slice(0, 2)]);
    S.q = { type: 'name', title: '这是什么图形？', labels: ids.map((x) => FLAT[x].name), correct: ids.indexOf(id), cols: 1, goodMsg: `是「${FLAT[id].name}」。`, badMsg: `正确答案是「${FLAT[id].name}」。`, onDone: () => { S.name = true; renderFlat(); nameTag(); } };
  } else {
    const k = pick(['edge', 'vert', 'curve']), c = total(id, k);
    const set = new Set([c]); const cand = shuffle([...Array(7).keys()].filter((x) => x !== c));
    while (set.size < 3) set.add(cand.pop());
    const nums = shuffle([...set]);
    S.q = { type: 'count', k, title: `这个图形有几${KIND[k].unit}${KIND[k].zh}？`, labels: nums.map(String), correct: nums.indexOf(c), cols: 3, hint: '先数一数（按下面的按钮），再选答案。', goodMsg: `真的有 ${c}。`, badMsg: `正确答案是 ${c}。看，这样一个一个数。`, onDone: (ok) => { if (!ok) { S.kind = k; S.n = total(id, k); S.cur = -1; } renderFlat(); } };
  }
}
function nextKnow() {
  let i; do { i = Math.floor(Math.random() * 4); } while (i === S.idx);
  S.idx = i; S.name = false; S.kind = null; S.n = 0; newKnowQ(); render();
}
function nameTag() {
  if (!host) return;
  let t = host.querySelector('.tag');
  const show = S.tab === 'know';
  if (!show) { t?.remove(); return; }
  if (!t) { t = document.createElement('div'); (host.querySelector('.cv') || host).appendChild(t); }
  const known = S.name || (ctxRef.getMode() === 'practice' && S.q?.done && S.q.type === 'name');
  t.className = 'tag' + (known ? '' : ' hidden');
  t.textContent = known ? FLAT[FLAT_IDS[S.idx]].name : '这是什么图形？';
  if (ctxRef.getMode() === 'practice' && S.q && S.q.type === 'count' && !S.q.done && S.tab === 'know') t.style.display = 'none'; else t.style.display = '';
}
function renderChips() {
  const show = ctxRef.getMode() === 'teach' && S.tab === 'know';
  chipsEl.style.display = show ? '' : 'none';
  if (!chipsEl.dataset.built) {
    chipsEl.dataset.built = 1;
    chipsEl.innerHTML = '<button class="btn nav" aria-label="上一个" data-d="-1">◀</button>' + FLAT_IDS.map((_, i) => `<button class="btn chip" aria-label="第${i + 1}个图形" data-i="${i}">${i + 1}</button>`).join('') + '<button class="btn nav" aria-label="下一个" data-d="1">▶</button>';
    chipsEl.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.i != null) pickShape(+b.dataset.i); else pickShape((S.idx + +b.dataset.d + 4) % 4); };
  }
  chipsEl.querySelectorAll('.chip').forEach((b, i) => b.classList.toggle('on', i === S.idx));
}
function pickShape(i) { S.idx = i; S.name = false; S.kind = null; S.n = 0; S.cur = -1; render(); }

function render() {
  const practice = ctxRef.getMode() === 'practice';
  nameTag(); renderChips();
  fitFlat(); if (S.tab !== 'chal') renderFlat(); else { if (!S.ch) newChallenge(); paintChallenge(); }
  if (S.tab === 'know') {
    if (!practice) {
      panel.innerHTML = tabsHTML() + `<div class="grp6"><button class="btn s4 yellow" data-a="name">${S.name ? '隐藏名称' : '显示名称'}</button><button class="btn s2" data-a="clear"${S.kind || S.name ? '' : ' disabled'}>清除</button></div>` + toolsHTML() + readout() + KEYS();
    } else {
      if (!S.q) newKnowQ();
      const extra = S.q.type === 'count' ? toolsHTML() : '';
      panel.innerHTML = tabsHTML() + '<div id="qbox" class="qbox"></div>';
      renderQuiz(panel.querySelector('#qbox'), S.q, { next: nextKnow, burstHost: host, extra });
    }
  } else if (S.tab === 'chal') {
    if (!S.ch) newChallenge();
    if (!practice) {
      const ch = S.ch.ch;
      panel.innerHTML = tabsHTML() + `<div class="readout"><div class="q">小挑战：图中有几个${ch.q.text}？</div><div class="line">${S.ch.shown ? `<b>答案：${ch.answer} 个</b>` : '数一数，再按「揭晓」。'}</div></div><div class="grp6"><button class="btn s6 red" data-a="chreveal">${S.ch.shown ? '再藏起来' : '揭晓'}</button><button class="btn s6 green" data-a="chnext">换一题 ▶</button></div>` + KEYS();
    } else {
      panel.innerHTML = tabsHTML() + '<div id="qbox" class="qbox"></div>';
      renderQuiz(panel.querySelector('#qbox'), S.ch.q, { next: () => { newChallenge(); render(); }, burstHost: host });
    }
  }
}

function setTab(t) {
  if (S.tab === t) return;
  S.tab = t; S.q = null; S.name = false; S.kind = null; S.n = 0; S.cur = -1;
  host.querySelectorAll('.finger,.callout').forEach((e) => e.remove());
  if (t === 'chal') { S.ch = null; }
  render();
}

function onPanel(e) {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  const id = FLAT_IDS[S.idx];
  if (a === 'keys') { toggleKeys(); render(); }
  else if (a.startsWith('tab-')) setTab(a.slice(4));
  else if (a.startsWith('kind-')) { const k = a.slice(5); if (S.kind === k) { S.kind = null; S.n = 0; } else { S.kind = k; S.n = 0; S.cur = -1; } render(); }
  else if (a === 'step') step();
  else if (a === 'all') { if (S.kind) { S.n = total(id, S.kind); S.cur = -1; render(); } }
  else if (a === 'clear') { S.name = false; S.kind = null; S.n = 0; render(); }
  else if (a === 'name') { S.name = !S.name; render(); }
  else if (a === 'chreveal') { S.ch.shown = !S.ch.shown; paintChallenge(); render(); }
  else if (a === 'chnext') { newChallenge(); render(); }
}
function step() {
  const id = FLAT_IDS[S.idx];
  if (S.kind && S.n < total(id, S.kind)) { S.n++; S.cur = S.n - 1; render(); }
}
function onKey(e) {
  const teach = ctxRef.getMode() === 'teach';
  if (e.code === 'Space') {
    e.preventDefault(); if (e.type === 'keyup') return;
    if (!teach) { panel.querySelector('#qnext')?.style.visibility !== 'hidden' && panel.querySelector('#qnext')?.click(); return; }
    if (S.tab === 'know') { if (S.kind) step(); else if (!S.name) { S.name = true; render(); } else pickShape((S.idx + 1) % 4); }
    else if (S.tab === 'chal') { if (!S.ch.shown) { S.ch.shown = true; paintChallenge(); render(); } else { newChallenge(); render(); } }
    return;
  }
  if (e.type !== 'keydown') return;
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && teach && S.tab === 'know') pickShape((S.idx + (e.key === 'ArrowRight' ? 1 : 3)) % 4);
}

export default {
  title: '平面图形',
  mount(body, ctx) {
    ctxRef = ctx;
    S = { tab: 'know', idx: 0, name: false, kind: null, n: 0, cur: -1, q: null, ch: null, colors: { square: '#F2564B', rect: '#FFC93C', tri: '#46B97A', circle: '#3E8EDE' } };
    body.innerHTML = '<div class="stagecol"><div class="stage svg-only" id="host"><div class="cv"></div></div><div class="chips" id="chips"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel'); chipsEl = body.querySelector('#chips');
    const cv = host.querySelector('.cv');
    flatEl = document.createElement('div'); flatEl.className = 'flat'; sqEl = document.createElement('div'); sqEl.className = 'sq'; flatEl.appendChild(sqEl); cv.appendChild(flatEl);
    ro = new ResizeObserver(() => fitFlat()); ro.observe(flatEl);
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { S.q = null; S.name = false; S.kind = null; S.n = 0; S.ch = null; render(); });
    render();
    window.__m2 = { S: () => S, table: m2Table, total, makeChallenge, challengeSVG, checkChallenge, tab: setTab, pickShape, newChallenge };
  },
  unmount() {
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    offMode?.(); ro?.disconnect();
    delete window.__m2;
  },
};
