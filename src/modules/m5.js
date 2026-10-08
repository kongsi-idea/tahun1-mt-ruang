import { stage, THREE, ease, dur } from '../core/stage3d.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { COLORS, INK, inkMat, faceMaterial } from '../core/ink.js';
import { mountOptions, idleFeedback, burst, shuffle, pick } from '../core/quiz.js';
import { NETS, key, analyze, pickRoot, buildPools, landscape, normalize } from './netlogic.js';

const HALF = Math.PI / 2, DUR = 750, STEP = 230;
const OFF = { N: [0, -0.5], S: [0, 0.5], W: [-0.5, 0], E: [0.5, 0] };
const AX = { N: ['x', 1], S: ['x', -1], E: ['z', 1], W: ['z', -1] };
const GAME_COLORS = ['#FFC93C', '#3E8EDE', '#46B97A', '#FF8A3D', '#8E6BD8', '#FFFFFF'];
const RED = '#F2564B';
const loop = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, -0.5];
const CORN = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

let S, host, panel, offMode, ctxRef, gl, pools, net, picker;

// ———— 3D 展开图 ————
function disposeNet() { stage.clear(); net = null; }

function build(cells, { colors = COLORS, flat = false, name = '' } = {}) {
  disposeNet();
  const has = new Set(cells.map((p) => key(...p)));
  const R = Math.max(...cells.map((p) => p[0])) + 1, C = Math.max(...cells.map((p) => p[1])) + 1;
  const root = pickRoot(cells);
  const loopGeo = new LineGeometry(); loopGeo.setPositions(loop);
  const faces = [], hinges = []; let maxD = 1;
  const planeGeo = new THREE.PlaneGeometry(1, 1); planeGeo.rotateX(-HALF);
  const makeFace = (cell) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(planeGeo, faceMaterial(colors[faces.length % 6], { side: THREE.DoubleSide }));
    m.castShadow = true; g.add(m);
    const l = new Line2(loopGeo, inkMat);
    g.add(l);
    const f = { g, m, l, cell, key: key(...cell), base: new THREE.Color(colors[faces.length % 6]) };
    faces.push(f); return f;
  };
  const rootF = makeFace(root);
  const seen = new Set([key(...root)]);
  const rec = (p, parentF, depth) => {
    for (const [d, dr, dc] of [['N', -1, 0], ['S', 1, 0], ['W', 0, -1], ['E', 0, 1]]) {
      const q = [p[0] + dr, p[1] + dc], k = key(...q);
      if (!has.has(k) || seen.has(k)) continue; seen.add(k);
      const pv = new THREE.Group(); pv.position.set(OFF[d][0], 0, OFF[d][1]);
      const f = makeFace(q); f.g.position.set(OFF[d][0], 0, OFF[d][1]); pv.add(f.g); parentF.g.add(pv);
      const [axis, sign] = AX[d];
      pv.rotation[axis] = flat ? 0 : sign * HALF;
      hinges.push({ pv, axis, sign, depth: depth + 1, cur: flat ? 0 : HALF, from: flat ? 0 : HALF, to: flat ? 0 : HALF, t0: 0, delay: 0 });
      maxD = Math.max(maxD, depth + 1);
      rec(q, f, depth + 1);
    }
  };
  rec(root, rootF, 0);
  const group = new THREE.Group(); group.add(rootF.g); stage.content.add(group);
  net = { group, faces, hinges, maxD, cells, root, open: flat, center: new THREE.Vector3((C - 1) / 2 - root[1], 0, (R - 1) / 2 - root[0]), R, C, name };
  net.byKey = new Map(faces.map((f) => [f.key, f]));
  return net;
}

const closedView = () => ({ target: new THREE.Vector3(0, 0.5, 0), sph: new THREE.Spherical(6.6, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(35)) });
const openView = () => ({ target: net.center.clone(), sph: new THREE.Spherical(5.4 + 0.95 * Math.max(net.R, net.C), THREE.MathUtils.degToRad(14), 0) });
const viewNow = () => (net && net.open ? openView() : closedView());

function setOpen(o, { fly = true } = {}) {
  net.open = o;
  const now = performance.now();
  for (const h of net.hinges) { h.from = h.cur; h.to = o ? 0 : HALF; h.t0 = now; h.delay = (o ? net.maxD - h.depth : h.depth - 1) * dur(STEP); }
  net.anim = true;
  if (fly) stage.flyTo(o ? openView() : closedView(), 1100);
}
const animTime = () => dur(DUR) + dur(STEP) * net.maxD + 120;

function frame(now) {
  if (!net) return;
  for (const h of net.hinges) {
    const t = Math.min(Math.max((now - h.t0 - h.delay) / dur(DUR), 0), 1);
    h.cur = h.from + (h.to - h.from) * ease(t);
    h.pv.rotation[h.axis] = h.sign * h.cur;
  }
  net.group.updateMatrixWorld(true);
  const segs = [];
  for (const f of net.faces) {
    const w = CORN.map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(f.l.matrixWorld));
    for (let i = 0; i < 4; i++) segs.push([w[i], w[(i + 1) % 4]]);
  }
  stage.cornerSegs = segs;
}

// ———— 探索：11 种展开图 ————
function thumb(n, i, extra = '') {
  const R = Math.max(...n.map((p) => p[0])) + 1, C = Math.max(...n.map((p) => p[1])) + 1;
  const has = new Set(n.map((p) => key(...p)));
  let cells = '';
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) cells += `<i style="${has.has(key(r, c)) ? `background:#FFC93C;box-shadow:inset 0 0 0 2px ${INK}` : ''}"></i>`;
  return `<button class="btn th${extra}" data-a="pick" data-i="${i}" aria-label="第${i + 1}种展开图" style="grid-template-columns:repeat(${C},11px)">${cells}</button>`;
}

function showNet(i, openFirst = true) {
  S.i = i;
  clearTimeout(S.t);
  build(NETS[i]);
  const v = closedView(); stage.place(v.target, v.sph);
  render();
  if (openFirst) S.t = setTimeout(() => { if (net) { setOpen(true); render(); } }, 250);
}

function pickNet(i) {
  if (!net) return;
  clearTimeout(S.t);
  if (i === S.i && !net.open) { setOpen(true); render(); return; }
  if (net.open) { setOpen(false); render(); S.t = setTimeout(() => showNet(i), animTime()); }
  else showNet(i);
}

// ———— 小游戏 ————
function newGame() {
  clearTimeout(S.t);
  const ok = Math.random() < 0.5;
  let cells, dups = null;
  if (ok) cells = pick(pools.valid);
  else { const x = pick(pools.invalid); cells = x.cells; dups = x.dups; }
  cells = landscape(cells);
  // landscape 转置后重新算一次，保证显示的图和验证用的是同一份
  const a = analyze(cells, pickRoot(cells));
  S.g = { cells, valid: a.valid, dups: a.dups, folded: false, answered: false };
  const g = S.g;
  build(cells, { colors: GAME_COLORS, flat: true });
  const v = openView(); stage.place(v.target, v.sph);
  net.open = true;
  g.q = null;
  render();
}

function foldGame() {
  const g = S.g; if (!net || g.folded) { return; }
  g.folded = true;
  setOpen(false);
  if (!g.valid) {
    stage.flyTo(viewForPair(g.dups[0]), 1100);
    // 撞在一起的两面：标红，外面那张往外挪一点避免重叠闪烁
    const pair = g.dups[0].map((k) => net.byKey.get(k));
    g.pair = g.dups[0];
    pair.forEach((f) => { f.m.material.color.set(RED); f.m.material.emissive.set(RED).multiplyScalar(0.12); });
    pair[1].m.position.y = -0.045; pair[1].l.position.y = -0.045;
  }
  render();
  S.t = setTimeout(() => { if (S.g === g) { g.done = true; if (!g.valid) showCallout('撞在一起了！'); render(); } }, animTime());
}
// 折好后，镜头转到看得见「撞在一起的那两面」的位置
function viewForPair(pair) {
  const f = net.byKey.get(pair[0]);
  const saved = net.hinges.map((h) => h.pv.rotation[h.axis]);
  net.hinges.forEach((h) => (h.pv.rotation[h.axis] = h.sign * HALF));
  net.group.updateMatrixWorld(true);
  const c = new THREE.Vector3().setFromMatrixPosition(f.m.matrixWorld);
  net.hinges.forEach((h, i) => (h.pv.rotation[h.axis] = saved[i]));
  net.group.updateMatrixWorld(true);
  const d = c.clone().sub(new THREE.Vector3(0, 0.5, 0));
  let phi = 62, theta = Math.atan2(d.x, d.z) + THREE.MathUtils.degToRad(28);
  if (d.y > 0.4) { phi = 38; theta = 0.6; } else if (d.y < -0.4) { phi = 118; theta = 0.6; }
  return { target: new THREE.Vector3(0, 0.5, 0), sph: new THREE.Spherical(6.6, THREE.MathUtils.degToRad(phi), theta) };
}
function unfoldGame() {
  const g = S.g; if (!net || !g.folded) return;
  g.folded = false; g.done = false; clearCallout();
  setOpen(true);
  render();
}
function showCallout(t) { clearCallout(); stage.overlay?.insertAdjacentHTML('beforeend', `<div class="callout" id="co" style="top:64px">${t}</div>`); }
function clearCallout() { host.querySelector('#co')?.remove(); }

function miniNet(g) {
  const R = Math.max(...g.cells.map((p) => p[0])) + 1, C = Math.max(...g.cells.map((p) => p[1])) + 1;
  const has = new Set(g.cells.map((p) => key(...p))), red = new Set(g.valid ? [] : g.dups[0]);
  let h = `<div class="net-mini" style="grid-template-columns:repeat(${C},26px)">`;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const k = key(r, c); h += `<i class="${has.has(k) ? (red.has(k) ? 'r' : '') : 'e'}"></i>`; }
  return h + '</div>';
}

// ———— 画面 ————
const tabs = () => `<div class="tabs"><button class="btn small${S.tab === 'explore' ? ' on' : ''}" data-a="tab-explore">看展开图</button><button class="btn small${S.tab === 'game' ? ' on' : ''}" data-a="tab-game">能折吗？</button></div>`;
const KEYS_E = '<div class="keys"><kbd>空白键</kbd> 展开／合起　<kbd>←</kbd><kbd>→</kbd> 换一种　<kbd>R</kbd> 复位视角</div>';
const KEYS_G = '<div class="keys"><kbd>空白键</kbd> 折折看／下一题　<kbd>R</kbd> 复位视角</div>';

function render() {
  if (!gl) { panel.innerHTML = tabs() + '<div class="readout"><div class="line">3D 画面打不开，这个模块需要 3D。</div></div>'; return; }
  const practice = ctxRef.getMode() === 'practice';
  if (S.tab === 'explore') {
    panel.innerHTML = tabs() + `<div class="readout"><div class="big" style="font-size:40px">第 ${S.i + 1} 种</div><div class="line">共 11 种。${net && net.open ? '展开了！' : '合起来是正方体。'}</div></div>
      <button class="btn s6 red" data-a="fold">${net && net.open ? '合起' : '展开'}</button>
      <div class="picker">${NETS.map((n, i) => thumb(n, i, i === S.i ? ' on' : '')).join('')}</div>
      <div class="sound-note">点小图换一种。拖拽可以旋转，双指／滚轮可以缩放。</div>` + KEYS_E;
    return;
  }
  const g = S.g;
  if (!practice) {
    const res = g.done ? (g.valid ? '<b>能折成正方体！</b>六个面刚刚好。' : '<b>不能折。</b>红色的两个面撞在一起了，正方体还缺一个面。') : '先猜一猜，再按「折折看」。';
    panel.innerHTML = tabs() + `<div class="readout"><div class="q">这个能折成正方体吗？</div><div class="line">${res}</div></div>` + (g.done ? miniNet(g) : '') +
      `<div class="grp6"><button class="btn s6 red" data-a="gfold">${g.folded ? '展开' : '折折看'}</button><button class="btn s6 green" data-a="gnext">下一题 ▶</button></div>` + KEYS_G;
    return;
  }
  // 练习
  panel.innerHTML = tabs() + `<div class="quiz-q">这个能折成正方体吗？</div><div id="opts"></div><div class="fb" id="fb"></div>${g.answered ? miniNet(g) : ''}<button class="btn s6 green" data-a="gnext"${g.answered ? '' : ' style="visibility:hidden"'}>下一题 ▶</button>`;
  const fb = panel.querySelector('#fb');
  const labels = ['能折成正方体', '不能折成正方体'], correct = g.valid ? 0 : 1;
  const m = mountOptions(panel.querySelector('#opts'), labels, correct, 1, (ok, i) => {
    g.answered = true; g.ok = ok; g.picked = i;
    g.fbHTML = (ok ? '<span class="em">答对了！好棒！</span>' : '<span class="em">没关系，再看一看</span>') + (g.valid ? '能折成正方体，六个面刚刚好。' : '不能折：红色的两个面撞在一起了。');
    if (ok) burst(host);
    foldGame();
  });
  if (g.answered) {
    fb.className = 'fb ' + (g.ok ? 'good' : 'try'); fb.innerHTML = g.fbHTML;
    m.btns.forEach((b, i) => { b.disabled = true; if (i === correct) b.classList.add('right'); else if (i === g.picked) b.classList.add('wrong'); });
  } else idleFeedback(fb, '看一看这个图，选一个答案。');
}

function onPanel(e) {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'tab-explore') { S.tab = 'explore'; clearCallout(); showNet(S.i, false); }
  else if (a === 'tab-game') { S.tab = 'game'; newGame(); }
  else if (a === 'fold') { if (net) { setOpen(!net.open); render(); } }
  else if (a === 'pick') pickNet(+b.dataset.i);
  else if (a === 'gfold') (S.g.folded ? unfoldGame() : foldGame());
  else if (a === 'gnext') { clearCallout(); newGame(); }
}

function onKey(e) {
  const teach = ctxRef.getMode() === 'teach';
  if (e.code === 'Space') {
    e.preventDefault(); if (e.type === 'keyup') return;
    if (S.tab === 'explore') { if (net) { setOpen(!net.open); render(); } }
    else if (teach) { if (!S.g.folded) foldGame(); else { clearCallout(); newGame(); } }
    else if (S.g.answered) { clearCallout(); newGame(); }
    return;
  }
  if (e.type !== 'keydown') return;
  if (e.key === 'r' || e.key === 'R') stage.reset();
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && S.tab === 'explore') pickNet((S.i + (e.key === 'ArrowRight' ? 1 : 10)) % 11);
}

export default {
  title: 'M5 展开图',
  ext: true,
  mount(body, ctx) {
    ctxRef = ctx;
    S = { tab: 'explore', i: 0, g: null, t: 0 };
    pools = pools || buildPools();
    body.innerHTML = '<div class="stagecol"><div class="stage" id="host"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel');
    gl = stage.mount(host, { home: viewNow, onFrame: frame }).ok;
    if (gl) host.querySelector('.cv').insertAdjacentHTML('beforeend', '<div class="cap-tag">延伸活动（不在一年级 DSKP 内）</div>');
    net = null;
    if (gl) showNet(0, false);
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { if (S.tab === 'game') newGame(); else render(); });
    render();
    window.__m5 = { S: () => S, pools: () => pools, net: () => net, newGame, foldGame, showNet };
  },
  unmount() {
    clearTimeout(S.t);
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    offMode?.(); net = null;
    stage.unmount(); delete window.__m5;
  },
};
