import { stage, THREE, ease, dur, reducedMotion } from '../core/stage3d.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { COLORS, INK, inkMat, faceMaterial } from '../core/ink.js';
import { mountOptions, idleFeedback, burst, shuffle, pick, renderQuiz } from '../core/quiz.js';
import { COLOR_NAMES } from '../core/flat.js';
import { keysHTML, toggleKeys } from '../core/keys.js';
import { NETS, key, analyze, pickRoot, buildPools, landscape, normalize } from './netlogic.js';
import { enumerateNets, makePoly, cubeClassOf } from './netgeo.js';
import { buildPolyNet, buildCylinderNet, buildConeNet, netBounds, CONE, CYL } from './netbuild.js';

const HALF = Math.PI / 2, DUR = 750, STEP = 230;
const OFF = { N: [0, -0.5], S: [0, 0.5], W: [-0.5, 0], E: [0.5, 0] };
const AX = { N: ['x', 1], S: ['x', -1], E: ['z', 1], W: ['z', -1] };
const GAME_COLORS = ['#FFC93C', '#3E8EDE', '#46B97A', '#FF8A3D', '#8E6BD8', '#FFFFFF'];
const RED = '#F2564B';
const loop = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, -0.5];
const CORN = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

let S, host, panel, offMode, ctxRef, gl, pools, net, picker, solidBar, G = null, netSets = null;

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
const openView = () => ({ target: net.center.clone(), sph: new THREE.Spherical(5.4 + 0.95 * Math.max(net.R, net.C), THREE.MathUtils.degToRad(3), 0) });
const viewNow = () => (S.solid !== 'cube' ? gView(G && G.to < 0.5) : net && net.open ? openView() : closedView());

function setOpen(o, { fly = true } = {}) {
  net.open = o;
  const now = performance.now();
  for (const h of net.hinges) { h.from = h.cur; h.to = o ? 0 : HALF; h.t0 = now; h.delay = (o ? net.maxD - h.depth : h.depth - 1) * dur(STEP); }
  net.anim = true;
  if (fly) stage.flyTo(o ? openView() : closedView(), 1100);
}
const animTime = () => dur(DUR) + dur(STEP) * net.maxD + 120;

function frame(now) {
  if (S.solid !== 'cube') return gframe(now);
  if (!net) return;
  { const mv = net.hinges.some((h) => Math.abs(h.cur - h.to) > 1e-3 || now - h.t0 - h.delay < dur(DUR)); if (net._mv && !mv && S.tab === 'explore') { net._mv = false; render(); } net._mv = net._mv || mv; }
  for (const h of net.hinges) {
    const t = Math.min(Math.max((now - h.t0 - h.delay) / dur(DUR), 0), 1);
    h.cur = h.from + (h.to - h.from) * ease(t);
    h.pv.rotation[h.axis] = h.sign * h.cur;
  }
  if (net.shake && !reducedMotion()) {
    const t = (now - net.shake.t0) / 600, k = t < 0 || t > 1 ? 0 : Math.sin(t * Math.PI * 6) * (1 - t) * 0.07;
    net.shake.faces.forEach((f, i) => { const x = i === 0 ? k : -k; f.m.position.x = x; f.l.position.x = x; });
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
  if (!g.valid) { const d = collidingPairs(); if (d.length) g.dups = d; }
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
    stage.flyTo(viewFor(g.dups[0]), 1100);
    // 撞面：标红、半透明，微微错开 0.04，折好后抖动一次
    const pair = g.dups[0].map((k) => net.byKey.get(k));
    g.pair = g.dups[0];
    pair.forEach((f, i) => {
      const m = f.m.material;
      m.color.set(RED); m.emissive.set(RED).multiplyScalar(0.12); m.transparent = true; m.opacity = 0.6; m.depthWrite = false; m.needsUpdate = true;
      const y = i === 0 ? 0.02 : -0.02; f.m.position.y = y; f.l.position.y = y;
    });
    net.shake = { t0: performance.now() + animTime(), faces: pair };
  }
  render();
  S.t = setTimeout(() => { if (S.g === g) { g.done = true; if (!g.valid) showCallout('撞在一起了！'); render(); } }, animTime());
}
// 实际折叠（所有铰链转到 90°）后，每个面的中心位置
function foldedCenters() {
  const saved = net.hinges.map((h) => h.pv.rotation[h.axis]);
  net.hinges.forEach((h) => (h.pv.rotation[h.axis] = h.sign * HALF));
  net.group.updateMatrixWorld(true);
  const out = net.faces.map((f) => ({ key: f.key, c: new THREE.Vector3().setFromMatrixPosition(f.m.matrixWorld).sub(new THREE.Vector3(0, 0.5, 0)) }));
  net.hinges.forEach((h, i) => (h.pv.rotation[h.axis] = saved[i]));
  net.group.updateMatrixWorld(true);
  return out;
}
// 撞面判定：折好后中心重合的面
function collidingPairs() {
  const by = new Map();
  for (const { key: k, c } of foldedCenters()) { const id = [c.x, c.y, c.z].map((v) => Math.round(v * 20)).join(','); by.set(id, [...(by.get(id) || []), k]); }
  return [...by.values()].filter((g) => g.length > 1);
}
// 折好后，镜头转到同时看得见「撞在一起的两面」和「缺的那一面开口」的位置
function viewFor(pair) {
  const cs = foldedCenters();
  const dir = (c) => new THREE.Vector3(Math.round(c.x * 2) / 1, Math.round(c.y * 2) / 1, Math.round(c.z * 2) / 1).normalize();
  const dp = dir(cs.find((x) => x.key === pair[0]).c);
  const occ = new Set(cs.map((x) => { const d = dir(x.c); return d.x.toFixed(1) + ',' + d.y.toFixed(1) + ',' + d.z.toFixed(1); }));
  const six = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((a) => new THREE.Vector3(...a));
  const missing = six.find((d) => !occ.has(d.x.toFixed(1) + ',' + d.y.toFixed(1) + ',' + d.z.toFixed(1)));
  let v = dp.clone();
  if (missing) v.add(missing);
  if (v.length() < 0.2) v = Math.abs(dp.y) > 0.5 ? new THREE.Vector3(1, 0.5 * Math.sign(dp.y), 1) : new THREE.Vector3(-dp.z, 0.5, dp.x);
  v.normalize();
  let phi = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)));
  phi = Math.min(Math.max(phi, 48), 112);
  return { target: new THREE.Vector3(0, 0.5, 0), sph: new THREE.Spherical(6.8, THREE.MathUtils.degToRad(phi), Math.atan2(v.x, v.z) + 0.42) };
}
function unfoldGame() {
  const g = S.g; if (!net || !g.folded) return;
  g.folded = false; g.done = false; clearCallout();
  setOpen(true);
  render();
}
function showCallout(t) { clearCallout(); stage.overlay?.insertAdjacentHTML('beforeend', `<div class="callout" id="co">${t}</div>`); }
function clearCallout() { host.querySelector('#co')?.remove(); }

function miniNet(g) {
  const R = Math.max(...g.cells.map((p) => p[0])) + 1, C = Math.max(...g.cells.map((p) => p[1])) + 1;
  const has = new Set(g.cells.map((p) => key(...p))), red = new Set(g.valid ? [] : g.dups[0]);
  let h = `<div class="net-mini" style="grid-template-columns:repeat(${C},26px)">`;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const k = key(r, c); h += `<i class="${has.has(k) ? (red.has(k) ? 'r' : '') : 'e'}"></i>`; }
  return h + '</div>';
}

// ———— 画面 ————
const tabs = () => `<div class="tabs grid g3"><button class="btn small${S.tab === 'explore' ? ' on' : ''}" data-a="tab-explore">看展开图</button><button class="btn small${S.tab === 'game' ? ' on' : ''}" data-a="tab-game">能折吗？</button><button class="btn small${S.tab === 'chal' ? ' on' : ''}" data-a="tab-chal">小挑战</button></div>`;

// ———— 小挑战：某个颜色的面，折起来以后对面是什么颜色？（答案由「滚动法」算出，再用折叠后面中心的位置核对）————
const OPP = { 0: 1, 1: 0, 2: 3, 3: 2, 4: 5, 5: 4 };
function newChal() {
  clearTimeout(S.t);
  const cells = landscape(pick(pools.valid)), a = analyze(cells, pickRoot(cells));
  build(cells, { colors: COLORS, flat: true });
  const v = openView(); stage.place(v.target, v.sph); net.open = true;
  const keys = cells.map((c) => key(...c)), target = pick(keys);
  const oppKey = keys.find((k) => a.faceOf.get(k) === OPP[a.faceOf.get(target)]);
  const hex = (k) => '#' + net.byKey.get(k).base.getHexString().toUpperCase();
  // 核对：折好之后，对面两个面的中心恰好在立方体中心的两侧
  const cs = foldedCenters(), ct = cs.find((x) => x.key === target).c;
  const opp2 = cs.find((x) => x.c.distanceTo(ct.clone().negate()) < 0.05)?.key;
  const ans = hex(oppKey), tgt = hex(target);
  const others = shuffle(COLORS.filter((c) => c.toUpperCase() !== ans && c.toUpperCase() !== tgt)).slice(0, 2);
  const opts = shuffle([ans, ...others]);
  const nm = (h) => COLOR_NAMES[Object.keys(COLOR_NAMES).find((k) => k.toUpperCase() === h.toUpperCase())];
  S.ch = { cells, target, oppKey, answer: ans, targetColor: tgt, verified: opp2 === oppKey, shown: false, nm,
    q: { title: `${nm(tgt)}的面，折起来以后，它的对面是什么颜色？`, labels: opts.map(nm), correct: opts.indexOf(ans), cols: 3, goodMsg: `对面是${nm(ans)}。`, badMsg: `正确答案是${nm(ans)}。看，折起来就知道了。`, onDone: () => { chalReveal(); } } };
}
function chalReveal() {
  if (!S.ch || S.ch.folded) return; S.ch.folded = true; S.ch.shown = true;
  setOpen(false);
  [S.ch.target, S.ch.oppKey].forEach((k) => { const f = net.byKey.get(k); f.m.material.emissive.copy(f.base).multiplyScalar(0.35); });
}
function renderChal(practice) {
  if (!S.ch) newChal();
  const c = S.ch;
  if (!practice) {
    panel.innerHTML = tabs() + `<div class="readout"><div class="q">${c.q.title}</div><div class="line">${c.shown ? `<b>答案：${c.nm(c.answer)}</b>` : '想一想，再按「折折看」。'}</div></div><div class="grp6"><button class="btn s6 red" data-a="chfold">${c.folded ? '展开' : '折折看'}</button><button class="btn s6 green" data-a="chnext">换一题 ▶</button></div>` + KEYS_G();
  } else {
    panel.innerHTML = tabs() + '<div id="qbox" class="qbox"></div>';
    renderQuiz(panel.querySelector('#qbox'), c.q, { next: () => { clearCallout(); S.ch = null; render(); }, burstHost: host });
  }
}
const KEYS_E = () => keysHTML([['<kbd>空白键</kbd>', '展开／合起'], ['<kbd>←</kbd><kbd>→</kbd>', '换一种'], ['<kbd>R</kbd>', '复位视角']]);
const KEYS_G = () => keysHTML([['<kbd>空白键</kbd>', '折折看／下一题'], ['<kbd>R</kbd>', '复位视角']]);

const cubeBusy = () => !!net && net.hinges.some((h) => Math.abs(h.cur - h.to) > 1e-3);
const cubeState = () => (cubeBusy() ? (net.open ? '正在展开…' : '正在合起…') : net && net.open ? '展开了！' : '合起来是正方体。');
function render() {
  if (S.solid !== 'cube') return renderGeneric();
  if (!gl) { panel.innerHTML = tabs() + '<div class="readout"><div class="line">3D 画面打不开，这个模块需要 3D。</div></div>'; return; }
  const practice = ctxRef.getMode() === 'practice';
  if (S.tab === 'explore') {
    panel.innerHTML = tabs() + `<div class="readout"><div class="big" style="font-size:40px">第 ${S.i + 1} 种</div><div class="line">共 11 种。${cubeState()}</div></div>
      <button class="btn s6 red" data-a="fold"${cubeBusy() ? ' disabled' : ''}>${cubeBusy() ? (net.open ? '正在展开…' : '正在合起…') : net && net.open ? '合起' : '展开'}</button>
      <div class="picker">${NETS.map((n, i) => thumb(n, i, i === S.i ? ' on' : '')).join('')}</div>
      <div class="sound-note">点小图换一种。拖拽可以旋转，双指／滚轮可以缩放。</div>` + KEYS_E();
    return;
  }
  if (S.tab === 'chal') return renderChal(practice);
  const g = S.g;
  if (!practice) {
    const res = g.done ? (g.valid ? '<b>能折成正方体！</b>六个面刚刚好。' : '<b>不能折。</b>红色的两个面撞在一起了，正方体还缺一个面。') : '先猜一猜，再按「折折看」。';
    panel.innerHTML = tabs() + `<div class="readout"><div class="q">这个能折成正方体吗？</div><div class="line">${res}</div></div>` + (g.done ? miniNet(g) : '') +
      `<div class="grp6"><button class="btn s6 red" data-a="gfold">${g.folded ? '展开' : '折折看'}</button><button class="btn s6 green" data-a="gnext">下一题 ▶</button></div>` + KEYS_G();
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


// ═══════════ 其他 4 种立体：长方体、正方棱锥体、圆柱体、圆锥体 ═══════════
const SOLIDS = [['cube', '正方体'], ['cuboid', '长方体'], ['pyramid', '正方棱锥体'], ['cylinder', '圆柱体'], ['cone', '圆锥体']];
const SNAME5 = Object.fromEntries(SOLIDS);
function buildSolidBar() {
  solidBar.innerHTML = SOLIDS.map(([id, t]) => `<button type="button" class="btn small" data-solid="${id}">${t}</button>`).join('');
  solidBar.onclick = (e) => { const b = e.target.closest('[data-solid]'); if (b) selectSolid(b.dataset.solid); };
  syncSolidBar();
}
const syncSolidBar = () => solidBar?.querySelectorAll('[data-solid]').forEach((b) => b.classList.toggle('on', b.dataset.solid === S.solid));

// 展开图列表：长方体＝每一类（共 11 类）各取一种；正方棱锥体＝全部 8 种
function getNetSets() {
  if (netSets) return netSets;
  const cube = makePoly('cube'), out = {};
  const area = (n) => { const b = netBounds(n.net.faces.map((f) => f.poly)); return b.w * b.h; };
  {
    const e = enumerateNets('cuboid'), byClass = new Map();
    e.nets.forEach((n) => { const c = cubeClassOf(cube, n.trees[0]); (byClass.get(c) || byClass.set(c, []).get(c)).push(n); });
    const picks = [...byClass.values()].map((list) => list.sort((a, b) => area(a) - area(b))[0]);
    out.cuboid = { P: e.P, stats: e.stats, classes: byClass.size, list: picks.sort((a, b) => area(a) - area(b)) };
  }
  {
    const e = enumerateNets('pyramid');
    const deg = (n) => n.net.faces.filter((f) => f.parent === 0).length;
    out.pyramid = { P: e.P, stats: e.stats, classes: e.nets.length, list: e.nets.sort((a, b) => deg(b) - deg(a) || a.key.localeCompare(b.key)) };
  }
  netSets = out; return out;
}
function solidCenterOf(P, net) { const pts = P.verts.map((v) => net.T(v)); const b = new THREE.Box3().setFromPoints(pts); return b.getCenter(new THREE.Vector3()); }
function makeObj(solid, vi) {
  if (solid === 'cylinder') return buildCylinderNet();
  if (solid === 'cone') return buildConeNet();
  const set = getNetSets()[solid], item = set.list[vi % set.list.length];
  item.net.solidCenter = solidCenterOf(set.P, item.net);
  const cols = solid === 'pyramid' ? [COLORS[5], COLORS[0], COLORS[1], COLORS[2], COLORS[3]] : COLORS;
  return buildPolyNet(item.net, cols);
}
const variants = (solid) => (solid === 'cuboid' || solid === 'pyramid' ? getNetSets()[solid].list.length : 1);
function gView(open) {
  const b = G.obj.bounds;
  if (open) return { target: new THREE.Vector3(b.cu, 0, b.cv), sph: new THREE.Spherical(5.2 + 1.0 * Math.max(b.w, b.h * 0.9), THREE.MathUtils.degToRad(3), 0) };
  const c = G.obj.solidCenter;
  return { target: c.clone(), sph: new THREE.Spherical(6.4 + (G.obj.kind === 'cone' || G.obj.kind === 'cyl' ? 0.4 : 0), THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(35)) };
}
function selectSolid(id, vi = 0, { openFirst = true } = {}) {
  clearTimeout(S.t); clearCallout?.();
  S.solid = id; S.vi = vi; S.gq = null; syncSolidBar();
  if (id === 'cube') { net = null; G = null; S.tab = S.tab || 'explore'; if (gl) { stage.clear(); stage.cornerSegs = []; stage.setHome(viewNow); showNet(S.i, false); } render(); return; }
  if (!gl) { render(); return; }
  stage.clear(); stage.cornerSegs = []; net = null; stage.fly = null; stage.controls.enabled = true;
  const obj = makeObj(id, vi); stage.content.add(obj.group);
  G = { obj, p: 1, from: 1, to: 1, t0: 0, ms: 1000 };
  obj.setP(1);
  stage.setHome(viewNow);
  const v = gView(false); stage.place(v.target, v.sph);
  render();
  if (openFirst) S.t = setTimeout(() => { if (G && G.obj === obj) { gOpen(); render(); } }, 250);
}
const gMs = () => (G.obj.kind === 'poly' ? 1100 + 330 * 3 : 2400);
function gSetP(p) { G.p = p; G.from = G.to = p; G.obj.setP(p); render(); }
function gOpen() { G.from = G.p; G.to = 0; G.t0 = performance.now(); G.ms = dur(gMs()) * G.p; stage.flyTo(gView(true), 1100); render(); }
function gClose() { G.from = G.p; G.to = 1; G.t0 = performance.now(); G.ms = dur(gMs()) * (1 - G.p); stage.flyTo(gView(false), 1100); render(); }
// 实际状态（给右边的文字和按钮用）：动画中＝正在展开／正在合起；停住时看 p
function gState() {
  if (!G) return { k: 'closed', text: '合起来了', btn: '展开', busy: false };
  if (G.p !== G.to) return G.to < 0.5 ? { k: 'opening', text: '正在展开…', btn: '正在展开…', busy: true } : { k: 'closing', text: '正在合起…', btn: '正在合起…', busy: true };
  if (G.p < 0.01) return { k: 'open', text: '展开了', btn: '合起', busy: false };
  if (G.p > 0.99) return { k: 'closed', text: '合起来了', btn: '展开', busy: false };
  return { k: 'half', text: '半开着', btn: '合起', busy: false };
}
function gframe(now) {
  if (!G) return;
  if (G.p !== G.to) {
    const t = G.ms <= 0 ? 1 : Math.min(1, Math.max(0, (now - G.t0) / G.ms));
    G.p = G.from + (G.to - G.from) * t; G.obj.setP(G.p);
    if (t >= 1) { G.p = G.to; G.obj.setP(G.p); render(); }
  }
  G.obj.update(stage.camera);
  stage.cornerSegs = G.obj.segs();
  // 卷曲的圆柱／圆锥：只在合起来时有圆形接触阴影，跟立体图形页一样
  if (G.obj.foot) stage.setFootprint(G.obj.foot, G.obj.foot, Math.max(0, (G.p - 0.55) / 0.45));
}
const gIsOpen = () => G && G.to < 0.5;
function thumbSVG(item, solid, on) {
  const polys = item.net.faces.map((f) => f.poly), b = netBounds(polys), sc = Math.min(66 / b.w, 52 / b.h);
  const cols = solid === 'pyramid' ? [COLORS[5], COLORS[0], COLORS[1], COLORS[2], COLORS[3]] : COLORS;
  const g = item.net.faces.map((f) => `<polygon points="${f.poly.map(([u, v]) => `${((u - b.cu) * sc).toFixed(1)},${((v - b.cv) * sc).toFixed(1)}`).join(' ')}" fill="${cols[f.id % 6]}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="miter"/>`).join('');
  return `<svg viewBox="-36 -30 72 60" width="72" height="60" aria-hidden="true">${g}</svg>`;
}
function renderGeneric() {
  syncSolidBar();
  if (!gl) { panel.innerHTML = '<div class="readout"><div class="line">3D 画面打不开，这个模块需要 3D。</div></div>'; return; }
  const id = S.solid, name = SNAME5[id], practice = ctxRef.getMode() === 'practice', st = gState();
  const nv = variants(id), set = nv > 1 ? getNetSets()[id] : null;
  let note = '';
  if (id === 'cylinder') note = '两个圆形加一个长方形：长方形的长＝圆的一圈。';
  else if (id === 'cone') note = '一个圆形加一个扇形：扇形的弧长＝圆的一圈。';
  else note = '点小图换一种。拖拽可以旋转，双指／滚轮可以缩放。';
  let h = `<div class="readout"><div class="big" style="font-size:40px">${name}</div><div class="line">${nv > 1 ? `第 ${S.vi + 1} / ${nv} 种` : '展开图'} · ${st.text}</div></div>` +
    `<button class="btn s6 red" data-a="gfold"${st.busy ? ' disabled' : ''}>${st.btn}</button>`;
  if (set) h += `<div class="picker">${set.list.map((it, i) => `<button class="btn th${i === S.vi ? ' on' : ''}" data-a="gvar" data-i="${i}" aria-label="第${i + 1}种展开图" style="padding:3px">${thumbSVG(it, id)}</button>`).join('')}</div>`;
  h += `<div class="sound-note">${note}</div>`;
  if (practice) {
    if (!S.gq) { const others = shuffle(SOLIDS.filter(([x]) => x !== id)).slice(0, 2), opts = shuffle([[id, name], ...others]); S.gq = { title: '这个展开图折起来是什么立体？', labels: opts.map((x) => x[1]), correct: opts.findIndex((x) => x[0] === id), cols: 1, goodMsg: `是${name}。`, badMsg: `是${name}。折起来看看。`, onDone: () => { if (G && gIsOpen()) { gClose(); } } }; }
    panel.innerHTML = h + '<div id="gqbox" class="qbox"></div>';
    renderQuiz(panel.querySelector('#gqbox'), S.gq, { next: () => { S.gq = null; if (G && gState().k === 'closed') gOpen(); else render(); }, burstHost: host });
  } else panel.innerHTML = h + KEYS_E();
}
function genericAction(a, b) {
  if (a === 'keys') { toggleKeys(); render(); return true; }
  if (a === 'gfold') { if (G && !gState().busy) (gState().k === 'closed' ? gOpen() : gClose()); return true; }
  if (a === 'gvar') { selectSolid(S.solid, +b.dataset.i); return true; }
  return false;
}
function genericKey(e) {
  if (e.code === 'Space') { e.preventDefault(); if (e.type === 'keyup' || !G || gState().busy) return; (gState().k === 'closed' ? gOpen() : gClose()); return; }
  if (e.type !== 'keydown') return;
  if (e.key === 'r' || e.key === 'R') stage.reset();
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && variants(S.solid) > 1) { const n = variants(S.solid); selectSolid(S.solid, (S.vi + (e.key === 'ArrowRight' ? 1 : n - 1)) % n); }
}

function onPanel(e) {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (S.solid !== 'cube' && genericAction(a, b)) return;
  if (a === 'keys') { toggleKeys(); render(); }
  else if (a === 'tab-explore') { S.tab = 'explore'; clearCallout(); showNet(S.i, false); }
  else if (a === 'tab-game') { S.tab = 'game'; newGame(); }
  else if (a === 'tab-chal') { S.tab = 'chal'; S.ch = null; render(); }
  else if (a === 'chfold') { if (S.ch.folded) { S.ch.folded = false; S.ch.shown = false; setOpen(true); net.faces.forEach((f) => f.m.material.emissive.setScalar(0)); render(); } else { chalReveal(); render(); } }
  else if (a === 'chnext') { S.ch = null; render(); }
  else if (a === 'fold') { if (net) { setOpen(!net.open); render(); } }
  else if (a === 'pick') pickNet(+b.dataset.i);
  else if (a === 'gfold') (S.g.folded ? unfoldGame() : foldGame());
  else if (a === 'gnext') { clearCallout(); newGame(); }
}

function onKey(e) {
  const teach = ctxRef.getMode() === 'teach';
  if (S.solid !== 'cube') { genericKey(e); return; }
  if (e.code === 'Space') {
    e.preventDefault(); if (e.type === 'keyup') return;
    if (S.tab === 'explore') { if (net) { setOpen(!net.open); render(); } }
    else if (S.tab === 'chal') { if (!teach) return; if (!S.ch.folded) { chalReveal(); render(); } else { S.ch = null; render(); } }
    else if (teach) { if (!S.g.folded) foldGame(); else { clearCallout(); newGame(); } }
    else if (S.g.answered) { clearCallout(); newGame(); }
    return;
  }
  if (e.type !== 'keydown') return;
  if (e.key === 'r' || e.key === 'R') stage.reset();
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && S.tab === 'explore') pickNet((S.i + (e.key === 'ArrowRight' ? 1 : 10)) % 11);
}

export default {
  title: '展开图',
  badge: '延伸',
  mount(body, ctx) {
    ctxRef = ctx;
    S = { tab: 'explore', i: 0, g: null, t: 0, solid: 'cube', vi: 0, gq: null };
    G = null;
    pools = pools || buildPools();
    body.innerHTML = '<div class="stagecol"><div class="stage" id="host"></div><div class="solidbar" id="solidbar"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel'); solidBar = body.querySelector('#solidbar');
    buildSolidBar();
    gl = stage.mount(host, { home: viewNow, onFrame: frame }).ok;
    net = null;
    if (gl) showNet(0, false);
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { S.ch = null; S.gq = null; if (S.solid !== 'cube') render(); else if (S.tab === 'game') newGame(); else render(); });
    render();
    window.__m5 = { newChal, S: () => S, pools: () => pools, net: () => net, newGame, foldGame, showNet, G: () => G, selectSolid, netSets: () => netSets, gSetP, gOpen, gClose, gView };
  },
  unmount() {
    clearTimeout(S.t); G = null;
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    offMode?.(); net = null;
    stage.unmount(); delete window.__m5;
  },
};
