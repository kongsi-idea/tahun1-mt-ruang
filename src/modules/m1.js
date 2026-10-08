import { stage, THREE } from '../core/stage3d.js';
import { hlMats } from '../core/ink.js';
import { mountOptions, feedback, idleFeedback, burst, shuffle, pick } from '../core/quiz.js';
import { buildShape, SHAPE_IDS, NAMES } from './shapes.js';
import { OBJECTS } from './objects.js';
import { keysHTML, toggleKeys } from '../core/keys.js';

const rad = THREE.MathUtils.degToRad;
const home = () => { const narrow = stage.size.w / stage.size.h < 1.25; return { target: new THREE.Vector3(0, narrow ? 0.4 : 0.85, 0), sph: new THREE.Spherical(narrow ? 6.6 : 7.6, rad(66), rad(35)) }; };
const KIND = { face: { zh: '面', unit: '个', ico: '面' }, edge: { zh: '边', unit: '条' }, vert: { zh: '顶点', unit: '个' } };
const CREAM = new THREE.Color('#FFF4DC');
const FINGER = '<svg class="finger" viewBox="0 0 84 84"><rect x="32" y="4" width="22" height="48" rx="11" fill="#fff" stroke="#3B2A1A" stroke-width="5"/><rect x="14" y="40" width="58" height="40" rx="16" fill="#fff" stroke="#3B2A1A" stroke-width="5"/></svg>';

let S, shape, host, panel, chipsEl, markers, offKeys, offMode, ctxRef, gl, glowFrame;

const total = (k) => (k === 'face' ? shape.faces : k === 'edge' ? shape.edges : shape.verts).length;

function describe(k, n) {
  const list = k === 'face' ? shape.faces : shape.edges;
  const cnt = {}; list.forEach((x) => (cnt[x.type] = (cnt[x.type] || 0) + 1));
  if (k === 'vert') return `一共 ${n} 个顶点`;
  if (k === 'face') {
    const p = cnt['平面'] || 0, c = cnt['曲面'] || 0;
    let t = `一共 ${n} 个面：`;
    if (p && c) t += `${p} 个平面、${c} 个曲面`; else if (p) t += '全是平面'; else t += '是曲面';
    const notes = {}; shape.faces.forEach((f) => f.note && (notes[f.note] = (notes[f.note] || 0) + 1));
    if (shape.id === 'pyramid') t += '（1 个正方形、4 个三角形）';
    return t;
  }
  const l = cnt.line || 0, c = cnt.curve || 0;
  return `一共 ${n} 条边：` + (l && !c ? '全是直线' : !l && c ? (c === 1 ? '是曲线' : `${c} 条都是曲线`) : `${l} 条直线、${c} 条曲线`);
}

// ———— 3D 与标记 ————
function loadShape(i) {
  S.idx = i;
  if (gl) { stage.clear(); }
  shape = buildShape(SHAPE_IDS[i]);
  if (gl) {
    stage.content.add(shape.group);
    shape.faces.forEach((f) => (f.base = f.mesh.material.color.clone()));
  } else shape.faces.forEach((f) => (f.base = new THREE.Color()));
  S.name = false; clearMarks();
}

function clearMarks() {
  S.mode = null; S.n = 0; S.cur = -1; S.zero = false;
  applyMarks();
}

function applyMarks() {
  markers.forEach((m) => m.el.remove()); markers = [];
  host?.querySelectorAll('.finger,.callout').forEach((e) => e.remove());
  if (!shape) return;
  const k = S.mode;
  // 面：未数的变淡，数到的亮起
  shape.faces.forEach((f, i) => {
    const mat = f.mesh.material;
    if (k === 'face') {
      if (i < S.n) { mat.color.copy(f.base); mat.emissive.copy(f.base).multiplyScalar(i === S.cur ? 0.22 : 0); }
      else { mat.color.copy(f.base).lerp(CREAM, 0.72); mat.emissive.setScalar(0); }
    } else { mat.color.copy(f.base); mat.emissive.setScalar(0); }
  });
  // 边
  shape.edges.forEach((e, i) => {
    e.hl.visible = k === 'edge' && i < S.n;
    e.hl.material = i === S.cur ? hlMats.cur : e.type === 'curve' ? hlMats.curve : hlMats.line;
    e.hl.renderOrder = i === S.cur ? 8 : 6;
  });
  if (!gl || !stage.overlay) return;
  if (k) {
    const T = total(k);
    for (let i = 0; i < Math.min(S.n, T); i++) {
      const el = document.createElement('div');
      const cur = i === S.cur ? ' cur' : '';
      if (k === 'face') { const f = shape.faces[i]; el.className = `mk face ${f.type === '平面' ? 'planar' : 'curved'}${cur}`; el.innerHTML = `<span class="n">${i + 1}<small>${f.type}</small></span>`; markers.push({ el, anchor: f.anchor }); }
      if (k === 'edge') { const e = shape.edges[i]; el.className = `mk edge ${e.type}${cur}`; el.innerHTML = `<span class="n">${i + 1}${T <= 3 ? `<small>${e.type === 'line' ? '直线' : '曲线'}</small>` : ''}</span>`; markers.push({ el, anchor: e.anchor }); }
      if (k === 'vert') { el.className = `mk vert${cur}`; el.innerHTML = `<span class="ring"></span><span class="n">${i + 1}</span>`; const p = shape.verts[i]; markers.push({ el, anchor: () => p, vert: true }); }
      stage.overlay.appendChild(el);
    }
    if (T === 0) {
      const c = document.createElement('div'); c.className = 'callout'; c.textContent = `没有${KIND[k].zh}`;
      stage.overlay.appendChild(c);
      stage.overlay.insertAdjacentHTML('beforeend', FINGER);
    }
  }
}

function frame() {
  if (!shape || S.tab !== 'know') return;
  const cam = stage.camera;
  shape.update(cam);
  stage.cornerSegs = shape.segs();
  for (const m of markers) {
    const p = m.anchor(cam), pr = stage.project(p, shape.occluders);
    m.el.style.transform = `translate(${pr.x.toFixed(1)}px,${pr.y.toFixed(1)}px)${m.vert ? '' : ' translate(-50%,-50%)'}`;
    m.el.classList.toggle('occ', !pr.visible);
  }
}

// ———— 操作 ————
function setMode(k) {
  if (S.mode === k) { clearMarks(); } else { S.mode = k; S.n = 0; S.cur = -1; S.zero = total(k) === 0; applyMarks(); }
  render();
}
const step = () => { if (S.mode && S.n < total(S.mode)) { S.n++; S.cur = S.n - 1; applyMarks(); render(); } };
const back = () => { if (S.mode && S.n > 0) { S.n--; S.cur = S.n - 1; applyMarks(); render(); } };
const all = () => { if (S.mode) { S.n = total(S.mode); S.cur = -1; applyMarks(); render(); } };

// ———— 画面 ————
function nameTag() {
  const t = host.querySelector('.tag') || (host.querySelector('.cv') || host).appendChild(Object.assign(document.createElement('div'), { className: 'tag' }));
  const show = S.tab === 'know' && (S.name || (ctxRef.getMode() === 'practice' && S.q?.done));
  t.className = 'tag' + (show ? '' : ' hidden');
  t.textContent = show ? shape.name : '这是什么立体？';
  t.style.display = S.tab === 'know' ? '' : 'none';
  if (ctxRef.getMode() === 'practice' && S.q && S.q.type !== 'name' && !S.q.done) t.style.display = 'none';
}

function renderChips() {
  chipsEl.style.display = ctxRef.getMode() === 'teach' && S.tab === 'know' ? '' : 'none';
  if (chipsEl.dataset.built) { chipsEl.querySelectorAll('.chip').forEach((b, i) => b.classList.toggle('on', i === S.idx)); return; }
  chipsEl.dataset.built = 1;
  chipsEl.innerHTML = '<button class="btn nav" aria-label="上一个" data-d="-1">◀</button>' +
    SHAPE_IDS.map((_, i) => `<button class="btn chip" aria-label="第${i + 1}个立体" data-i="${i}">${i + 1}</button>`).join('') +
    '<button class="btn nav" aria-label="下一个" data-d="1">▶</button>';
  chipsEl.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.i != null) switchShape(+b.dataset.i); else switchShape((S.idx + +b.dataset.d + 6) % 6);
  };
  renderChips();
}

function switchShape(i) { loadShape(i); if (gl && stage.mounted) stage.reset(); render(); }

function readout() {
  const k = S.mode;
  if (!k) return `<div class="readout"><div class="line">${S.name ? `这是<b>${shape.name}</b>。` : '先猜一猜：这是什么立体？'}<br>想数一数，就按「面」「边」「顶点」。</div></div>`;
  const T = total(k), n = S.n;
  let line;
  if (T === 0) line = `<b>没有${KIND[k].zh}</b>。摸一摸，${k === 'vert' ? '找不到尖尖的角' : '找不到一条边'}。`;
  else if (n === 0) line = `点「数下一个」或按空白键，一个一个数。`;
  else if (n < T) {
    if (k === 'face') { const f = shape.faces[n - 1]; line = `第 ${n} 个面：<b>${f.type}</b>${f.note ? '（' + f.note + '）' : ''}`; }
    else if (k === 'edge') line = `第 ${n} 条边：<b>${shape.edges[n - 1].type === 'line' ? '直线' : '曲线'}</b>`;
    else line = `第 ${n} 个顶点`;
  } else line = `<b>${describe(k, T)}</b>`;
  return `<div class="readout"><div class="big">${n}</div><div class="line">${line}</div></div>`;
}

function toolsHTML() {
  const k = S.mode;
  return `<div class="grp6">
    <button class="btn s2 blue${k === 'face' ? ' on' : ''}" data-a="face">面</button>
    <button class="btn s2 red${k === 'edge' ? ' on' : ''}" data-a="edge">边</button>
    <button class="btn s2 purple${k === 'vert' ? ' on' : ''}" data-a="vert">顶点</button>
    <button class="btn s4 green" data-a="step"${k ? '' : ' disabled'}>数下一个</button>
    <button class="btn s2 orange" data-a="all"${k ? '' : ' disabled'}>全部</button>
  </div>`;
}

function tabsHTML() {
  return `<div class="tabs"><button class="btn small${S.tab === 'know' ? ' on' : ''}" data-a="tab-know">认识立体</button><button class="btn small${S.tab === 'life' ? ' on' : ''}" data-a="tab-life">生活中的立体</button></div>`;
}
const K = [['<kbd>空白键</kbd>', '揭晓／下一步'], ['<kbd>←</kbd><kbd>→</kbd>', '上一项／下一项'], ['<kbd>R</kbd>', '复位视角']];
const KEYS = () => keysHTML(K);

function render() {
  const practice = ctxRef.getMode() === 'practice';
  host.classList.toggle('life-on', S.tab === 'life');
  stage.paused = S.tab === 'life' || !gl;
  nameTag();
  renderChips();
  if (S.tab === 'life') return renderLife(practice);
  if (practice) return renderQuiz();
  panel.innerHTML = tabsHTML() +
    `<div class="grp6"><button class="btn s4 yellow" data-a="name" style="grid-column:span 4">${S.name ? '隐藏名称' : '显示名称'}</button><button class="btn s2" data-a="clear" style="grid-column:span 2"${S.mode || S.name ? '' : ' disabled'}>清除</button></div>` +
    toolsHTML() + readout() + KEYS();
}

// ———— 生活中的立体 ————
function renderLife(practice) {
  const o = OBJECTS[S.life];
  let lifeEl = host.querySelector('.life');
  if (!lifeEl) { lifeEl = document.createElement('div'); lifeEl.className = 'life'; (host.querySelector('.cv') || host).appendChild(lifeEl); }
  const ans = S.lifeShown || (practice && S.q?.done);
  lifeEl.innerHTML = `${o.svg()}<div class="nm">${o.name}</div><div class="ans${ans ? '' : ' empty'}">它像：${NAMES[o.solid]}</div>`;
  if (!practice) {
    panel.innerHTML = tabsHTML() + `<div class="readout"><div class="q">老师问：它像哪一种立体？</div></div>
    <div class="grp6"><button class="btn s6 red" data-a="reveal">${S.lifeShown ? '再藏起来' : '揭晓'}</button>
    <button class="btn s3" data-a="lprev">◀ 上一件</button><button class="btn s3 green" data-a="lnext">下一件 ▶</button></div>` + KEYS();
    return;
  }
  if (!S.q || S.q.type !== 'life' || S.q.idx !== S.life) newLifeQ();
  renderQuizPanel(true);
}

function newLifeQ() {
  const o = OBJECTS[S.life];
  const wrong = shuffle(SHAPE_IDS.filter((s) => s !== o.solid)).slice(0, 2);
  const ids = shuffle([o.solid, ...wrong]);
  S.q = { type: 'life', idx: S.life, labels: ids.map((s) => NAMES[s]), correct: ids.indexOf(o.solid), done: false, cols: 1, title: `<b>${o.name}</b>像哪一种立体？` };
}

// ———— 练习 ————
function newKnowQ() {
  const sid = SHAPE_IDS[S.idx];
  const type = pick(['name', 'count', 'count', 'name']);
  if (type === 'name') {
    const others = shuffle(SHAPE_IDS.filter((s) => s !== sid)).slice(0, 2), ids = shuffle([sid, ...others]);
    S.q = { type, labels: ids.map((s) => NAMES[s]), correct: ids.indexOf(sid), done: false, cols: 1, title: '这是什么立体？', shape: sid };
  } else {
    const k = pick(['face', 'edge', 'vert']), c = total(k);
    const set = new Set([c]); const cand = shuffle([...Array(13).keys()].filter((x) => Math.abs(x - c) <= 4 && x !== c));
    while (set.size < 3) set.add(cand.pop());
    const nums = shuffle([...set]);
    S.q = { type, k, labels: nums.map(String), correct: nums.indexOf(c), done: false, cols: 3, title: `这个立体有几${k === 'edge' ? '条' : '个'}${KIND[k].zh}？` };
  }
}
function nextKnowQ() {
  let i; do { i = Math.floor(Math.random() * 6); } while (i === S.idx);
  loadShape(i); newKnowQ(); render();
}
function renderQuiz() {
  if (!S.q || S.q.type === 'life') newKnowQ();
  renderQuizPanel(false);
}
function renderQuizPanel(life) {
  const q = S.q;
  const tools = !life && q.type === 'count' ? toolsHTML() : '';
  panel.innerHTML = tabsHTML() + `<div class="quiz-q">${q.title}</div><div id="opts"></div><div class="fb" id="fb"></div>${tools}<button class="btn s6 green" data-a="qnext"${q.done ? '' : ' style="visibility:hidden"'}>下一题 ▶</button>`;
  const fb = panel.querySelector('#fb');
  if (q.done) {
    fb.className = 'fb ' + (q.ok ? 'good' : 'try'); fb.innerHTML = q.fbHTML;
    const m = mountOptions(panel.querySelector('#opts'), q.labels, q.correct, q.cols, () => {});
    m.btns.forEach((b, i) => { b.disabled = true; if (i === q.correct) b.classList.add('right'); else if (i === q.picked) b.classList.add('wrong'); });
  } else {
    idleFeedback(fb, q.type === 'count' ? '先数一数（点上面的「面」「边」「顶点」），再选答案。' : '看一看，选一个答案。');
    mountOptions(panel.querySelector('#opts'), q.labels, q.correct, q.cols, (ok, i) => {
      q.done = true; q.ok = ok; q.picked = i;
      const ans = q.labels[q.correct];
      const msg = ok ? (q.type === 'count' ? `真的有 ${ans}！` : `是「${ans}」。`) : (q.type === 'count' ? `正确答案是 ${ans}。看，这样一个一个数。` : `正确答案是「${ans}」。`);
      q.fbHTML = (ok ? '<span class="em">答对了！好棒！</span>' : '<span class="em">没关系，再看一看</span>') + msg;
      if (ok) burst(host);
      if (!ok && q.type === 'count') { S.mode = q.k; S.n = total(q.k); S.cur = -1; S.zero = S.n === 0; applyMarks(); }
      renderQuizPanel(life); nameTag();
    });
  }
}

// ———— 事件 ————
function onPanel(e) {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'keys') { toggleKeys(); render(); }
  else if (a === 'face' || a === 'edge' || a === 'vert') setMode(a);
  else if (a === 'step') step();
  else if (a === 'all') all();
  else if (a === 'clear') { S.name = false; clearMarks(); render(); }
  else if (a === 'name') { S.name = !S.name; render(); }
  else if (a === 'tab-know') { S.tab = 'know'; S.q = null; render(); }
  else if (a === 'tab-life') { S.tab = 'life'; S.q = null; S.lifeShown = false; render(); }
  else if (a === 'reveal') { S.lifeShown = !S.lifeShown; render(); }
  else if (a === 'lnext') lifeMove(1);
  else if (a === 'lprev') lifeMove(-1);
  else if (a === 'qnext') { if (S.tab === 'life') { S.life = (S.life + 1) % OBJECTS.length; S.q = null; render(); } else nextKnowQ(); }
}
function lifeMove(d) { S.life = (S.life + d + OBJECTS.length) % OBJECTS.length; S.lifeShown = false; S.q = null; render(); }

function onKey(e) {
  if (e.target.closest?.('input,textarea')) return;
  const teach = ctxRef.getMode() === 'teach';
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.type === 'keyup') return;
    if (!teach) { if (S.q?.done) panel.querySelector('[data-a="qnext"]')?.click(); return; }
    if (S.tab === 'life') { if (!S.lifeShown) { S.lifeShown = true; render(); } else lifeMove(1); return; }
    if (S.mode) step(); else if (!S.name) { S.name = true; render(); } else switchShape((S.idx + 1) % 6);
    return;
  }
  if (e.type !== 'keydown') return;
  if (e.key === 'r' || e.key === 'R') stage.reset();
  else if (e.key === 'Escape') { S.name = false; clearMarks(); render(); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const d = e.key === 'ArrowRight' ? 1 : -1;
    if (!teach) return;
    if (S.tab === 'life') lifeMove(d);
    else if (S.mode) (d > 0 ? step() : back());
    else switchShape((S.idx + d + 6) % 6);
  }
}

export default {
  title: 'M1 立体图形',
  mount(body, ctx) {
    ctxRef = ctx; markers = [];
    S = { tab: 'know', idx: 0, name: false, mode: null, n: 0, cur: -1, zero: false, life: 0, lifeShown: false, q: null };
    body.innerHTML = '<div class="stagecol"><div class="stage" id="host"></div><div class="chips" id="chips"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel'); chipsEl = body.querySelector('#chips');
    const r = stage.mount(host, { home, onFrame: frame });
    gl = r.ok;
    if (!gl) { host.insertAdjacentHTML('beforeend', ''); }
    shape = null;
    loadShape(0);
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { S.q = null; S.name = false; clearMarks(); render(); });
    render();
    window.__m1 = { S: () => S, shape: () => shape, switchShape, setMode, step, all, total, describe };
  },
  unmount() {
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    offMode?.();
    markers = []; shape = null;
    stage.unmount();
    delete window.__m1;
  },
};
