// M3 模式排列（7.1／7.2「依规律排列」）：平面＋立体，题目由程式生成，用程式保证答案唯一
import { stage, THREE } from '../core/stage3d.js';
import { flatSVG, FLAT, PAL } from '../core/flat.js';
import { shuffle, pick, burst, idleFeedback } from '../core/quiz.js';
import { buildShape, setMono, worldSegs } from './shapes.js';
import { keysHTML, toggleKeys } from '../core/keys.js';

const rad = THREE.MathUtils.degToRad;
const PATTERNS = { ABAB: 'AB', AAB: 'AAB', ABB: 'ABB', ABC: 'ABC', AABB: 'AABB' };
// 第三轮（SPEC §8-4）：规律只由「形状不同」构成。同一题所有图形颜色、大小、方向都一样，颜色每题随机换。
const FIXED_SIZE = 2, FIXED_DIR = 0;
const PLANE_SHAPES = ['square', 'rect', 'tri', 'circle'], SOLID_SHAPES = ['cube', 'cuboid', 'pyramid', 'cone', 'cylinder', 'sphere'];
// 形状相似的一组：放在同一题里更难
const SIMILAR = { plane: [['square', 'rect']], solid: [['cube', 'cuboid'], ['cone', 'pyramid']] };
const SIZES = [0.62, 0.8, 1];
const PITCH = 1.85, SC = 0.56; // 立体排列的间距、立体统一缩放
// 立体一行排：正交相机（远近一样大），所有立体站在同一条底线上，同一种立体在每个位置看起来完全一样
const AZ = (28 * Math.PI) / 180, PHI = (66 * Math.PI) / 180;
const VIEW = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, PHI, AZ));
const RIGHT = new THREE.Vector3(Math.cos(AZ), 0, -Math.sin(AZ)), FWD = new THREE.Vector3(Math.sin(AZ), 0, Math.cos(AZ));
const SH = 0.76; // 底线放在立体底面最前面的位置
const MIN_CELL = 50; // 每格至少这么宽（像素），放不下就减少显示个数
const SNAME = { square: '正方形', circle: '圆形', tri: '三角形', rect: '长方形', cube: '正方体', cuboid: '长方体', pyramid: '正方棱锥体', sphere: '球体', cone: '圆锥体', cylinder: '圆柱体' };
const CNAME = { '#F2564B': '红色', '#FFC93C': '黄色', '#3E8EDE': '蓝色', '#46B97A': '绿色', '#FF8A3D': '橙色', '#8E6BD8': '紫色' };
const TYPE_NAME = { shape: '形状' };
const K = [['<kbd>空白键</kbd>', '揭晓／下一题'], ['<kbd>R</kbd>', '复位视角']];

let S, host, panel, seqEl, gl, ctxRef, offMode, objs = [], ovs = [], ro;

// ———— 题目生成与唯一性 ————
export const itemKey = (it) => `${it.shape}|${it.color}|${it.size}|${it.dir}`;
const pool = (kind) => (kind === 'plane' ? PLANE_SHAPES : SOLID_SHAPES);
const simPair = (kind, a, b) => SIMILAR[kind].some((g) => g.includes(a) && g.includes(b));
const hasSimilar = (kind, list) => list.some((a, i) => list.some((b, j) => j > i && simPair(kind, a, b)));

// 唯一性：把已显示的数列当作「周期性重复」来检查。凡是「至少完整出现两次」的周期 p，
// 它们对下一个的预测必须完全一致，且至少要有一个这样的周期；否则这题有歧义，不能出。
export function nextPredictions(keys) {
  const n = keys.length, preds = new Set(), fits = [];
  for (let p = 1; p * 2 <= n; p++) {
    let ok = true;
    for (let i = p; i < n; i++) if (keys[i] !== keys[i - p]) { ok = false; break; }
    if (ok) { fits.push(p); preds.add(keys[n - p]); }
  }
  return { fits, preds: [...preds] };
}
export function isUnique(keys) { const r = nextPredictions(keys); return r.fits.length > 0 && r.preds.length === 1; }
export const minPeriod = (keys) => nextPredictions(keys).fits[0] || 0;

// 选 nsym 个不同的形状。level 1：不放相似形状；level 3：一定放一对相似形状；level 2：随便。
function pickShapes(kind, nsym, level) {
  const all = pool(kind);
  for (let t = 0; t < 60; t++) {
    let ch;
    if (level === 3 && nsym >= 2) {
      const g = shuffle(pick(SIMILAR[kind])).slice(0, 2);
      ch = [...g, ...shuffle(all.filter((x) => !g.includes(x))).slice(0, nsym - 2)];
    } else ch = shuffle(all).slice(0, nsym);
    const sim = hasSimilar(kind, ch);
    if (level === 1 && sim) continue;
    if (level === 3 && !sim) continue;
    return shuffle(ch);
  }
  return null;
}
const mkItem = (shape, color) => ({ shape, color, size: FIXED_SIZE, dir: FIXED_DIR });

function makeOptions(kind, level, answer, syms, color) {
  // 选项：答案＋另一个符号＋一个别的形状（level 3 优先放相似的）
  const opts = [answer, ...syms.filter((it) => it.shape !== answer.shape)];
  const pl = pool(kind);
  const sims = pl.filter((x) => x !== answer.shape && simPair(kind, x, answer.shape));
  for (let t = 0; t < 80 && opts.length < 3; t++) {
    const sh = level === 3 && sims.length && Math.random() < 0.7 ? pick(sims) : pick(pl);
    if (!opts.some((o) => o.shape === sh)) opts.push(mkItem(sh, color));
  }
  return opts.slice(0, 3);
}

export function genQuestion(kind, level, maxCells = 10) {
  const pats = level === 1 ? ['ABAB', 'AAB', 'ABB'] : ['ABAB', 'AAB', 'ABB', 'ABC', 'AABB'];
  for (let tries = 0; tries < 400; tries++) {
    const pat = pick(pats), unit = PATTERNS[pat], L = unit.length, letters = [...new Set(unit)].sort();
    const shapes = pickShapes(kind, letters.length, level); if (!shapes) continue;
    const color = pick(PAL);
    const syms = shapes.map((sh) => mkItem(sh, color));
    const sym = (ch) => syms[letters.indexOf(ch)];
    // 长度：level 1 最短；level 2 中等；level 3 更长
    const maxN = Math.min(9, maxCells - 1); // 只排一行：放得下才出（「？」也占一格）
    const hi = Math.min(level === 1 ? 2 * L + 1 : level === 2 ? Math.max(2 * L, 7) : 9, maxN);
    if (hi < 2 * L) continue;
    const lo = Math.min(level === 3 ? 2 * L + 1 : 2 * L, hi);
    const ns = []; for (let n = lo; n <= hi; n++) ns.push(n);
    if (!ns.length) continue;
    const n = pick(ns);
    const full = []; for (let i = 0; i <= n; i++) full.push({ ...sym(unit[i % L]) });
    const shown = full.slice(0, n), answer = full[n];
    const keys = shown.map(itemKey);
    if (!isUnique(keys)) continue;
    if (nextPredictions(keys).preds[0] !== itemKey(answer)) continue;
    const opts = makeOptions(kind, level, answer, syms, color);
    if (opts.length < 3) continue;
    return { kind, level, type: 'shape', pat, unit, n, shown, answer, options: shuffle(opts), uniqueOK: true, keys };
  }
  return null;
}

// 自动核对一道题：图形只差在形状；答案唯一且在选项里；选项互不相同；难度条件成立。返回错误列表（空＝通过）
export function checkQuestion(q) {
  const err = [], all = [...q.shown, q.answer, ...q.options];
  if (new Set(all.map((x) => x.color)).size !== 1) err.push('颜色不一致');
  if (new Set(all.map((x) => x.size)).size !== 1) err.push('大小不一致');
  if (new Set(all.map((x) => x.dir)).size !== 1) err.push('方向不一致');
  const keys = q.shown.map(itemKey), pr = nextPredictions(keys);
  if (!(pr.fits.length > 0 && pr.preds.length === 1)) err.push('答案不唯一');
  if (pr.preds[0] !== itemKey(q.answer)) err.push('预测与答案不同');
  if (new Set(q.options.map(itemKey)).size !== q.options.length) err.push('选项重复');
  if (q.options.filter((o) => itemKey(o) === itemKey(q.answer)).length !== 1) err.push('选项里答案不是恰好一个');
  if (q.options.filter((o) => itemKey(o) === pr.preds[0]).length !== 1) err.push('预测答案不在选项里');
  // 规律本身：按 unit 重建，形状必须一致
  const letters = [...new Set(q.unit)].sort(), map = {};
  q.shown.forEach((it, i) => { const c = q.unit[i % q.unit.length]; if (map[c] && map[c] !== it.shape) err.push('规律不符'); map[c] = it.shape; });
  if (new Set(letters.map((c) => map[c])).size !== letters.length) err.push('不同符号用了同一形状');
  const shapesUsed = [...new Set(q.shown.map((x) => x.shape))];
  if (q.level === 1 && hasSimilar(q.kind, shapesUsed)) err.push('level1 出现相似形状');
  if (q.level === 3 && !hasSimilar(q.kind, shapesUsed)) err.push('level3 没有相似形状');
  if (q.shown.length < 2 * q.unit.length) err.push('规律没出现两遍');
  return err;
}

// ———— 小挑战：第 8 个是什么 ————
export function genChallenge() {
  for (let t = 0; t < 400; t++) {
    const pat = pick(['ABAB', 'AAB', 'ABB', 'ABC']);
    const unit = PATTERNS[pat], L = unit.length, letters = [...new Set(unit)].sort();
    const shapes = pickShapes('plane', letters.length, 2); if (!shapes) continue;
    const color = pick(PAL), syms = shapes.map((sh) => mkItem(sh, color));
    const sym = (ch) => syms[letters.indexOf(ch)];
    const all = []; for (let i = 0; i < 8; i++) all.push({ ...sym(unit[i % L]) });
    const shown = all.slice(0, 6), answer = all[7];
    if (!isUnique(shown.map(itemKey))) continue;
    const opts = makeOptions('plane', 2, answer, syms, color);
    if (opts.length < 3) continue;
    return { pat, unit, type: 'shape', shown, answer, options: shuffle(opts), all };
  }
}
// 自动检查：只看画面上显示的 6 个，自己找出周期，推出第 8 个，必须与出题时的答案一致；并检查只差形状、选项合理
export function checkChallenge(ch) {
  const keys = ch.shown.map(itemKey), p = minPeriod(keys);
  if (!p) return false;
  const eighth = keys[7 % p];
  const all = [...ch.shown, ch.answer, ...ch.options];
  const same = new Set(all.map((x) => x.color)).size === 1 && new Set(all.map((x) => x.size)).size === 1 && new Set(all.map((x) => x.dir)).size === 1;
  return same && eighth === itemKey(ch.answer) && new Set(ch.options.map(itemKey)).size === ch.options.length && ch.options.some((o) => itemKey(o) === itemKey(ch.answer));
}

// ———— 平面图形的画法 ————
const fid = (s) => (s === 'triangle' ? 'tri' : s);
function planeIcon(it, size = 56) {
  const id = fid(it.shape), rot = 0;
  return `<svg viewBox="-60 -60 120 120" width="${size}" height="${size}" aria-hidden="true">${flatSVG(id, { k: 40 * SIZES[it.size], color: it.color, rot, sw: 5 })}</svg>`;
}

// ———— 立体（3D）————
function solidObj(it, x, z) {
  const sh = buildShape(it.shape, { flip: it.shape === 'cone' && !!it.dir });
  setMono(sh, it.color);
  const s = SC * SIZES[it.size] * (it.shape === 'sphere' ? 0.9 : 1);
  const g = sh.group; g.scale.setScalar(s);
  let y = 0, ox = 0;
  if (it.shape === 'cylinder' && it.dir) { g.rotation.z = Math.PI / 2; y = 0.85 * s; ox = 0.9 * s; }
  g.position.set(x + ox, y, z);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stage.blobTex, transparent: true, opacity: 0.3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(x, 0.003, z);
  const f = sh.foot, lying = it.shape === 'cylinder' && it.dir;
  blob.scale.set((lying ? 0.95 : f[0]) * s * 2.25, (lying ? 0.85 : f[1]) * s * 2.25, 1); blob.renderOrder = -1;
  stage.content.add(g, blob);
  return { shape: sh, key: itemKey(it), x, z };
}
function clear3() { if (gl) { stage.clear(); stage.cornerSegs = []; } objs = []; ovs.forEach((o) => o.el.remove()); ovs = []; }

function ov(el, pos, dy = 0, kind = 'pt') { el.style.position = 'absolute'; el.style.left = 0; el.style.top = 0; stage.overlay.appendChild(el); const o = { el, pos, dy, kind }; ovs.push(o); return o; }

function frame() {
  if (!objs.length && !ovs.length) return;
  const segs = [];
  for (const o of objs) {
    // 正交相机下的轮廓线：用「在这个立体正后方很远的相机」算，所以每个位置的同一种立体轮廓都一样
    const fc = { position: new THREE.Vector3(o.x, 0, o.z).addScaledVector(VIEW, 300) };
    o.shape.update(fc); segs.push(...worldSegs(o.shape));
  }
  stage.cornerSegs = segs;
  const W = (x, y, z) => stage.project(new THREE.Vector3(x, y, z));
  for (const o of ovs) {
    if (o.kind === 'pt') { const p = stage.project(o.pos); const y = o.clampBottom ? Math.min(p.y + o.dy, stage.size.h - 30) : p.y + o.dy; o.el.style.transform = `translate(${p.x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`; }
    else if (o.kind === 'shelf') {
      const a = W(...o.a), b = W(...o.b);
      Object.assign(o.el.style, { left: a.x + 'px', top: a.y - 3 + 'px', width: b.x - a.x + 'px', height: '6px' });
    } else if (o.kind === 'unit') {
      const c = o.cells, h2 = PITCH / 2 - 0.05;
      const xs = c.flatMap((q) => [W(q.x - RIGHT.x * h2, 0, q.z - RIGHT.z * h2).x, W(q.x + RIGHT.x * h2, 0, q.z + RIGHT.z * h2).x]);
      const top = W(c[0].x, 1.7, c[0].z).y, bot = W(c[0].x + FWD.x * SH, 0, c[0].z + FWD.z * SH).y + 4;
      Object.assign(o.el.style, { left: Math.min(...xs) + 'px', top: top + 'px', width: Math.max(...xs) - Math.min(...xs) + 'px', height: bot - top + 'px' });
    }
  }
}

// ———— 显示一道题（平面用 DOM，立体用 3D）————
// 🔒 只排一行：从左到右读，「？」在最右边，每格下面有序号，所有图形站在同一条底线上、等大、等距。
// v = { kind, shown[], answer, options[]|null, revealed, why, unit, noSlot }
function showSeq(v) {
  const flatTab = v.kind === 'plane';
  host.classList.toggle('svg-on', flatTab); host.classList.toggle('keep3d', false);
  host.classList.toggle('fixedview', !flatTab);
  stage.paused = flatTab || !gl;
  seqEl.style.display = flatTab ? '' : 'none';
  clear3();
  const total = v.shown.length + (v.noSlot ? 0 : 1);
  const L = v.unit ? v.unit.length : 0;
  if (flatTab) {
    const w = seqEl.clientWidth - 24, is = Math.max(40, Math.min(104, Math.floor(w / total)));
    const cell = (it, cls, n) => `<div class="cw" style="width:${is}px"><div class="it ${cls}">${planeIcon(it, is - 10)}</div><div class="no">${n}</div></div>`;
    const row = v.shown.map((it, i) => cell(it, '', i + 1)).join('') + (v.noSlot ? '' : v.revealed ? cell(v.answer, 'pop', total) : `<div class="cw" style="width:${is}px"><div class="it qm">?</div><div class="no">${total}</div></div>`);
    let h = `<div class="row one" id="r1" style="--is:${is}px">${row}</div>`;
    if (v.options) {
      const os = Math.max(56, Math.min(is, 96));
      h += `<div class="seq-label">「？」是哪一个？点一点</div><div class="row opt-row" style="--is:${os}px">${v.options.map((o, i) => `<button type="button" class="it" data-opt="${i}" aria-label="第${i + 1}个选项">${planeIcon(o, os - 16)}</button>`).join('')}</div>`;
    }
    seqEl.innerHTML = h;
    if (v.why && L) {
      const r1 = seqEl.querySelector('#r1'), items = [...r1.children];
      for (let g = 0; g * L < items.length; g++) {
        const grp = items.slice(g * L, g * L + L), x0 = grp[0].offsetLeft + 2, x1 = grp[grp.length - 1].offsetLeft + grp[grp.length - 1].offsetWidth - 2;
        const bx = document.createElement('div'); bx.className = 'unitbox'; bx.style.borderColor = g % 2 ? '#3E8EDE' : '#F2564B';
        Object.assign(bx.style, { left: x0 + 'px', top: grp[0].offsetTop - 6 + 'px', width: x1 - x0 + 'px', height: grp[0].offsetHeight + 12 + 'px' });
        r1.appendChild(bx);
      }
    }
    return;
  }
  if (!gl) { seqEl.style.display = ''; seqEl.innerHTML = '<div class="seq-label">3D 画面打不开，换一个浏览器试试。</div>'; return; }
  const hasOpt = !!v.options, optK = 7.4;
  const asp = stage.size.w / stage.size.h;
  const needW = Math.max(total, hasOpt ? 3 * 1.5 : 0) * PITCH + 0.6;
  const H = Math.max(needW / asp, hasOpt ? 8.8 : 3.8);
  stage.setOrtho(true, H);
  const target = new THREE.Vector3(0, 0.15, 0).addScaledVector(FWD, hasOpt ? optK / 2 : 0);
  const hv = { target, sph: new THREE.Spherical(40, PHI, AZ) };
  stage.setHome(() => hv); stage.fly = null; stage.controls.enabled = false; stage.place(hv.target, hv.sph);
  const at = (i, n, row) => { const t = (i - (n - 1) / 2) * (row ? PITCH * 1.5 : PITCH); const p = RIGHT.clone().multiplyScalar(t); if (row) p.addScaledVector(FWD, optK); return p; };
  const pos = []; for (let i = 0; i < total; i++) pos.push(at(i, total, 0));
  const unitPx = stage.size.h / H;
  v.shown.forEach((it, i) => objs.push(solidObj(it, pos[i].x, pos[i].z)));
  if (total === 0) return;
  const slot = pos[v.shown.length];
  if (!v.noSlot) {
    if (v.revealed) objs.push(solidObj(v.answer, slot.x, slot.z));
    else { const q = document.createElement('div'); q.className = 'it qm'; const sz = Math.round(Math.min(unitPx * 1.25, 120)); q.style.cssText = `width:${sz}px;height:${sz}px;display:grid;place-items:center;border:4px dashed #3B2A1A;background:#fff;font-size:${Math.round(sz * 0.55)}px;font-weight:900`; q.textContent = '?'; ov(q, new THREE.Vector3(slot.x, 0.55, slot.z)); }
  }
  const shelf = (a, b) => { const el = document.createElement('div'); el.className = 'shelf3'; stage.overlay.appendChild(el); ovs.push({ el, kind: 'shelf', a, b }); };
  const e0 = pos[0].clone().addScaledVector(RIGHT, -PITCH / 2).addScaledVector(FWD, SH), e1 = pos[total - 1].clone().addScaledVector(RIGHT, PITCH / 2).addScaledVector(FWD, SH);
  shelf([e0.x, 0, e0.z], [e1.x, 0, e1.z]);
  pos.forEach((p, i) => { const n = document.createElement('div'); n.className = 'no3'; n.textContent = String(i + 1); ov(n, new THREE.Vector3(p.x + FWD.x * SH, 0, p.z + FWD.z * SH), 24); });
  if (hasOpt) {
    const n = v.options.length, op = v.options.map((_, i) => at(i, n, 1));
    v.options.forEach((o, i) => {
      objs.push(solidObj(o, op[i].x, op[i].z));
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn yellow slot-btn'; b.dataset.opt = i; b.textContent = 'ABC'[i]; b.style.pointerEvents = 'auto';
      b.setAttribute('aria-label', `选 ${'ABC'[i]}`);
      ov(b, new THREE.Vector3(op[i].x + FWD.x * SH, 0, op[i].z + FWD.z * SH), 36).clampBottom = true;
    });
    const f0 = op[0].clone().addScaledVector(RIGHT, -PITCH * 0.75).addScaledVector(FWD, SH), f1 = op[n - 1].clone().addScaledVector(RIGHT, PITCH * 0.75).addScaledVector(FWD, SH);
    shelf([f0.x, 0, f0.z], [f1.x, 0, f1.z]);
    stage.overlay.onclick = (e) => { const b = e.target.closest('[data-opt]'); if (b) onOption(+b.dataset.opt); };
  }
  if (v.why && L) {
    for (let g = 0; g * L < total; g++) {
      const cells = []; for (let i = g * L; i < Math.min(g * L + L, total); i++) cells.push(pos[i]);
      const bx = document.createElement('div'); bx.className = 'unitbox'; bx.style.borderColor = g % 2 ? '#3E8EDE' : '#F2564B';
      stage.overlay.appendChild(bx);
      ovs.push({ el: bx, kind: 'unit', cells });
    }
  }
}

// 选项点击（平面用 DOM 按钮，立体用 3D 下面的数字按钮）
function onOption(i) {
  const q = S.q; if (!q || q.done) return;
  q.picked = i; q.done = true; q.ok = itemKey(q.options[i]) === itemKey(q.answer);
  S.revealed = true;
  if (q.ok) burst(host);
  render();
}

// ———— 面板 ————
const TABS = [['plane', '平面'], ['solid', '立体'], ['build', '老师出题'], ['chal', '小挑战']];
const tabsHTML = () => `<div class="tabs grid">${TABS.map(([k, t]) => `<button class="btn small${S.tab === k ? ' on' : ''}" data-a="tab-${k}">${t}</button>`).join('')}</div>`;
const KEYS = () => keysHTML(K);
const levelHTML = () => `<div class="row2" style="grid-template-columns:repeat(3,1fr)">${[1, 2, 3].map((l) => `<button class="btn small${S.level === l ? ' on' : ''}" data-a="level-${l}">${['简单', '中等', '较难'][l - 1]}</button>`).join('')}</div>`;

function describeQ(q) {
  const kindZh = q.kind === 'plane' ? '图形' : '立体';
  return `规律：${q.pat.replace(/(.)\1/g, '$1$1')}（变的是${TYPE_NAME[q.type]}）`;
}
function newQ() {
  const wpx = S.tab === 'solid' ? stage.size.w : seqEl.clientWidth - 24;
  S.q = genQuestion(S.tab, S.level, Math.max(5, Math.floor(wpx / MIN_CELL))); S.revealed = false; S.why = false;
}

function render() {
  const practice = ctxRef.getMode() === 'practice';
  if (S.tab === 'plane' || S.tab === 'solid') {
    if (!S.q || S.q.kind !== S.tab) newQ();
    const q = S.q;
    showSeq({ kind: q.kind, shown: q.shown, answer: q.answer, options: practice ? q.options : null, revealed: S.revealed, why: S.why, unit: q.unit });
    if (!practice) {
      panel.innerHTML = tabsHTML() + levelHTML() + `<div class="readout"><div class="q">${S.revealed ? '答案出现了！' : '「？」是哪一个？先猜一猜。'}</div><div class="line">${S.why ? `一组一组重复：红框、蓝框里的是同一组。变的是<b>${TYPE_NAME[q.type]}</b>。` : S.revealed ? '想知道为什么，按「为什么」。' : ''}</div></div>` +
        `<div class="grp6"><button class="btn s6 red" data-a="reveal">${S.revealed ? '再藏起来' : '揭晓'}</button><button class="btn s3 blue" data-a="why"${S.revealed ? '' : ' disabled'}>${S.why ? '收起框框' : '为什么'}</button><button class="btn s3 green" data-a="next">下一题 ▶</button></div>` + KEYS();
    } else {
      panel.innerHTML = tabsHTML() + levelHTML() + `<div class="quiz-q">「？」是哪一个？</div><div class="fb ${q.done ? (q.ok ? 'good' : 'try') : ''}" id="qfb"></div>` +
        `<button type="button" class="btn s6 blue" data-a="why"${q.done ? '' : ' style="visibility:hidden"'}>${S.why ? '收起框框' : '为什么'}</button><button type="button" class="btn s6 green" data-a="next"${q.done ? '' : ' style="visibility:hidden"'}>下一题 ▶</button>`;
      const fb = panel.querySelector('#qfb');
      if (q.done) fb.innerHTML = q.ok ? '<span class="em">答对了！好棒！</span>规律是一组一组重复。' : `<span class="em">没关系，再看一看</span>正确答案已经放进「？」里了。按「为什么」看看规律。`;
      else idleFeedback(fb, `点一点下面的${q.kind === 'solid' ? '立体（点 A B C）' : '图'}，选出「？」。`);
      if (q.done && q.kind === 'plane') seqEl.querySelectorAll('[data-opt]').forEach((b) => { b.disabled = true; const o = q.options[+b.dataset.opt]; b.classList.toggle('right', itemKey(o) === itemKey(q.answer)); if (+b.dataset.opt === q.picked && !q.ok) b.classList.add('wrong'); });
    }
  } else if (S.tab === 'build') renderBuild(practice);
  else renderChal(practice);
}

// ———— 老师出题：自己拼 ————
function buildItem() { const b = S.build; return { shape: b.shape, color: b.color, size: FIXED_SIZE, dir: FIXED_DIR }; }
function renderBuild() {
  const b = S.build, items = b.items, hide = b.hideLast && items.length > 1;
  const shown = hide ? items.slice(0, -1) : items, answer = hide ? items[items.length - 1] : null;
  const shapes = b.kind === 'plane' ? PLANE_SHAPES : SOLID_SHAPES;
  if (!shapes.includes(b.shape)) b.shape = shapes[0];
  const keys = shown.map(itemKey);
  let unit = 0, note = '';
  if (hide) {
    const pr = nextPredictions(keys);
    unit = pr.fits[0] || 0;
    note = pr.fits.length && pr.preds.length === 1 ? (pr.preds[0] === itemKey(answer) ? '规律清楚，答案是唯一的。' : '注意：照规律，「？」应该是另一个图形。') : '规律还不够明显：再多排几个，学生才不会有别的答案。';
  }
  showSeq({ noSlot: !hide, kind: b.kind, shown, answer: answer || { shape: shapes[0], color: b.color, size: FIXED_SIZE, dir: FIXED_DIR }, options: null, revealed: hide && S.revealed, why: S.why && !!unit && hide, unit: unit ? { length: unit } : null });
  if (!hide && shown.length === 0) { /* 空 */ }
  const chipShape = (s) => (b.kind === 'plane' ? `<button class="btn small${b.shape === s ? ' on' : ''}" data-a="bshape-${s}" aria-label="${SNAME[s]}" style="padding:4px;min-width:56px">${planeIcon({ shape: s, color: b.color, size: 2, dir: 0 }, 40)}</button>` : `<button class="btn small${b.shape === s ? ' on' : ''}" data-a="bshape-${s}">${SNAME[s]}</button>`);
    S.hint = '';
  panel.innerHTML = tabsHTML() + `<div class="row2"><button class="btn small${b.kind === 'plane' ? ' on' : ''}" data-a="bkind-plane">平面</button><button class="btn small${b.kind === 'solid' ? ' on' : ''}" data-a="bkind-solid">立体</button></div>` +
    `<div class="mini-note">形状（只比形状，其他都一样）</div><div class="chiprow">${shapes.map(chipShape).join('')}</div>` +
    `<div class="grp6"><button class="btn s6 green" data-a="badd"${items.length >= 9 ? ' disabled' : ''}>加入这一格（现有 ${items.length} 格）</button><button class="btn s3" data-a="bundo"${items.length ? '' : ' disabled'}>撤销</button><button class="btn s3" data-a="bclear"${items.length ? '' : ' disabled'}>清空</button>` +
    `<button class="btn s6 ${b.hideLast ? 'on' : 'yellow'}" data-a="bhide"${items.length > 1 ? '' : ' disabled'}>${b.hideLast ? '最后一格已设为「？」' : '最后一格设为「？」'}</button>` +
    `<button class="btn s3 red" data-a="breveal"${hide ? '' : ' disabled'}>${S.revealed ? '藏起来' : '揭晓'}</button><button class="btn s3 blue" data-a="bwhy"${hide && unit ? '' : ' disabled'}>为什么</button></div><div class="mini-note">${note}</div>`;
}

// ———— 小挑战 ————
function renderChal(practice) {
  if (!S.ch) { S.ch = { c: genChallenge(), shown: false, picked: -1, done: false }; }
  const ch = S.ch.c;
  host.classList.add('svg-on'); stage.paused = true; clear3(); seqEl.style.display = '';
  const w = seqEl.clientWidth - 30, is = Math.max(48, Math.min(96, Math.floor(w / 8) - 10));
  const num = (i) => `<span style="position:absolute;top:-8px;left:-4px;background:var(--ink);color:#fff;font-size:20px;min-width:28px;height:28px;border-radius:14px;display:grid;place-items:center">${i}</span>`;
  const shownRow = ch.shown.map((it, i) => `<div class="it" style="--is:${is}px">${planeIcon(it, is - 8)}${num(i + 1)}</div>`).join('');
  const reveal = S.ch.shown;
  seqEl.innerHTML = `<div class="seq-label">规律中的前 6 个</div><div class="row" style="--is:${is}px">${shownRow}</div><div class="row" style="--is:${is}px;margin-top:6px"><div class="it qm" style="font-size:30px">${reveal || S.ch.done ? '' : '第8个'}${reveal || S.ch.done ? planeIcon(ch.answer, is - 8) + num(8) : ''}</div></div>` +
    (practice ? `<div class="row opt-row" style="--is:${Math.max(56, is)}px">${ch.options.map((o, i) => `<button type="button" class="it" data-copt="${i}" aria-label="第${i + 1}个选项">${planeIcon(o, Math.max(56, is) - 16)}</button>`).join('')}</div>` : '');
  S.ch.verified = checkChallenge(ch);
  if (!practice) {
    panel.innerHTML = tabsHTML() + `<div class="readout"><div class="q">小挑战：规律中第 8 个是什么？</div><div class="line">${reveal ? '<b>答案在下面的格子里了。</b>' : '想一想规律，再按「揭晓」。'}</div></div><div class="grp6"><button class="btn s6 red" data-a="chreveal">${reveal ? '再藏起来' : '揭晓'}</button><button class="btn s6 green" data-a="chnext">换一题 ▶</button></div>` + KEYS();
  } else {
    const d = S.ch;
    panel.innerHTML = tabsHTML() + `<div class="quiz-q">规律中第 8 个是什么？</div><div class="fb ${d.done ? (d.ok ? 'good' : 'try') : ''}" id="qfb"></div><button type="button" class="btn s6 green" data-a="chnext"${d.done ? '' : ' style="visibility:hidden"'}>下一题 ▶</button>`;
    const fb = panel.querySelector('#qfb');
    if (d.done) fb.innerHTML = d.ok ? '<span class="em">答对了！好棒！</span>第 8 个就是它。' : '<span class="em">没关系，再看一看</span>正确答案已经放在第 8 格。';
    else idleFeedback(fb, '想一想规律，点下面的图。');
    if (d.done) seqEl.querySelectorAll('[data-copt]').forEach((b) => { b.disabled = true; const o = ch.options[+b.dataset.copt]; b.classList.toggle('right', itemKey(o) === itemKey(ch.answer)); if (+b.dataset.copt === d.picked && !d.ok) b.classList.add('wrong'); });
  }
}

function setTab(t) {
  S.tab = t; S.q = null; S.revealed = false; S.why = false; S.ch = null;
  if (t === 'plane' || t === 'solid') S.kindTab = t;
  render();
}

function onPanel(e) {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a, bd = S.build;
  if (a === 'keys') { toggleKeys(); render(); }
  else if (a.startsWith('tab-')) setTab(a.slice(4));
  else if (a.startsWith('level-')) { S.level = +a.slice(6); newQ(); render(); }
  else if (a === 'reveal') { S.revealed = !S.revealed; if (!S.revealed) S.why = false; render(); }
  else if (a === 'why') { S.why = !S.why; render(); }
  else if (a === 'next') { newQ(); render(); }
  else if (a.startsWith('bkind-')) { bd.kind = a.slice(6); bd.items = []; bd.color = pick(PAL); bd.hideLast = false; S.revealed = false; S.why = false; render(); }
  else if (a.startsWith('bshape-')) { bd.shape = a.slice(7); render(); }
  else if (a === 'badd') { bd.items.push(buildItem()); S.revealed = false; S.why = false; render(); }
  else if (a === 'bundo') { bd.items.pop(); if (bd.items.length < 2) bd.hideLast = false; S.revealed = false; render(); }
  else if (a === 'bclear') { bd.items = []; bd.color = pick(PAL); bd.hideLast = false; S.revealed = false; S.why = false; render(); }
  else if (a === 'bhide') { bd.hideLast = !bd.hideLast; S.revealed = false; S.why = false; render(); }
  else if (a === 'breveal') { S.revealed = !S.revealed; if (!S.revealed) S.why = false; render(); }
  else if (a === 'bwhy') { S.why = !S.why; render(); }
  else if (a === 'chreveal') { S.ch.shown = !S.ch.shown; render(); }
  else if (a === 'chnext') { S.ch = null; render(); }
}
function onSeqClick(e) {
  const o = e.target.closest('[data-opt]'); if (o) return onOption(+o.dataset.opt);
  const c = e.target.closest('[data-copt]');
  if (c && S.ch && !S.ch.done) { const ch = S.ch.c, i = +c.dataset.copt; S.ch.picked = i; S.ch.done = true; S.ch.ok = itemKey(ch.options[i]) === itemKey(ch.answer); if (S.ch.ok) burst(host); render(); }
}
function onKey(e) {
  const teach = ctxRef.getMode() === 'teach';
  if (e.code === 'Space') {
    e.preventDefault(); if (e.type === 'keyup') return;
    if (S.tab === 'plane' || S.tab === 'solid') { if (!teach) { if (S.q?.done) { newQ(); render(); } } else if (!S.revealed) { S.revealed = true; render(); } else { newQ(); render(); } }
    else if (S.tab === 'chal' && teach) { if (!S.ch.shown) { S.ch.shown = true; render(); } else { S.ch = null; render(); } }
    return;
  }
  if (e.type === 'keydown' && (e.key === 'r' || e.key === 'R')) stage.reset();
}

export default {
  title: '模式排列',
  mount(body, ctx) {
    ctxRef = ctx;
    S = { tab: 'plane', level: 1, q: null, revealed: false, why: false, ch: null, build: { kind: 'plane', items: [], hideLast: false, shape: 'square', color: pick(PAL) } };
    body.innerHTML = '<div class="stagecol"><div class="stage" id="host"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel');
    gl = stage.mount(host, { home: () => ({ target: new THREE.Vector3(0, 0.5, 0), sph: new THREE.Spherical(9, rad(66), 0) }), onFrame: frame }).ok;
    const cv = host.querySelector('.cv') || host;
    seqEl = document.createElement('div'); seqEl.className = 'seq'; cv.appendChild(seqEl);
    seqEl.addEventListener('click', onSeqClick);
    ro = new ResizeObserver(() => { if (S.tab !== 'chal' || true) { clearTimeout(S.rt); S.rt = setTimeout(() => render(), 120); } }); ro.observe(seqEl);
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { S.q = null; S.revealed = false; S.why = false; S.ch = null; render(); });
    render();
    window.__m3 = { S: () => S, genQuestion, genChallenge, checkChallenge, checkQuestion, isUnique, nextPredictions, itemKey, setTab };
  },
  unmount() {
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    offMode?.(); ro?.disconnect(); clearTimeout(S?.rt);
    objs = []; ovs = [];
    stage.unmount(); delete window.__m3;
  },
};
