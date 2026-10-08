// M3 模式排列（7.1／7.2「依规律排列」）：平面＋立体，题目由程式生成，用程式保证答案唯一
import { stage, THREE } from '../core/stage3d.js';
import { flatSVG, FLAT, PAL } from '../core/flat.js';
import { shuffle, pick, burst, idleFeedback } from '../core/quiz.js';
import { buildShape, setMono, worldSegs } from './shapes.js';
import { keysHTML, toggleKeys } from '../core/keys.js';

const rad = THREE.MathUtils.degToRad;
const PATTERNS = { ABAB: 'AB', AAB: 'AAB', ABB: 'ABB', ABC: 'ABC', AABB: 'AABB' };
const SIZES = [0.62, 0.8, 1];
const PLANE_SHAPES = ['square', 'circle', 'tri'], SOLID_SHAPES = ['cube', 'sphere', 'cone', 'cylinder'];
const SNAME = { square: '正方形', circle: '圆形', tri: '三角形', rect: '长方形', cube: '正方体', sphere: '球体', cone: '圆锥体', cylinder: '圆柱体' };
const CNAME = { '#F2564B': '红色', '#FFC93C': '黄色', '#3E8EDE': '蓝色', '#46B97A': '绿色', '#FF8A3D': '橙色', '#8E6BD8': '紫色' };
const TYPE_NAME = { shape: '形状', color: '颜色', size: '大小', dir: '方向', 'shape+color': '形状和颜色', 'size+color': '大小和颜色' };
const K = [['<kbd>空白键</kbd>', '揭晓／下一题'], ['<kbd>R</kbd>', '复位视角']];

let S, host, panel, seqEl, gl, ctxRef, offMode, objs = [], ovs = [], ro;

// ———— 题目生成与唯一性 ————
export const itemKey = (it) => `${it.shape}|${it.color}|${it.size}|${it.dir}`;

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

function makeSymbols(kind, type, nsym) {
  const shapes = kind === 'plane' ? PLANE_SHAPES : SOLID_SHAPES;
  const base = { shape: pick(shapes), color: pick(PAL), size: 1, dir: 0 };
  const distinct = (arr) => shuffle(arr).slice(0, nsym);
  const out = [];
  if (type === 'shape') { const sh = distinct(shapes); if (sh.length < nsym) return null; for (let i = 0; i < nsym; i++) out.push({ ...base, shape: sh[i] }); }
  else if (type === 'color') { const c = distinct(PAL); for (let i = 0; i < nsym; i++) out.push({ ...base, color: c[i] }); }
  else if (type === 'size') { const z = distinct([0, 1, 2]); if (z.length < nsym) return null; for (let i = 0; i < nsym; i++) out.push({ ...base, size: z[i] }); }
  else if (type === 'dir') {
    if (nsym > 2) return null;
    const sh = kind === 'plane' ? pick(['tri', 'rect']) : pick(['cone', 'cylinder']);
    for (let i = 0; i < nsym; i++) out.push({ ...base, shape: sh, dir: i });
  } else if (type === 'shape+color') {
    const sh = distinct(shapes), c = distinct(PAL); if (sh.length < nsym) return null;
    for (let i = 0; i < nsym; i++) out.push({ ...base, shape: sh[i], color: c[i] });
  } else if (type === 'size+color') {
    const z = distinct([0, 1, 2]), c = distinct(PAL); if (z.length < nsym) return null;
    for (let i = 0; i < nsym; i++) out.push({ ...base, size: z[i], color: c[i] });
  }
  return out;
}

export function genQuestion(kind, level) {
  const types = level === 1 ? ['shape', 'color'] : level === 2 ? ['shape', 'color', 'size', 'dir'] : ['shape', 'color', 'size', 'dir', 'shape+color', 'size+color'];
  const pats = level === 1 ? ['ABAB', 'AAB', 'ABB'] : ['ABAB', 'AAB', 'ABB', 'ABC', 'AABB'];
  for (let tries = 0; tries < 400; tries++) {
    const type = pick(types);
    const pat = pick(pats.filter((p) => (type === 'dir' ? !p.includes('C') : true)));
    const unit = PATTERNS[pat], L = unit.length, letters = [...new Set(unit)].sort();
    const syms = makeSymbols(kind, type, letters.length); if (!syms) continue;
    const sym = (ch) => syms[letters.indexOf(ch)];
    const ns = []; for (let n = 2 * L; n <= 8; n++) ns.push(n);
    const n = level === 1 ? ns[0] + (Math.random() < 0.5 ? 0 : Math.min(1, ns.length - 1)) : pick(ns);
    const full = []; for (let i = 0; i <= n; i++) full.push({ ...sym(unit[i % L]) });
    const shown = full.slice(0, n), answer = full[n];
    const keys = shown.map(itemKey);
    if (!isUnique(keys)) continue;
    if (nextPredictions(keys).preds[0] !== itemKey(answer)) continue;
    // 选项：答案＋另一个符号＋一个只变一个属性的假答案
    const opts = [answer, ...letters.map(sym).filter((it) => itemKey(it) !== itemKey(answer))];
    const wrongOne = { ...answer };
    const shapes = kind === 'plane' ? PLANE_SHAPES : SOLID_SHAPES;
    for (let t = 0; t < 80 && opts.length < 3; t++) {
      const w = { ...answer };
      if (type === 'dir') { w.shape = pick(shapes); if (Math.random() < 0.5) w.dir = 1 - w.dir; }
      else if (type.includes('shape')) w.shape = pick(shapes);
      if (type.includes('color')) w.color = pick(PAL);
      if (type.includes('size')) w.size = pick([0, 1, 2]);
      if (!opts.some((o) => itemKey(o) === itemKey(w))) opts.push(w);
    }
    while (opts.length > 3) opts.pop();
    return { kind, type, pat, unit, n, shown, answer, options: shuffle(opts), uniqueOK: true, keys };
  }
  return null;
}

// ———— 小挑战：第 8 个是什么 ————
export function genChallenge() {
  for (let t = 0; t < 400; t++) {
    const pat = pick(['ABAB', 'AAB', 'ABB', 'ABC']), type = pick(['shape', 'color', 'size']);
    const unit = PATTERNS[pat], L = unit.length, letters = [...new Set(unit)].sort();
    const syms = makeSymbols('plane', type, letters.length); if (!syms) continue;
    const sym = (ch) => syms[letters.indexOf(ch)];
    const all = []; for (let i = 0; i < 8; i++) all.push({ ...sym(unit[i % L]) });
    const shown = all.slice(0, 6), answer = all[7];
    if (!isUnique(shown.map(itemKey))) continue;
    const opts = [answer, ...letters.map(sym).filter((it) => itemKey(it) !== itemKey(answer))];
    for (let k = 0; k < 20 && opts.length < 3; k++) { const w = { ...answer, color: pick(PAL), shape: type === 'shape' ? pick(PLANE_SHAPES) : answer.shape, size: type === 'size' ? pick([0, 1, 2]) : answer.size }; if (!opts.some((o) => itemKey(o) === itemKey(w))) opts.push(w); }
    while (opts.length > 3) opts.pop();
    return { pat, unit, type, shown, answer, options: shuffle(opts) };
  }
}
// 自动检查：只看画面上显示的 6 个，自己找出周期，推出第 8 个，必须与出题时的答案一致
export function checkChallenge(ch) {
  const keys = ch.shown.map(itemKey), p = minPeriod(keys);
  if (!p) return false;
  const eighth = keys[7 % p];
  return eighth === itemKey(ch.answer);
}

// ———— 平面图形的画法 ————
const fid = (s) => (s === 'triangle' ? 'tri' : s);
function planeIcon(it, size = 56) {
  const id = fid(it.shape);
  const rot = id === 'tri' ? (it.dir ? 180 : 0) : id === 'rect' ? (it.dir ? 90 : 0) : 0;
  return `<svg viewBox="-60 -60 120 120" width="${size}" height="${size}" aria-hidden="true">${flatSVG(id, { k: 42 * SIZES[it.size], color: it.color, rot, sw: 5 })}</svg>`;
}

// ———— 立体（3D）————
function solidObj(it, x, z) {
  const sh = buildShape(it.shape, { flip: it.shape === 'cone' && !!it.dir });
  setMono(sh, it.color);
  const s = 0.64 * SIZES[it.size] * (it.shape === 'sphere' ? 0.9 : 1);
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

function fitCam(N, rows) {
  const asp = stage.size.w / stage.size.h, th = Math.tan(rad(stage.camera.fov / 2));
  const half = (N * 1.5) / 2 + 0.4;
  const r = Math.max(7.5, (half * 1.12) / (th * asp));
  const tz = rows > 1 ? 1.3 : 0;
  stage.controls.maxDistance = Math.max(14, r * 1.4);
  const h = { target: new THREE.Vector3(0, 0.5, tz), sph: new THREE.Spherical(r, rad(rows > 1 ? 56 : 66), 0) };
  stage.setHome(() => h); stage.fly = null; stage.controls.enabled = true; stage.place(h.target, h.sph);
}

function frame() {
  if (!objs.length && !ovs.length) return;
  const segs = [];
  for (const o of objs) { o.shape.update(stage.camera); segs.push(...worldSegs(o.shape)); }
  stage.cornerSegs = segs;
  for (const o of ovs) {
    if (o.kind === 'pt') { const p = stage.project(o.pos); o.el.style.transform = `translate(${p.x.toFixed(1)}px,${(p.y + o.dy).toFixed(1)}px) translate(-50%,-50%)`; }
    else if (o.kind === 'unit') {
      const pts = o.idx.map((i) => objs[i] ? { x: objs[i].x, z: objs[i].z } : { x: o.slot.x, z: o.slot.z });
      const a = pts.map((q) => stage.project(new THREE.Vector3(q.x - 0.78, 0.55, q.z))), b = pts.map((q) => stage.project(new THREE.Vector3(q.x + 0.78, 0.55, q.z)));
      const l = Math.min(...a.map((p) => p.x)) - 4, r = Math.max(...b.map((p) => p.x)) + 4, c = a[0].y, hh = Math.abs(b[0].x - a[0].x) * 0.62;
      Object.assign(o.el.style, { left: l + 'px', top: c - hh + 'px', width: r - l + 'px', height: hh * 2 + 'px' });
    }
  }
}

// ———— 显示一道题（平面用 DOM，立体用 3D）————
// v = { kind, shown[], answer, options[]|null, revealed, why, unit, qpos: 'end'|index }
function showSeq(v) {
  const flatTab = v.kind === 'plane';
  host.classList.toggle('svg-on', flatTab); host.classList.toggle('keep3d', false);
  stage.paused = flatTab || !gl;
  seqEl.style.display = flatTab ? '' : 'none';
  clear3();
  const total = v.shown.length + (v.noSlot ? 0 : 1);
  const L = v.unit ? v.unit.length : 0;
  if (flatTab) {
    const w = seqEl.clientWidth - 30, is = Math.max(52, Math.min(104, Math.floor(w / total) - 10));
    const cell = (it, cls = '', attr = '') => `<div class="it ${cls}" ${attr}>${planeIcon(it, is - 8)}</div>`;
    const row = v.shown.map((it) => cell(it)).join('') + (v.noSlot ? '' : v.revealed ? cell(v.answer, 'pop') : `<div class="it qm">?</div>`);
    let h = `<div class="row" id="r1" style="--is:${is}px">${row}</div>`;
    if (v.options) {
      h += `<div class="seq-label">「？」是哪一个？点一点</div><div class="row opt-row" style="--is:${Math.max(56, is)}px">${v.options.map((o, i) => `<button type="button" class="it" data-opt="${i}" aria-label="第${i + 1}个选项">${planeIcon(o, Math.max(56, is) - 16)}</button>`).join('')}</div>`;
    }
    seqEl.innerHTML = h;
    if (v.why && L) {
      const r1 = seqEl.querySelector('#r1'), items = [...r1.children];
      for (let g = 0; g * L < items.length; g++) {
        const grp = items.slice(g * L, g * L + L), x0 = grp[0].offsetLeft - 6, x1 = grp[grp.length - 1].offsetLeft + grp[grp.length - 1].offsetWidth + 6;
        const bx = document.createElement('div'); bx.className = 'unitbox'; bx.style.borderColor = g % 2 ? '#3E8EDE' : '#F2564B';
        Object.assign(bx.style, { left: x0 + 'px', top: grp[0].offsetTop - 8 + 'px', width: x1 - x0 + 'px', height: grp[0].offsetHeight + 16 + 'px' });
        r1.appendChild(bx);
      }
    }
    return;
  }
  if (!gl) { seqEl.style.display = ''; seqEl.innerHTML = '<div class="seq-label">3D 画面打不开，换一个浏览器试试。</div>'; return; }
  const rows = v.options ? 2 : 1, N = Math.max(total, v.options ? 3 : 0);
  fitCam(N, rows);
  v.shown.forEach((it, i) => { objs.push(solidObj(it, (i - (total - 1) / 2) * 1.5, v.options ? -1.3 : 0)); });
  const slotX = (v.shown.length - (total - 1) / 2) * 1.5, slotZ = v.options ? -1.3 : 0;
  if (v.noSlot) { /* 没有「？」 */ }
  else if (v.revealed) objs.push(solidObj(v.answer, slotX, slotZ));
  else { const q = document.createElement('div'); q.className = 'it qm'; q.style.cssText = 'width:64px;height:64px;display:grid;place-items:center;border:4px dashed #3B2A1A;background:#fff;font-size:40px;font-weight:900'; q.textContent = '?'; ov(q, new THREE.Vector3(slotX, 0.6, slotZ)); }
  if (v.options) {
    v.options.forEach((o, i) => {
      const x = (i - (v.options.length - 1) / 2) * 2.4;
      objs.push(solidObj(o, x, 1.6));
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn yellow slot-btn'; b.dataset.opt = i; b.textContent = String(i + 1); b.style.pointerEvents = 'auto';
      b.setAttribute('aria-label', `选第${i + 1}个`);
      ov(b, new THREE.Vector3(x, 0, 1.6 + 0.95), 28);
    });
    stage.overlay.onclick = (e) => { const b = e.target.closest('[data-opt]'); if (b) onOption(+b.dataset.opt); };
  }
  if (v.why && L) {
    for (let g = 0; g * L < total; g++) {
      const idx = []; for (let i = g * L; i < Math.min(g * L + L, total); i++) idx.push(i);
      const bx = document.createElement('div'); bx.className = 'unitbox'; bx.style.borderColor = g % 2 ? '#3E8EDE' : '#F2564B';
      stage.overlay.appendChild(bx);
      const o = { el: bx, kind: 'unit', idx: idx.map((i) => (i < objs.length && i < v.shown.length + (v.revealed ? 1 : 0) ? i : -1)).map((i) => i), slot: { x: slotX, z: slotZ } }; ovs.push(o);
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
  S.q = genQuestion(S.tab, S.level); S.revealed = false; S.why = false;
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
      else idleFeedback(fb, `点一点下面的图${q.kind === 'solid' ? '（点数字）' : ''}，选出「？」。`);
      if (q.done && q.kind === 'plane') seqEl.querySelectorAll('[data-opt]').forEach((b) => { b.disabled = true; const o = q.options[+b.dataset.opt]; b.classList.toggle('right', itemKey(o) === itemKey(q.answer)); if (+b.dataset.opt === q.picked && !q.ok) b.classList.add('wrong'); });
    }
  } else if (S.tab === 'build') renderBuild(practice);
  else renderChal(practice);
}

// ———— 老师出题：自己拼 ————
function buildItem() { const b = S.build; return { shape: b.shape, color: b.color, size: b.size, dir: b.dir }; }
function renderBuild() {
  const b = S.build, items = b.items, hide = b.hideLast && items.length > 1;
  const shown = hide ? items.slice(0, -1) : items, answer = hide ? items[items.length - 1] : null;
  const shapes = b.kind === 'plane' ? [...PLANE_SHAPES, 'rect'] : SOLID_SHAPES;
  if (!shapes.includes(b.shape)) b.shape = shapes[0];
  const keys = shown.map(itemKey);
  let unit = 0, note = '';
  if (hide) {
    const pr = nextPredictions(keys);
    unit = pr.fits[0] || 0;
    note = pr.fits.length && pr.preds.length === 1 ? (pr.preds[0] === itemKey(answer) ? '规律清楚，答案是唯一的。' : '注意：照规律，「？」应该是另一个图形。') : '规律还不够明显：再多排几个，学生才不会有别的答案。';
  }
  showSeq({ noSlot: !hide, kind: b.kind, shown, answer: answer || { shape: shapes[0], color: PAL[0], size: 1, dir: 0 }, options: null, revealed: hide && S.revealed, why: S.why && !!unit && hide, unit: unit ? { length: unit } : null });
  if (!hide && shown.length === 0) { /* 空 */ }
  const chipShape = (s) => (b.kind === 'plane' ? `<button class="btn small${b.shape === s ? ' on' : ''}" data-a="bshape-${s}" aria-label="${SNAME[s]}" style="padding:4px;min-width:56px">${planeIcon({ shape: s, color: b.color, size: 2, dir: 0 }, 40)}</button>` : `<button class="btn small${b.shape === s ? ' on' : ''}" data-a="bshape-${s}">${SNAME[s]}</button>`);
  const dirOK = (b.kind === 'plane' ? ['tri', 'rect'] : ['cone', 'cylinder']).includes(b.shape);
  S.hint = '';
  panel.innerHTML = tabsHTML() + `<div class="row2"><button class="btn small${b.kind === 'plane' ? ' on' : ''}" data-a="bkind-plane">平面</button><button class="btn small${b.kind === 'solid' ? ' on' : ''}" data-a="bkind-solid">立体</button></div>` +
    `<div class="mini-note">形状</div><div class="chiprow">${shapes.map(chipShape).join('')}</div>` +
    `<div class="mini-note">颜色</div><div class="chiprow">${PAL.map((c) => `<button class="btn sw${b.color === c ? ' on' : ''}" data-a="bcolor-${c.slice(1)}" aria-label="${CNAME[c]}" style="background:${c}"></button>`).join('')}</div>` +
    `<div class="mini-note">大小　　<span style="opacity:.8">方向${dirOK ? '' : '（这个形状没有方向）'}</span></div><div class="chiprow">${[0, 1, 2].map((z) => `<button class="btn small${b.size === z ? ' on' : ''}" data-a="bsize-${z}">${['小', '中', '大'][z]}</button>`).join('')}${[0, 1].map((d) => `<button class="btn small${b.dir === d ? ' on' : ''}" data-a="bdir-${d}"${dirOK ? '' : ' disabled'}>${b.kind === 'plane' ? (b.shape === 'rect' ? ['横', '竖'][d] : ['朝上', '朝下'][d]) : (b.shape === 'cylinder' ? ['站', '躺'][d] : ['尖朝上', '尖朝下'][d])}</button>`).join('')}</div>` +
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
  else if (a.startsWith('bkind-')) { bd.kind = a.slice(6); bd.items = []; bd.hideLast = false; S.revealed = false; S.why = false; render(); }
  else if (a.startsWith('bshape-')) { bd.shape = a.slice(7); render(); }
  else if (a.startsWith('bcolor-')) { bd.color = '#' + a.slice(7); render(); }
  else if (a.startsWith('bsize-')) { bd.size = +a.slice(6); render(); }
  else if (a.startsWith('bdir-')) { bd.dir = +a.slice(5); render(); }
  else if (a === 'badd') { bd.items.push(buildItem()); S.revealed = false; S.why = false; render(); }
  else if (a === 'bundo') { bd.items.pop(); if (bd.items.length < 2) bd.hideLast = false; S.revealed = false; render(); }
  else if (a === 'bclear') { bd.items = []; bd.hideLast = false; S.revealed = false; S.why = false; render(); }
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
    S = { tab: 'plane', level: 1, q: null, revealed: false, why: false, ch: null, build: { kind: 'plane', items: [], hideLast: false, shape: 'square', color: PAL[0], size: 1, dir: 0 } };
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
    window.__m3 = { S: () => S, genQuestion, genChallenge, checkChallenge, isUnique, nextPredictions, itemKey, setTab };
  },
  unmount() {
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    offMode?.(); ro?.disconnect(); clearTimeout(S?.rt);
    objs = []; ovs = [];
    stage.unmount(); delete window.__m3;
  },
};
