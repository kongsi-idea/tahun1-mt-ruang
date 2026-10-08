// M4 创意图案（7.2「创作图案」）与综合建模（7.1「综合制作新模型」）、小挑战（7.3）
import { stage, THREE } from '../core/stage3d.js';
import { FLAT, FLAT_IDS, flatSVG, flatIcon, PAL } from '../core/flat.js';
import { renderQuiz, shuffle, pick } from '../core/quiz.js';
import { buildShape, setMono, worldSegs, SHAPE_IDS, NAMES } from './shapes.js';
import { keysHTML, toggleKeys } from '../core/keys.js';

const rad = THREE.MathUtils.degToRad;
const W = 800, H = 560, GRID = 20, KB = 34;
const COLORS7 = [...PAL, '#FFFFFF'];
const CNAME = { '#F2564B': '红', '#FFC93C': '黄', '#3E8EDE': '蓝', '#46B97A': '绿', '#FF8A3D': '橙', '#8E6BD8': '紫', '#FFFFFF': '白' };
const DIMS = { cube: [1.7, 1.7, 1.7], cuboid: [2.4, 1.3, 1.6], pyramid: [1.9, 1.9, 1.9], cone: [1.8, 1.9, 1.8], cylinder: [1.7, 1.8, 1.7], sphere: [2, 2, 2] };
const SZ = [0.6, 0.85]; // 小、大
const K = [['<kbd>R</kbd>', '复位视角（立体）'], ['<kbd>Delete</kbd>', '删除选中的']];

let S, host, panel, flatEl, svgEl, gl, ctxRef, offMode, ro;
let items = [], nextId = 1;           // 平面
let objs = [], oid = 1;               // 立体
let drag = null, down = null;

// ═══════════ 平面图案 ═══════════
const snap = (v) => (S.snap ? Math.round(v / GRID) * GRID : Math.round(v));
function addItem(type, x, y, rot = 0, color = S.color) {
  const it = { id: nextId++, type, x, y, rot, color };
  items.push(it); S.sel = it.id; return it;
}
function freeSpot() {
  const n = items.length;
  const cx = S.mirror ? 220 : 400, cy = 280;
  return [cx + ((n * 90) % 270) - 90, cy + Math.floor((n * 90) / 270) * 80 - 60];
}
function planeSVG(forExport = false, opts = {}) {
  let g = '';
  if (!forExport && S.snap) {
    for (let x = GRID * 2; x < W; x += GRID * 2) for (let y = GRID * 2; y < H; y += GRID * 2) g += `<circle cx="${x}" cy="${y}" r="1.8" fill="#3B2A1A" opacity=".22"/>`;
  }
  if (S.mirror && !forExport) g += `<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#8E6BD8" stroke-width="3" stroke-dasharray="14 10" opacity=".8"/>`;
  const draw = (it, mirror) => flatSVG(it.type, { cx: mirror ? W - it.x : it.x, cy: it.y, k: KB, rot: mirror ? -it.rot : it.rot, flip: mirror, color: it.color, sw: 6, extra: mirror ? 'opacity=".95"' : `data-id="${it.id}" data-type="${it.type}" style="cursor:grab"` });
  if (S.mirror) items.forEach((it) => (g += draw(it, true)));
  items.forEach((it) => (g += draw(it, false)));
  const sel = items.find((i) => i.id === S.sel);
  if (sel && !forExport && !opts.readonly) g += `<circle cx="${sel.x}" cy="${sel.y}" r="${KB * 1.85}" fill="none" stroke="#3E8EDE" stroke-width="4" stroke-dasharray="10 8" pointer-events="none"/>`;
  const bg = forExport ? `<rect width="${W}" height="${H}" fill="#FFFFFF"/>` : '';
  return `<svg id="m4svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="我的图案">${bg}${g}</svg>`;
}
function paintPlane() {
  if (!flatEl) return;
  S._painted = S.quiz; flatEl.innerHTML = planeSVG(false, { readonly: S.quiz });
  svgEl = flatEl.querySelector('svg');
  if (!S.quiz) bindPlane();
}
function svgPoint(e) {
  const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const m = svgEl.getScreenCTM().inverse(); const p = pt.matrixTransform(m);
  return [p.x, p.y];
}
function bindPlane() {
  svgEl.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-id]');
    if (!t) { S.sel = null; paintPlane(); renderPanel(); return; }
    const id = +t.dataset.id, it = items.find((i) => i.id === id); S.sel = id;
    const [px, py] = svgPoint(e); drag = { id, dx: it.x - px, dy: it.y - py, moved: false };
    svgEl.setPointerCapture(e.pointerId); paintPlane(); renderPanel(); e.preventDefault();
  });
  svgEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const it = items.find((i) => i.id === drag.id); if (!it) return;
    const [px, py] = svgPoint(e);
    it.x = Math.min(W - 10, Math.max(10, snap(px + drag.dx))); it.y = Math.min(H - 10, Math.max(10, snap(py + drag.dy)));
    if (S.mirror) it.x = Math.min(W / 2, it.x);
    drag.moved = true; paintPlane();
  });
  const end = () => { drag = null; };
  svgEl.addEventListener('pointerup', end); svgEl.addEventListener('pointercancel', end);
}
export function planeExportSVG() { return planeSVG(true).replace(/ vector-effect="non-scaling-stroke"/g, ''); }
export function exportPNG(scale = 2) {
  return new Promise((resolve, reject) => {
    const svg = planeExportSVG().replace('<svg ', `<svg width="${W * scale}" height="${H * scale}" `);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'); };
    img.onerror = reject; img.src = url;
  });
}
async function downloadPNG() {
  try {
    const blob = await exportPNG(); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '我的图案.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    S.note = '已经存成「我的图案.png」。';
  } catch (e) { S.note = '这个浏览器不能存图片，请截屏。'; }
  renderPanel();
}
function genPattern() {
  const types = shuffle(FLAT_IDS).slice(0, 2 + Math.floor(Math.random() * 2)); // 2~3 种
  const n = 4 + Math.floor(Math.random() * 4);
  const cells = shuffle([...Array(12).keys()]).slice(0, n);
  items = []; S.mirror = false;
  cells.forEach((c, i) => { const type = i < types.length ? types[i] : pick(types); items.push({ id: nextId++, type, x: 140 + (c % 4) * 175, y: 120 + Math.floor(c / 4) * 150, rot: type === 'tri' ? pick([0, 180]) : type === 'rect' ? pick([0, 90]) : 0, color: pick(PAL) }); });
  S.sel = null;
}

// ═══════════ 立体建模（3D）═══════════
function orient(o) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rad(45 * o.ry));
  const t = new THREE.Quaternion();
  if (o.tilt === 1) t.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); else if (o.tilt === 2) t.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  return q.multiply(t);
}
export function boundsOf(o) {
  const [w, h, d] = DIMS[o.type], s = SZ[o.size] * 0.7, q = orient(o);
  let mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9);
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
    const v = new THREE.Vector3((sx * w) / 2, sy * h, (sz * d) / 2).multiplyScalar(s).applyQuaternion(q);
    mn.min(v); mx.max(v);
  }
  return { mn, mx };
}
const supports = (p) => ['cube', 'cuboid', 'sphere'].includes(p.type) || (p.type === 'cylinder' && p.tilt !== 1);
function relayout() {
  const order = [...objs].sort((a, b) => a.y - b.y || a.id - b.id), placed = [];
  for (const o of order) {
    const b = boundsOf(o); let top = 0;
    for (const p of placed) {
      const pb = boundsOf(p);
      const ox = Math.min(o.x + b.mx.x, p.x + pb.mx.x) - Math.max(o.x + b.mn.x, p.x + pb.mn.x), oz = Math.min(o.z + b.mx.z, p.z + pb.mx.z) - Math.max(o.z + b.mn.z, p.z + pb.mn.z);
      if (ox > 0.2 && oz > 0.2 && supports(p)) top = Math.max(top, p.y + pb.mx.y);
    }
    o.y = top - b.mn.y; o.top = o.y + b.mx.y; placed.push(o);
  }
  objs.forEach(applyObj);
}
function applyObj(o) {
  if (!o.shape) return;
  const g = o.shape.group, s = SZ[o.size] * 0.7;
  g.scale.setScalar(s); g.quaternion.copy(orient(o)); g.position.set(o.x, o.y, o.z);
  const b = boundsOf(o);
  if (o.blob) {
    const cx = o.x + (b.mn.x + b.mx.x) / 2, cz = o.z + (b.mn.z + b.mx.z) / 2;
    o.blob.position.set(cx, 0.003, cz);
    o.blob.scale.set((b.mx.x - b.mn.x) * 1.35, (b.mx.z - b.mn.z) * 1.35, 1);
    o.blob.material.opacity = o.y < 0.05 ? 0.3 : 0;
    o.blob.visible = o.y < 0.05;
  }
  const sel = S.selO === o.id;
  o.shape.faces.forEach((f) => f.mesh.material.emissive.set(sel ? '#FFC93C' : '#000000').multiplyScalar(sel ? 0.22 : 0));
}
function makeObj(spec) {
  const o = { id: oid++, type: spec.type, color: spec.color ?? '#FFC93C', size: spec.size ?? 1, ry: spec.ry ?? 0, tilt: spec.tilt ?? 0, x: spec.x ?? 0, z: spec.z ?? 0, y: 0, top: 0 };
  o.shape = buildShape(o.type); setMono(o.shape, o.color);
  o.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stage.blobTex, transparent: true, opacity: 0.3, depthWrite: false }));
  o.blob.rotation.x = -Math.PI / 2; o.blob.renderOrder = -1;
  o.shape.group.userData.type = o.type; o.shape.group.userData.oid = o.id;
  stage.content.add(o.shape.group, o.blob); objs.push(o); return o;
}
function removeObj(o) {
  stage.content.remove(o.shape.group, o.blob);
  o.shape.group.traverse((x) => { x.geometry?.dispose(); if (x.material && !x.material.userData?.shared) x.material.dispose(); });
  o.blob.material.dispose(); o.blob.geometry.dispose();
  objs = objs.filter((x) => x !== o);
}
function clearObjs() { [...objs].forEach(removeObj); S.selO = null; }
function freeSpot3() {
  const spots = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2], [4, 0], [-4, 0]];
  for (const [x, z] of spots) if (!objs.some((o) => Math.abs(o.x - x) < 1.3 && Math.abs(o.z - z) < 1.3)) return [x, z];
  return [0, 0];
}
function addSolid(type) {
  const [x, z] = freeSpot3();
  const o = makeObj({ type, x, z, color: S.color3 }); S.selO = o.id; relayout(); renderPanel();
}
export const EXAMPLES = {
  rocket: { name: '火箭', parts: [{ type: 'cylinder', color: '#FFFFFF', size: 1 }, { type: 'cone', color: '#F2564B', size: 1 }] },
  house: { name: '房子', parts: [{ type: 'cube', color: '#FFC93C', size: 1 }, { type: 'pyramid', color: '#F2564B', size: 1 }] },
  snowman: { name: '雪人', parts: [{ type: 'sphere', color: '#FFFFFF', size: 1 }, { type: 'sphere', color: '#FFFFFF', size: 0 }] },
};
function loadExample(key) {
  clearObjs();
  EXAMPLES[key].parts.forEach((p) => makeObj({ ...p, x: 0, z: 0 }));
  // 先放下面的，再放上面的：依次叠上去
  S.selO = null; relayout(); S.exKey = key; S.shown = false;
}
export function modelTypes() { return [...new Set(objs.map((o) => o.type))]; }
export function countOfType(t) { return objs.filter((o) => o.type === t).length; }
// 自动检查用：从 3D 场景里真正存在的物件数出来
export function sceneCount(t) { return stage.content.children.filter((c) => c.userData?.type === t).length; }

function genModel() {
  clearObjs(); S.exKey = null;
  const types = shuffle(SHAPE_IDS).slice(0, 1 + Math.floor(Math.random() * 3));
  const sup = types.filter((t) => ['cube', 'cuboid', 'sphere', 'cylinder'].includes(t));
  const spots = shuffle([[-2.4, 0], [0, 0], [2.4, 0], [-1.2, 2.3], [1.2, 2.3]]);
  const cols = 2 + Math.floor(Math.random() * 2);
  for (let c = 0; c < cols; c++) {
    const [x, z] = spots[c];
    const tall = sup.length && Math.random() < 0.7 && c < 2;
    const low = tall ? pick(sup) : pick(types);
    makeObj({ type: low, x, z, color: pick(COLORS7), size: 1 });
    if (tall) makeObj({ type: pick(types), x, z, color: pick(COLORS7), size: 1 });
  }
  S.selO = null; relayout();
}
function load3Home() {
  stage.controls.maxDistance = 20;
  const asp = stage.size.w / stage.size.h;
  const h = { target: new THREE.Vector3(0, 0.7, 0.5), sph: new THREE.Spherical(asp < 1.25 ? 13.5 : 11.5, rad(58), rad(25)) };
  stage.setHome(() => h); stage.fly = null; stage.controls.enabled = true; stage.place(h.target, h.sph);
}
function frame() {
  if (!gl || S.tab === 'plane') return;
  const segs = [];
  for (const o of objs) { o.shape.update(stage.camera); segs.push(...worldSegs(o.shape)); }
  stage.cornerSegs = segs;
}

// 3D 拖拽：点中立体就拖它，点空白处才转镜头
const _ray = new THREE.Raycaster(), _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function ptr(e) { const r = stage.renderer.domElement.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
function groundHit(e) { _ray.setFromCamera(ptr(e), stage.camera); const v = new THREE.Vector3(); return _ray.ray.intersectPlane(_pl, v) ? v : null; }
function onDown3(e) {
  if (S.tab === 'plane' || S.quiz || !gl) return;
  _ray.setFromCamera(ptr(e), stage.camera);
  const meshes = objs.flatMap((o) => o.shape.faces.map((f) => f.mesh));
  const hit = _ray.intersectObjects(meshes, false)[0];
  down = { x: e.clientX, y: e.clientY, hit: !!hit };
  if (!hit) return;
  const o = objs.find((q) => q.shape.faces.some((f) => f.mesh === hit.object)); if (!o) return;
  S.selO = o.id; const gp = groundHit(e) || new THREE.Vector3();
  drag = { o, dx: o.x - gp.x, dz: o.z - gp.z };
  stage.controls.enabled = false; e.stopPropagation(); e.preventDefault();
  relayout(); renderPanel();
}
function onMove3(e) {
  if (!drag || !drag.o) return;
  const gp = groundHit(e); if (!gp) return;
  let x = Math.round((gp.x + drag.dx) * 2) / 2, z = Math.round((gp.z + drag.dz) * 2) / 2;
  for (const p of objs) if (p !== drag.o && Math.abs(p.x - x) < 0.55 && Math.abs(p.z - z) < 0.55) { x = p.x; z = p.z; } // 简易吸附：靠近就对齐中心
  drag.o.x = Math.max(-6, Math.min(6, x)); drag.o.z = Math.max(-6, Math.min(6, z)); drag.moved = true;
  relayout();
}
function onUp3(e) {
  if (drag?.o) { drag = null; stage.controls.enabled = true; renderPanel(); return; }
  if (down && !down.hit && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && S.selO) { S.selO = null; objs.forEach(applyObj); renderPanel(); }
  down = null;
}

// ═══════════ 面板 ═══════════
const TABS = [['plane', '平面图案'], ['solid', '立体建模'], ['chal', '小挑战']];
const tabsHTML = () => `<div class="tabs grid g3">${TABS.map(([k, t]) => `<button class="btn small${S.tab === k ? ' on' : ''}" data-a="tab-${k}">${t}</button>`).join('')}</div>`;
const KEYS = () => keysHTML(K);
const swatches = (cur, act) => `<div class="chiprow">${COLORS7.map((c) => `<button class="btn sw${cur === c ? ' on' : ''}" data-a="${act}-${c.slice(1)}" aria-label="${CNAME[c]}色" style="background:${c}"></button>`).join('')}</div>`;
const freeToggle = () => ctxRef.getMode() === 'practice' && S.tab !== 'chal' ? `<div class="row2"><button class="btn small${S.quiz ? ' on' : ''}" data-a="mode-quiz">出题</button><button class="btn small${!S.quiz ? ' on' : ''}" data-a="mode-free">自由创作</button></div>` : '';

function renderPanel() {
  if (!panel) return;
  const practice = ctxRef.getMode() === 'practice';
  S.quiz = practice && !S.free && S.tab !== 'chal';
  if (S.tab === 'plane' && !S.quiz && S._painted) paintPlane();
  if (S.tab === 'plane') panelPlane(practice);
  else if (S.tab === 'solid') panelSolid(practice);
  else panelChal(practice);
}
function panelPlane(practice) {
  const sel = items.find((i) => i.id === S.sel);
  if (S.quiz) {
    if (!S.q || S.q.kind !== 'plane') { genPattern(); const used = [...new Set(items.map((i) => i.type))]; const four = FLAT_IDS; S.q = { kind: 'plane', title: '这个图案用了哪些图形？', multi: true, labels: four.map((id) => FLAT[id].name), correctSet: used.map((u) => four.indexOf(u)), cols: 4, goodMsg: '你都找到了。', badMsg: '用到的图形：' + used.map((u) => FLAT[u].name).join('、') + '。' }; paintPlane(); }
    panel.innerHTML = tabsHTML() + freeToggle() + '<div id="qbox" class="qbox"></div>';
    renderQuiz(panel.querySelector('#qbox'), S.q, { next: () => { S.q = null; renderPanel(); }, burstHost: host });
    return;
  }
  panel.innerHTML = tabsHTML() + freeToggle() +
    `<div class="mini-note">放一个图形</div><div class="pickshape">${FLAT_IDS.map((id) => `<button class="btn small" data-a="add-${id}" aria-label="加${FLAT[id].name}">${flatIcon(id, S.color, 40)}</button>`).join('')}</div>` +
    `<div class="mini-note">颜色（点一下换色）</div>${swatches(sel ? sel.color : S.color, 'pcolor')}` +
    `<div class="tool-grid"><button class="btn" data-a="rot"${sel ? '' : ' disabled'}>↻ 转45°</button><button class="btn" data-a="dup"${sel ? '' : ' disabled'}>复制</button><button class="btn red" data-a="del"${sel ? '' : ' disabled'}>删除</button></div>` +
    `<div class="row2"><button class="btn small${S.mirror ? ' on' : ''}" data-a="mirror">镜像：${S.mirror ? '开' : '关'}</button><button class="btn small${S.snap ? ' on' : ''}" data-a="snap">吸附格线：${S.snap ? '开' : '关'}</button></div>` +
    `<div class="row2"><button class="btn small" data-a="pclear"${items.length ? '' : ' disabled'}>清空</button><button class="btn small green" data-a="png"${items.length ? '' : ' disabled'}>下载图片</button></div><div class="mini-note">${S.note || (sel ? '拖一拖可以移动。' : '点一个图形，再拖到想放的位置。')}</div>` + (practice ? '' : KEYS());
}
function panelSolid(practice) {
  const sel = objs.find((o) => o.id === S.selO);
  if (S.quiz) {
    if (!S.q || S.q.kind !== 'solid') {
      if (Math.random() < 0.5) { const k = pick(Object.keys(EXAMPLES)); loadExample(k); S.qname = EXAMPLES[k].name; } else { genModel(); S.qname = '这个模型'; }
      const used = modelTypes(), pool = shuffle([...used, ...shuffle(SHAPE_IDS.filter((t) => !used.includes(t)))]).slice(0, Math.max(4, used.length)), opts = shuffle(pool);
      S.q = { kind: 'solid', title: `${S.qname}用了哪些立体？`, multi: true, labels: opts.map((t) => NAMES[t]), correctSet: used.map((u) => opts.indexOf(u)), cols: 4, goodMsg: '你都找到了。', badMsg: '用到的立体：' + used.map((u) => NAMES[u]).join('、') + '。', hint: '可以选好几个，选好了按「确定」。' };
    }
    panel.innerHTML = tabsHTML() + freeToggle() + '<div id="qbox" class="qbox"></div>';
    renderQuiz(panel.querySelector('#qbox'), S.q, { next: () => { S.q = null; renderPanel(); }, burstHost: host });
    return;
  }
  const summary = S.shown ? (objs.length ? `用了 ${objs.length} 个立体：` + modelTypes().map((t) => `${NAMES[t]}×${countOfType(t)}`).join('、') : '还没有放立体。') : '想让学生说说「用了哪些立体」，就按下面的按钮。';
  panel.innerHTML = tabsHTML() + freeToggle() +
    `<div class="mini-note">放一个立体</div><div class="tool-grid">${SHAPE_IDS.map((t) => `<button class="btn small" data-a="addS-${t}">${NAMES[t].replace('体', '')}</button>`).join('')}</div>` +
    `<div class="mini-note">颜色</div>${swatches(sel ? sel.color : S.color3, 'scolor')}` +
    `<div class="tool-grid"><button class="btn" data-a="srot"${sel ? '' : ' disabled'}>↻ 转向</button><button class="btn" data-a="stilt"${sel ? '' : ' disabled'}>翻倒</button><button class="btn" data-a="ssize"${sel ? '' : ' disabled'}>大小</button><button class="btn" data-a="sdup"${sel ? '' : ' disabled'}>复制</button><button class="btn red" data-a="sdel"${sel ? '' : ' disabled'}>删除</button><button class="btn" data-a="sclear"${objs.length ? '' : ' disabled'}>清空</button></div>` +
    `<div class="mini-note">范例（一键载入）</div><div class="tool-grid">${Object.entries(EXAMPLES).map(([k, e]) => `<button class="btn small yellow" data-a="ex-${k}">${e.name}</button>`).join('')}</div>` +
    `<div class="grp6"><button class="btn s6 blue" data-a="sshow">${S.shown ? '收起' : '用了哪些立体？'}</button></div><div class="readout"><div class="line">${summary}</div></div>` + (practice ? '' : KEYS());
}
function panelChal(practice) {
  if (!S.ch) newChal();
  const c = S.ch;
  if (!practice) {
    panel.innerHTML = tabsHTML() + `<div class="readout"><div class="q">小挑战：用了几个${NAMES[c.type]}？</div><div class="line">${c.shown ? `<b>答案：${c.answer} 个</b>` : '数一数，再按「揭晓」。'}</div></div><div class="grp6"><button class="btn s6 red" data-a="chreveal">${c.shown ? '再藏起来' : '揭晓'}</button><button class="btn s6 green" data-a="chnext">换一题 ▶</button></div>` + KEYS();
  } else {
    panel.innerHTML = tabsHTML() + '<div id="qbox" class="qbox"></div>';
    renderQuiz(panel.querySelector('#qbox'), c.q, { next: () => { S.ch = null; panelChalRebuild(); }, burstHost: host });
  }
}
function panelChalRebuild() { renderPanel(); }
function newChal() {
  genModel();
  const types = modelTypes(), type = pick(types), answer = countOfType(type);
  // 答案要和 3D 场景里真正的物件数一致，不一致就重来
  let guard = 0; let t = type, a = answer;
  while (sceneCount(t) !== a && guard++ < 5) { genModel(); t = pick(modelTypes()); a = countOfType(t); }
  const nums = new Set([a]); const cand = shuffle([...Array(8).keys()].filter((x) => x !== a && Math.abs(x - a) <= 3 && x > 0));
  while (nums.size < 3) nums.add(cand.pop());
  const arr = shuffle([...nums]);
  S.ch = { type: t, answer: a, shown: false, verified: sceneCount(t) === a, q: { title: `用了几个${NAMES[t]}？`, labels: arr.map(String), correct: arr.indexOf(a), cols: 3, goodMsg: `数一数，是 ${a} 个。`, badMsg: `正确答案是 ${a} 个。` } };
}

function setTab(t) {
  S.tab = t; S.q = null; S.note = ''; S.ch = null; S.shown = false;
  host.classList.toggle('svg-on', t === 'plane'); stage.paused = t === 'plane' || !gl;
  flatEl.style.display = t === 'plane' ? '' : 'none';
  if (gl) {
    if (t === 'plane') { stage.clear(); objs = []; stage.cornerSegs = []; }
    else { stage.clear(); objs = []; stage.cornerSegs = []; load3Home(); S.selO = null; if (t === 'chal') { newChal(); } }
  }
  if (t === 'plane') { if (S.quiz) { items = []; } paintPlane(); }
  renderPanel();
  if (t === 'chal' && gl) {} 
}
function enterQuizOrFree(quiz) {
  S.free = !quiz; S.q = null; S.note = '';
  if (S.tab === 'plane') { items = []; if (!quiz) { S.sel = null; } paintPlane(); }
  else if (S.tab === 'solid') { clearObjs(); if (!quiz) { S.shown = false; } }
  renderPanel();
}

function onPanel(e) {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a, sel = items.find((i) => i.id === S.sel), so = objs.find((o) => o.id === S.selO);
  if (a === 'keys') { toggleKeys(); renderPanel(); }
  else if (a.startsWith('tab-')) setTab(a.slice(4));
  else if (a === 'mode-quiz') enterQuizOrFree(true);
  else if (a === 'mode-free') enterQuizOrFree(false);
  else if (a.startsWith('add-')) { const [x, y] = freeSpot(); addItem(a.slice(4), snap(x), snap(y)); S.note = ''; paintPlane(); renderPanel(); }
  else if (a.startsWith('pcolor-')) { const c = '#' + a.slice(7); S.color = c; if (sel) sel.color = c; paintPlane(); renderPanel(); }
  else if (a === 'rot' && sel) { sel.rot = (sel.rot + 45) % 360; paintPlane(); }
  else if (a === 'dup' && sel) { const n = addItem(sel.type, Math.min(W / (S.mirror ? 2 : 1) - 20, sel.x + 40), Math.min(H - 20, sel.y + 40), sel.rot, sel.color); paintPlane(); renderPanel(); }
  else if (a === 'del' && sel) { items = items.filter((i) => i !== sel); S.sel = null; paintPlane(); renderPanel(); }
  else if (a === 'pclear') { items = []; S.sel = null; paintPlane(); renderPanel(); }
  else if (a === 'mirror') { S.mirror = !S.mirror; if (S.mirror) items.forEach((i) => (i.x = Math.min(i.x, W / 2))); paintPlane(); renderPanel(); }
  else if (a === 'snap') { S.snap = !S.snap; paintPlane(); renderPanel(); }
  else if (a === 'png') downloadPNG();
  else if (a.startsWith('addS-')) addSolid(a.slice(5));
  else if (a.startsWith('scolor-')) { const c = '#' + a.slice(7); S.color3 = c; if (so) { so.color = c; setMono(so.shape, c); applyObj(so); } renderPanel(); }
  else if (a === 'srot' && so) { so.ry = (so.ry + 1) % 8; relayout(); }
  else if (a === 'stilt' && so) { so.tilt = (so.tilt + 1) % 3; relayout(); }
  else if (a === 'ssize' && so) { so.size = 1 - so.size; relayout(); }
  else if (a === 'sdup' && so) { const bb = boundsOf(so), n = makeObj({ type: so.type, color: so.color, size: so.size, ry: so.ry, tilt: so.tilt, x: so.x + (bb.mx.x - bb.mn.x) + 0.2, z: so.z }); S.selO = n.id; relayout(); renderPanel(); }
  else if (a === 'sdel' && so) { removeObj(so); S.selO = null; relayout(); renderPanel(); }
  else if (a === 'sclear') { clearObjs(); renderPanel(); }
  else if (a.startsWith('ex-')) { loadExample(a.slice(3)); renderPanel(); }
  else if (a === 'sshow') { S.shown = !S.shown; renderPanel(); }
  else if (a === 'chreveal') { S.ch.shown = !S.ch.shown; renderPanel(); }
  else if (a === 'chnext') { S.ch = null; renderPanel(); }
}
function onKey(e) {
  if (e.type !== 'keydown') { if (e.code === 'Space') e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R') stage.reset();
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.tab === 'plane' && S.sel) { items = items.filter((i) => i.id !== S.sel); S.sel = null; paintPlane(); renderPanel(); }
    else if (S.tab === 'solid' && S.selO) { const o = objs.find((q) => q.id === S.selO); if (o) { removeObj(o); S.selO = null; relayout(); renderPanel(); } }
  } else if (e.code === 'Space' && S.tab === 'chal' && ctxRef.getMode() === 'teach') { S.ch.shown = !S.ch.shown; renderPanel(); }
}

export default {
  title: '创意图案',
  mount(body, ctx) {
    ctxRef = ctx; items = []; objs = []; drag = null; down = null;
    S = { tab: 'plane', color: PAL[0], color3: '#FFC93C', sel: null, selO: null, mirror: false, snap: true, q: null, note: '', free: undefined, quiz: false, shown: false, ch: null };
    body.innerHTML = '<div class="stagecol"><div class="stage" id="host"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel');
    gl = stage.mount(host, { home: () => ({ target: new THREE.Vector3(0, 0.9, 0), sph: new THREE.Spherical(10, rad(60), rad(25)) }), onFrame: frame }).ok;
    const cv = host.querySelector('.cv') || host;
    flatEl = document.createElement('div'); flatEl.className = 'm4wrap'; cv.appendChild(flatEl);
    if (gl) { cv.addEventListener('pointerdown', onDown3, true); window.addEventListener('pointermove', onMove3); window.addEventListener('pointerup', onUp3); }
    host.classList.add('svg-on'); stage.paused = true;
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { S.q = null; S.free = undefined; S.ch = null; S.shown = false; if (S.tab === 'plane') { items = []; S.sel = null; paintPlane(); } else if (gl) { clearObjs(); } renderPanel(); });
    // 练习模式预设为出题
    S.free = undefined;
    paintPlane(); renderPanel();
    window.__m4 = { S: () => S, items: () => items, objs: () => objs, exportPNG, planeExportSVG, boundsOf, setTab, EXAMPLES, loadExample, modelTypes, countOfType, sceneCount, addSolid, relayout, genModel, newChal, planeSVG };
  },
  unmount() {
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    window.removeEventListener('pointermove', onMove3); window.removeEventListener('pointerup', onUp3);
    offMode?.(); objs = []; items = []; drag = null;
    stage.unmount(); delete window.__m4;
  },
};
