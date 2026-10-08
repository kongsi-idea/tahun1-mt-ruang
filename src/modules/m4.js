// M4 创意图案（7.2「创作图案」）与综合建模（7.1「综合制作新模型」）、小挑战（7.3）
import { stage, THREE } from '../core/stage3d.js';
import { FLAT, FLAT_IDS, flatSVG, flatIcon, PAL } from '../core/flat.js';
import { renderQuiz, shuffle, pick, burst } from '../core/quiz.js';
import { genCount, genSym, genCopy, matchParts, bboxUnits, KC, CW, CH, AX, countTitle, solidLabel } from './m4data.js';
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
function load3HomeObj() { const asp = stage.size.w / stage.size.h; return { target: new THREE.Vector3(0, 0.7, 0.5), sph: new THREE.Spherical(asp < 1.25 ? 13.5 : 11.5, rad(58), rad(25)) }; }
function load3Home() {
  stage.controls.maxDistance = 20;
  const h = load3HomeObj();
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
  if (S.tab === 'plane' || S.tab === 'chal' || S.quiz || !gl) return;
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
// ═══════════ 小挑战（SPEC §8-5）：数图形／补对称／照样拼／数立体 ═══════════
const CSUBS = [['count', '数图形'], ['sym', '补对称'], ['copy', '照样拼'], ['solid', '数立体']];
const subsHTML = () => `<div class="row2">${CSUBS.map(([k, t]) => `<button class="btn small${S.cs === k ? ' on' : ''}" data-a="cs-${k}">${t}</button>`).join('')}</div>`;
const ASK_COL = ['#F2564B', '#3E8EDE'];
let chSvg = null, chDrag = null;

// 题目与状态
function newChalQ() {
  S.cq = null; S.shownAns = false; S.mine = []; S.csel = null; S.hintIds = []; S.checked = null; S.cdone = false; S.qz = null; S.hid = false;
  if (S.cs === 'count') {
    const q = genCount(); S.cq = q;
    S.qz = { title: countTitle(q), labels: q.optionLabels, correct: q.correct, cols: q.asks.length === 1 ? 3 : 1, goodMsg: `数一数，真的是 ${q.labelOf(q.answer)}。`, badMsg: `正确答案是 ${q.labelOf(q.answer)}。看，一个一个数。`, onDone: () => { S.shownAns = true; paintCh(); } };
  } else if (S.cs === 'sym') S.cq = genSym();
  else if (S.cs === 'copy') S.cq = genCopy();
  else if (S.cs === 'solid') newSolidChal();
}

// ——— 平面三种：画面 ———
function chalInner() {
  const q = S.cq; let g = '';
  const ink = (p, extra = '', color = p.color, sw = 6) => flatSVG(p.t, { cx: p.x, cy: p.y, k: KC, rot: p.r, color, sw, extra });
  if (S.cs === 'count') {
    const bb = bboxUnits(q.pic.parts), s = Math.min(380 / (bb.w * KC), 340 / (bb.h * KC), 1.25), k = KC * s;
    const cnt = q.asks.map(() => 0);
    q.pic.parts.forEach((p) => {
      const cx = 240 + p.x * s * KC, cy = 210 + p.y * s * KC;
      g += flatSVG(p.t, { cx, cy, k, rot: p.r, color: p.color, sw: 6, extra: `data-shape="${p.t}"` });
    });
    q.pic.parts.forEach((p) => {
      const cx = 240 + p.x * s * KC, cy = 210 + p.y * s * KC;
      const ai = q.asks.indexOf(p.t);
      if (S.shownAns && ai >= 0) { cnt[ai]++; g += `<circle cx="${cx}" cy="${cy}" r="${k * 1.5}" fill="none" stroke="${ASK_COL[ai]}" stroke-width="6" stroke-dasharray="10 8"/><circle cx="${cx + k * 1.1}" cy="${cy - k * 1.1}" r="17" fill="#3B2A1A"/><text x="${cx + k * 1.1}" y="${cy - k * 1.1 + 8}" font-size="23" font-weight="900" fill="#fff" text-anchor="middle">${cnt[ai]}</text>`; }
    });
    return g;
  }
  const sym = S.cs === 'sym';
  g += `<line x1="${AX}" y1="0" x2="${AX}" y2="${CH}" stroke="${sym ? '#8E6BD8' : '#3B2A1A'}" stroke-width="${sym ? 5 : 3}" stroke-dasharray="${sym ? '14 10' : '4 10'}" opacity="${sym ? 0.85 : 0.4}"/>`;
  q.left.forEach((p) => (g += ink(p, 'data-lock="1"')));
  const showT = S.shownAns ? q.target : S.hintIds.map((i) => q.target[i]);
  showT.forEach((p) => (g += flatSVG(p.t, { cx: p.x, cy: p.y, k: KC, rot: p.r, color: 'rgba(62,142,222,.16)', sw: 4, extra: 'data-ghost="1"' })));
  const res = S.checked, wrongSet = new Set(res ? res.extra : []);
  S.mine.forEach((m, j) => {
    g += ink(m, `data-id="${m.id}"`);
    if (wrongSet.has(j)) g += `<circle cx="${m.x}" cy="${m.y}" r="${KC * 1.4}" fill="none" stroke="#F2564B" stroke-width="6" pointer-events="none"/>`;
    if (m.id === S.csel) g += `<circle cx="${m.x}" cy="${m.y}" r="${KC * 1.85}" fill="none" stroke="#3E8EDE" stroke-width="4" stroke-dasharray="10 8" pointer-events="none"/>`;
  });
  if (res) res.missing.forEach((i) => { const p = q.target[i]; g += `<circle cx="${p.x}" cy="${p.y}" r="${KC * 1.4}" fill="none" stroke="#F2564B" stroke-width="5" stroke-dasharray="9 7" pointer-events="none"/>`; });
  S.mine.forEach((m) => (g += `<circle cx="${m.x}" cy="${m.y}" r="${KC * 1.3}" fill="transparent" data-id="${m.id}" style="cursor:grab"/>`));
  return g;
}
function paintCh() {
  if (!flatEl || S.tab !== 'chal' || S.cs === 'solid') return;
  if (!chSvg || !chSvg.isConnected) {
    flatEl.innerHTML = `<svg id="m4svg" viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="小挑战" style="touch-action:none"></svg>`;
    chSvg = flatEl.querySelector('svg'); svgEl = chSvg;
    chSvg.addEventListener('pointerdown', chDown); chSvg.addEventListener('pointermove', chMove);
    chSvg.addEventListener('pointerup', chUp); chSvg.addEventListener('pointercancel', chUp);
  }
  chSvg.innerHTML = chalInner();
  S.cq && (S.cq.verified = S.cs === 'count' ? chSvg.querySelectorAll('[data-shape]').length === S.cq.pic.parts.length : true);
}
function chPoint(e) { const pt = chSvg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(chSvg.getScreenCTM().inverse()); return [p.x, p.y]; }
function chDown(e) {
  if (S.cs !== 'sym' && S.cs !== 'copy') return;
  const t = e.target.closest('[data-id]');
  if (!t) { S.csel = null; paintCh(); renderPanel(); return; }
  const id = +t.dataset.id, m = S.mine.find((i) => i.id === id); if (!m) return;
  S.csel = id; S.checked = null; const [px, py] = chPoint(e); chDrag = { id, dx: m.x - px, dy: m.y - py };
  try { chSvg.setPointerCapture(e.pointerId); } catch (er) {}
  paintCh(); renderPanel(); e.preventDefault();
}
function chMove(e) {
  if (!chDrag) return;
  const m = S.mine.find((i) => i.id === chDrag.id); if (!m) return;
  const [px, py] = chPoint(e), sn = (v) => Math.round(v / 10) * 10;
  m.x = Math.min(CW - 12, Math.max(12, sn(px + chDrag.dx))); m.y = Math.min(CH - 12, Math.max(12, sn(py + chDrag.dy)));
  paintCh();
}
function chUp() { if (chDrag) { chDrag = null; renderPanel(); } }
let midSeq = 1;
// 放一个新图形：颜色取「还没用过颜色的同形状目标」的颜色，放在右半边空位
function chAdd(t) {
  const q = S.cq, used = new Set(S.mine.map((m) => m.ci).filter((x) => x != null));
  const ci = q.target.findIndex((p, i) => p.t === t && !used.has(i));
  const color = ci >= 0 ? q.target[ci].color : PAL[0];
  let pos = null;
  for (const y of [70, 160, 250, 340]) for (const x of [300, 420]) if (!pos && !S.mine.some((m) => Math.hypot(m.x - x, m.y - y) < 60)) pos = [x, y];
  if (!pos) pos = [270 + Math.floor(Math.random() * 180), 60 + Math.floor(Math.random() * 300)];
  const m = { id: midSeq++, t, x: pos[0], y: pos[1], r: 0, color, ci: ci >= 0 ? ci : null };
  S.mine.push(m); S.csel = m.id; S.checked = null;
}
function chCheck() {
  const res = matchParts(S.cq.target, S.mine);
  S.checked = res; S.cdone = res.ok; S.shownAns = S.shownAns;
  if (res.ok) burst(host);
  paintCh(); renderPanel();
}
function chHint() {
  const res = matchParts(S.cq.target, S.mine), have = new Set(S.hintIds);
  const next = res.missing.find((i) => !have.has(i));
  if (next != null) S.hintIds.push(next);
  paintCh(); renderPanel();
}
const chMsg = () => {
  const r = S.checked; if (!r) return '';
  if (r.ok) return S.cs === 'sym' ? '完成了！左右刚好对称。' : '完成了！和目标一模一样。';
  const parts = [];
  if (r.extra.length) parts.push(`红色圈住的 ${r.extra.length} 块放错了（位置、形状或方向不对）`);
  if (r.missing.length) parts.push(`虚线圈 ${r.missing.length} 处还缺图形`);
  return parts.join('；') + '。';
};

// ——— 数立体：3D，要转着看 ———
// 被挡住的程度：用每个立体的外接盒（缩小一点，偏保守）当挡板，数「看得到的取样点」占几成
const _vray = new THREE.Ray(), _hit = new THREE.Vector3();
function worldBox(o) { const b = boundsOf(o); return new THREE.Box3(new THREE.Vector3(o.x + b.mn.x, o.y + b.mn.y, o.z + b.mn.z), new THREE.Vector3(o.x + b.mx.x, o.y + b.mx.y, o.z + b.mx.z)); }
function samplePts(box) {
  const c = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5), out = [c.clone()];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(new THREE.Vector3(c.x + sx * h.x * 0.5, c.y + sy * h.y * 0.5, c.z + sz * h.z * 0.5));
  [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(([x, y, z]) => out.push(new THREE.Vector3(c.x + x * h.x * 0.7, c.y + y * h.y * 0.7, c.z + z * h.z * 0.7)));
  return out;
}
export function visRatio(o, camPos) {
  const others = objs.filter((q) => q !== o).map((q) => { const b = worldBox(q); const sh = b.getSize(new THREE.Vector3()).multiplyScalar(0.1); b.min.add(sh); b.max.sub(sh); return b; });
  const pts = samplePts(worldBox(o)); let n = 0;
  for (const p of pts) {
    const d = p.distanceTo(camPos); _vray.set(camPos, p.clone().sub(camPos).normalize());
    let blocked = false;
    for (const b of others) { const h = _vray.intersectBox(b, _hit); if (h && _hit.distanceTo(camPos) < d - 0.05) { blocked = true; break; } }
    if (!blocked) n++;
  }
  return n / pts.length;
}
const camAt = (az) => new THREE.Vector3(0, 0.7, 0.5).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(12, rad(58), rad(az))));
const SUP = ['cube', 'cuboid', 'sphere', 'cylinder'];
export function genHiddenModel() {
  for (let a = 0; a < 400; a++) {
    clearObjs();
    const types = shuffle(SHAPE_IDS).slice(0, 2 + Math.floor(Math.random() * 2));
    const sup = types.filter((t) => SUP.includes(t)); if (!sup.length) continue;
    const xs = shuffle([-2.4, 0, 2.4]).slice(0, 2 + Math.floor(Math.random() * 2));
    xs.forEach((x) => {
      makeObj({ type: pick(sup), x, z: 0.4, color: pick(COLORS7), size: 1 });
      if (Math.random() < 0.65) makeObj({ type: pick(types), x, z: 0.4, color: pick(COLORS7), size: 1 });
    });
    const nb = 1 + Math.floor(Math.random() * 2);
    shuffle(xs).slice(0, nb).forEach((x) => makeObj({ type: pick(types), x: x + (Math.random() < 0.5 ? 0 : 0.5), z: -1.9, color: pick(COLORS7), size: 0 }));
    if (objs.length < 4 || objs.length > 8) continue;
    S.selO = null; relayout();
    const home = camAt(25);
    const rs = objs.map((o) => visRatio(o, home));
    if (!rs.some((r) => r < 0.2)) continue;
    let ok = true;
    for (const o of objs) { let best = 0; for (let az = 0; az < 360; az += 90) best = Math.max(best, visRatio(o, camAt(az))); if (best < 0.7) { ok = false; break; } }
    if (!ok) continue;
    return { ratios: rs, hidden: objs.filter((_, i) => rs[i] < 0.2).map((o) => o.id) };
  }
  return null;
}
function newSolidChal() {
  if (!gl) return;
  stage.clear(); objs = []; stage.cornerSegs = []; load3Home();
  let info = genHiddenModel(), guard = 0;
  while (!info && guard++ < 5) info = genHiddenModel();
  const counts = {}; objs.forEach((o) => (counts[o.type] = (counts[o.type] || 0) + 1));
  const visCounts = {}; objs.forEach((o, i) => { if (!info.hidden.includes(o.id)) visCounts[o.type] = (visCounts[o.type] || 0) + 1; });
  const lab = (c) => solidLabel(c, NAMES), ans = lab(counts);
  const opts = [ans, lab(visCounts)];
  for (let t = 0; t < 100 && opts.length < 3; t++) {
    const c = { ...counts }, ks = Object.keys(c);
    if (Math.random() < 0.5) { const k = pick(ks); c[k] += pick([1, 1, -1]); if (c[k] <= 0) delete c[k]; } else { const k = pick(ks), nt = pick(SHAPE_IDS.filter((x) => !c[x])); if (nt) { c[nt] = c[k]; delete c[k]; } }
    const l = lab(c); if (l && !opts.includes(l)) opts.push(l);
  }
  const labels = shuffle(opts);
  S.cq = { kind: 'solid', counts, visCounts, hidden: info.hidden, answer: ans, labels, ok: labels.indexOf(ans) };
  S.qz = { title: '用了哪几种立体？各几个？', labels, correct: S.cq.ok, cols: 1, hint: '有的立体被挡住了。拖一拖，转到后面看看。', goodMsg: `一共 ${objs.length} 个：${ans}。`, badMsg: `正确答案：${ans}。`, onDone: () => { chSolidReveal(true); } };
}
function chSolidReveal(on) {
  if (!gl || S.cs !== 'solid') return;
  S.shownAns = on;
  objs.forEach((o) => {
    const hid = S.cq.hidden.includes(o.id);
    o.shape.faces.forEach((f) => f.mesh.material.emissive.set(on && hid ? '#FFC93C' : '#000000').multiplyScalar(on && hid ? 0.3 : 0));
  });
  const h = load3HomeObj();
  if (on) { const s = new THREE.Spherical(h.sph.radius, h.sph.phi, h.sph.theta + Math.PI); stage.flyTo({ target: h.target, sph: s }, 1100); } else stage.flyTo(h, 800);
}

// ——— 面板 ———
function chalReadout() {
  const q = S.cq;
  if (S.cs === 'count') return `<div class="readout"><div class="q">小挑战：${countTitle(q)}</div><div class="line">${S.shownAns ? `<b>答案：${q.labelOf(q.answer)}</b>` : '数一数，再按「揭晓」。'}</div></div>`;
  if (S.cs === 'solid') return `<div class="readout"><div class="q">小挑战：用了哪几种立体？各几个？</div><div class="line">${S.shownAns ? `<b>${q.answer}</b>` : '有的立体被挡住了。拖一拖，转到后面看看，再按「揭晓」。'}</div></div>`;
  const sym = S.cs === 'sym', placed = S.mine.length, need = q.target.length;
  const msg = S.checked ? chMsg() : sym ? '左边拼好了，在右边拼出镜像（对称）。' : '照左边的图，在右边拼一个一样的。';
  return `<div class="readout" style="min-height:0"><div class="q" style="font-size:22px">${msg}</div><div class="line" style="font-size:20px">已放 ${placed} 块${S.checked ? '' : `，要放 ${need} 块`}</div></div>`;
}
function panelChal(practice) {
  if (!S.cq) newChalQ();
  const q = S.cq, sub = subsHTML();
  if (S.cs === 'count' || S.cs === 'solid') {
    if (!practice) {
      panel.innerHTML = tabsHTML() + sub + chalReadout() + `<div class="grp6"><button class="btn s6 red" data-a="chreveal">${S.shownAns ? '再藏起来' : '揭晓'}</button><button class="btn s6 green" data-a="chnext">换一题 ▶</button></div>` + KEYS();
    } else {
      panel.innerHTML = tabsHTML() + sub + '<div id="qbox" class="qbox"></div>';
      renderQuiz(panel.querySelector('#qbox'), S.qz, { next: () => { newChalQ(); paintCh(); renderPanel(); }, burstHost: host });
    }
    return;
  }
  const sel = S.mine.find((m) => m.id === S.csel);
  const palette = `<div class="pickshape">${FLAT_IDS.map((id) => `<button class="btn small" data-a="chadd-${id}" aria-label="加${FLAT[id].name}">${flatIcon(id, '#FFC93C', 40)}</button>`).join('')}</div>`;
  panel.innerHTML = tabsHTML() + sub + chalReadout() + palette +
    `<div class="tool-grid"><button class="btn" data-a="chrot45"${sel ? '' : ' disabled'}>↻ 转45°</button><button class="btn" data-a="chrot90"${sel ? '' : ' disabled'}>↻ 转90°</button><button class="btn red" data-a="chdel"${sel ? '' : ' disabled'}>删除</button></div>` +
    `<div class="grp6"><button class="btn s3 blue" data-a="chhint">提示</button><button class="btn s3 green" data-a="chcheck"${S.mine.length ? '' : ' disabled'}>检查</button>` +
    `${practice ? '' : `<button class="btn s3 yellow" data-a="chreveal">${S.shownAns ? '藏起答案' : '显示答案'}</button>`}<button class="btn ${practice ? 's6' : 's3'}" data-a="chnext">换一题 ▶</button></div>`;
}
function applyView() {
  const flat = S.tab === 'plane' || (S.tab === 'chal' && S.cs !== 'solid');
  host.classList.toggle('svg-on', flat); stage.paused = flat || !gl;
  flatEl.style.display = flat ? '' : 'none';
}

function setTab(t) {
  S.tab = t; S.q = null; S.note = ''; S.shown = false;
  if (gl) { stage.clear(); objs = []; stage.cornerSegs = []; if (t !== 'plane') { load3Home(); S.selO = null; } }
  if (t === 'chal') { S.cq = null; if (!S.cs) S.cs = 'count'; }
  applyView();
  if (t === 'plane') { if (S.quiz) { items = []; } paintPlane(); }
  else if (t === 'chal') { if (S.cs !== 'solid') { newChalQ(); paintCh(); } else newChalQ(); }
  renderPanel();
}
function switchSub(k) {
  S.cs = k; S.cq = null;
  if (gl) { stage.clear(); objs = []; stage.cornerSegs = []; if (k === 'solid') load3Home(); }
  applyView(); newChalQ(); paintCh(); renderPanel();
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
  else if (a.startsWith('cs-')) switchSub(a.slice(3));
  else if (a === 'chreveal') { if (S.cs === 'solid') chSolidReveal(!S.shownAns); else { S.shownAns = !S.shownAns; paintCh(); } renderPanel(); }
  else if (a === 'chnext') { newChalQ(); paintCh(); renderPanel(); }
  else if (a.startsWith('chadd-')) { chAdd(a.slice(6)); paintCh(); renderPanel(); }
  else if (a === 'chrot45' || a === 'chrot90') { const m = S.mine.find((i) => i.id === S.csel); if (m) { m.r = (m.r + (a === 'chrot45' ? 45 : 90)) % 360; S.checked = null; paintCh(); renderPanel(); } }
  else if (a === 'chdel') { S.mine = S.mine.filter((i) => i.id !== S.csel); S.csel = null; S.checked = null; paintCh(); renderPanel(); }
  else if (a === 'chhint') chHint();
  else if (a === 'chcheck') chCheck();
}
function onKey(e) {
  if (e.type !== 'keydown') { if (e.code === 'Space') e.preventDefault(); return; }
  if (e.key === 'r' || e.key === 'R') stage.reset();
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.tab === 'plane' && S.sel) { items = items.filter((i) => i.id !== S.sel); S.sel = null; paintPlane(); renderPanel(); }
    else if (S.tab === 'solid' && S.selO) { const o = objs.find((q) => q.id === S.selO); if (o) { removeObj(o); S.selO = null; relayout(); renderPanel(); } }
  } else if (e.code === 'Space' && S.tab === 'chal' && ctxRef.getMode() === 'teach' && (S.cs === 'count' || S.cs === 'solid')) { if (S.cs === 'solid') chSolidReveal(!S.shownAns); else { S.shownAns = !S.shownAns; paintCh(); } renderPanel(); }
}

export default {
  title: '创意图案',
  mount(body, ctx) {
    ctxRef = ctx; items = []; objs = []; drag = null; down = null;
    S = { cs: 'count', tab: 'plane', color: PAL[0], color3: '#FFC93C', sel: null, selO: null, mirror: false, snap: true, q: null, note: '', free: undefined, quiz: false, shown: false, ch: null };
    body.innerHTML = '<div class="stagecol"><div class="stage" id="host"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel');
    gl = stage.mount(host, { home: () => ({ target: new THREE.Vector3(0, 0.9, 0), sph: new THREE.Spherical(10, rad(60), rad(25)) }), onFrame: frame }).ok;
    const cv = host.querySelector('.cv') || host;
    flatEl = document.createElement('div'); flatEl.className = 'm4wrap'; cv.appendChild(flatEl);
    if (gl) { cv.addEventListener('pointerdown', onDown3, true); window.addEventListener('pointermove', onMove3); window.addEventListener('pointerup', onUp3); }
    host.classList.add('svg-on'); stage.paused = true;
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { S.q = null; S.free = undefined; S.cq = null; S.shown = false; if (S.tab === 'chal') { if (gl) { stage.clear(); objs = []; stage.cornerSegs = []; if (S.cs === 'solid') load3Home(); } newChalQ(); paintCh(); } else if (S.tab === 'plane') { items = []; S.sel = null; paintPlane(); } else if (gl) { clearObjs(); } renderPanel(); });
    // 练习模式预设为出题
    S.free = undefined;
    paintPlane(); renderPanel();
    window.__m4 = { S: () => S, items: () => items, objs: () => objs, exportPNG, planeExportSVG, boundsOf, setTab, EXAMPLES, loadExample, modelTypes, countOfType, sceneCount, addSolid, relayout, genModel, newChalQ, planeSVG, matchParts, genCount, genSym, genCopy, genHiddenModel, visRatio, chalInner, switchSub, paintCh, chAdd, chCheck, scene: () => stage.content };
  },
  unmount() {
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    window.removeEventListener('pointermove', onMove3); window.removeEventListener('pointerup', onUp3);
    offMode?.(); objs = []; items = []; drag = null; chSvg = null; chDrag = null;
    stage.unmount(); delete window.__m4;
  },
};
