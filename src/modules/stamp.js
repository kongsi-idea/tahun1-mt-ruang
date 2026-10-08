// 盖印章（小乐趣）：把立体的一个面压在地上，留下平面图形，再问「这是什么形状？」（复用 3D 立体）
import { stage, THREE, ease, reducedMotion } from '../core/stage3d.js';
import { lineFrom, circlePts } from '../core/ink.js';
import { FLAT, FLAT_IDS } from '../core/flat.js';
import { renderQuiz, shuffle } from '../core/quiz.js';
import { buildShape, SHAPE_IDS, NAMES, worldSegs } from './shapes.js';
import { keysHTML, toggleKeys } from '../core/keys.js';

const rad = THREE.MathUtils.degToRad;
const K = [['<kbd>空白键</kbd>', '盖印章／揭晓'], ['<kbd>R</kbd>', '复位视角']];

let S, host, panel, gl, ctxRef, offMode, stamp, imprint;

// ———— 立体里的平面（盖印章）————
function planarFaces(sh) { return sh.faces.filter((f) => f.flat); }
function faceKind(f) {
  if (f.flat.circle) return 'circle';
  const p = f.flat.pts;
  if (p.length === 3) return 'tri';
  const d = (a, b) => a.distanceTo(b);
  return Math.abs(d(p[0], p[1]) - d(p[1], p[2])) < 1e-4 ? 'square' : 'rect';
}
const home3 = () => ({ target: new THREE.Vector3(0, 1.5, 0), sph: new THREE.Spherical(stage.size.w / stage.size.h < 1.25 ? 10 : 9, rad(66), rad(30)) });

function loadSolid(i) {
  S.solid = i; S.faceNo = 0; S.stamped = null; S.stampAnim = null; S.revealed = false;
  if (!gl) return;
  stage.clear(); imprint = null; stage.cornerSegs = [];
  stamp = buildShape(SHAPE_IDS[i]);
  stage.content.add(stamp.group);
  stage.setFootprint(...stamp.foot);
}
function startStamp() {
  if (!gl || S.stampAnim) return;
  if (imprint) { stage.content.remove(imprint.g); imprint.g.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.userData?.shared) o.material.dispose(); }); imprint = null; }
  stamp.group.visible = true; stamp.group.position.set(0, 0, 0); stamp.group.quaternion.identity();
  const list = planarFaces(stamp), g = stamp.group;
  S.revealed = false; S.stamped = null;
  let face = null, qt = new THREE.Quaternion();
  if (list.length) {
    const diff = list.filter((f) => faceKind(f) !== S.lastKind), pool = diff.length ? diff : list;
    face = pool[S.faceNo % pool.length]; S.faceNo++; S.lastKind = faceKind(face);
    qt.setFromUnitVectors(face.flat.normal.clone().normalize(), new THREE.Vector3(0, -1, 0));
    // 旋转后最低点要贴地
  }
  const rot = qt.clone();
  g.quaternion.copy(rot); g.position.set(0, 0, 0); g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g, false);
  const rest = -box.min.y;
  let cxz = new THREE.Vector3();
  if (face) { cxz = (face.flat.center || new THREE.Vector3()).clone().applyQuaternion(rot); }
  g.quaternion.identity(); g.position.set(0, 0, 0);
  S.stampAnim = { t0: performance.now(), rot, rest, off: face ? new THREE.Vector3(-cxz.x, 0, -cxz.z) : new THREE.Vector3(), face, imprinted: false };
}
function makeImprint(face, rot, off) {
  const g = new THREE.Group();
  let pts;
  if (face.flat.circle) pts = circlePts(face.flat.circle, 0.014, 96).map((p) => p.add(new THREE.Vector3(0, 0, 0)));
  else pts = [...face.flat.pts, face.flat.pts[0]].map((p) => p.clone().applyQuaternion(rot).add(off).setY(0.014));
  if (face.flat.circle) pts = pts.map((p) => p.setY(0.014));
  const open = pts.slice(0, -1);
  const pos = [];
  for (let i = 1; i < open.length - 1; i++) pos.push(open[0].x, 0.012, open[0].z, open[i + 1].x, 0.012, open[i + 1].z, open[i].x, 0.012, open[i].z);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const col = face.mesh.material.color.clone();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  g.add(mesh, lineFrom(pts));
  const segs = [];
  for (let i = 0; i < open.length; i++) segs.push([open[i].clone(), open[(i + 1) % open.length].clone()]);
  return { g, segs: face.flat.circle ? [] : segs };
}
function stampFrame(now) {
  const a = S.stampAnim; if (!a) return;
  const t = now - a.t0, g = stamp.group, D = reducedMotion() ? 0.01 : 1;
  const T1 = 700 * D, T2 = 1050 * D, T3 = 1500 * D, T4 = 2050 * D;
  const lerp = THREE.MathUtils.lerp;
  if (t >= T2 && !a.imprinted && a.face) { // 画面很卡时可能整段被跳过，所以在这里统一补上
    a.imprinted = true;
    imprint = makeImprint(a.face, a.rot, a.off); stage.content.add(imprint.g);
    S.stamped = faceKind(a.face);
  }
  if (t < T1) {
    const e = ease(t / T1); g.quaternion.identity().slerp(a.rot, e);
    g.position.set(lerp(0, a.off.x, e), lerp(0, 2.4 + a.rest, e), lerp(0, a.off.z, e));
  } else if (t < T2) {
    const e = ease((t - T1) / (T2 - T1)); g.quaternion.copy(a.rot);
    g.position.set(a.off.x, lerp(2.4 + a.rest, a.rest, e), a.off.z);
  } else if (t < T3) {
    g.quaternion.copy(a.rot); g.position.set(a.off.x, a.rest, a.off.z);
    if (!a.imprinted && a.face) {
      a.imprinted = true;
      imprint = makeImprint(a.face, a.rot, a.off); stage.content.add(imprint.g);
      S.stamped = faceKind(a.face);
    }
  } else if (t < T4) {
    const e = ease((t - T3) / (T4 - T3)); g.position.set(a.off.x, lerp(a.rest, a.rest + 6, e), a.off.z);
  } else {
    g.visible = false; S.stampAnim = null; S.stampDone = true; render();
    return;
  }
  const rise = Math.max(0, (g.position.y - a.rest) / 2.5);
  stage.setFootprint(stamp.foot[0], stamp.foot[1], a.face || t < T1 ? (a.face ? 1 : 0.6) * Math.max(0, 1 - rise) : 0.5);
}
function frame(now) {
  if (!stamp) return;
  stampFrame(now);
  if (stamp.group.visible) { stamp.update(stage.camera); stage.cornerSegs = worldSegs(stamp).concat(imprint ? imprint.segs : []); }
  else stage.cornerSegs = imprint ? imprint.segs : [];
}

// ———— 面板 ————
const KEYS = () => keysHTML(K);

function newStampQ() {
  const kind = S.stamped, ids = shuffle([kind, ...shuffle(FLAT_IDS.filter((x) => x !== kind)).slice(0, 2)]);
  S.q = { type: 'stamp', title: '印出来的是什么形状？', labels: ids.map((x) => FLAT[x].name), correct: ids.indexOf(kind), cols: 1, goodMsg: `是「${FLAT[kind].name}」。`, badMsg: `正确答案是「${FLAT[kind].name}」。` };
}

function render() {
  const practice = ctxRef.getMode() === 'practice';
  const busy = !!S.stampAnim;
  const chips = `<div class="row2">${SHAPE_IDS.map((id, i) => `<button class="btn small${S.solid === i ? ' on' : ''}" data-a="solid-${i}">${NAMES[id]}</button>`).join('')}</div>`;
  const sphere = SHAPE_IDS[S.solid] === 'sphere';
  if (!practice) {
    const res = S.stamped ? (S.revealed ? `<b>印出来的是「${FLAT[S.stamped].name}」</b>。` : '印出来的图形是什么？先猜一猜。') : sphere && S.stampDone ? '<b>球体没有平面</b>，压不出图形。' : '把立体的一个面压在地上，会留下什么形状？';
    panel.innerHTML = chips + `<div class="readout"><div class="q">${res}</div></div><div class="grp6"><button class="btn s6 red" data-a="stamp"${busy ? ' disabled' : ''}>盖印章</button><button class="btn s6 yellow" data-a="reveal"${S.stamped && !S.revealed ? '' : ' disabled'}>揭晓形状</button></div>` + KEYS();
  } else {
    if (S.stamped && !S.q) newStampQ();
    panel.innerHTML = chips + `<button class="btn s6 red" data-a="stamp"${busy ? ' disabled' : ''}>盖印章</button><div id="qbox" class="qbox"></div>`;
    if (S.stamped && S.q) renderQuiz(panel.querySelector('#qbox'), S.q, { next: () => { S.q = null; S.stamped = null; S.faceNo = 0; if (imprint) { stage.content.remove(imprint.g); imprint = null; } stamp.group.visible = true; stamp.group.position.set(0, 0, 0); stamp.group.quaternion.identity(); render(); }, burstHost: host });
    else panel.querySelector('#qbox').innerHTML = `<div class="readout"><div class="q">${sphere && S.stampDone ? '球体没有平面，压不出图形。换一个立体试试。' : '按「盖印章」，看看印出什么形状。'}</div></div>`;
  }
}

function onPanel(e) {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'keys') { toggleKeys(); render(); }
  else if (a.startsWith('solid-')) { loadSolid(+a.slice(6)); S.stampDone = false; S.q = null; render(); }
  else if (a === 'stamp') { S.q = null; S.stampDone = false; startStamp(); render(); }
  else if (a === 'reveal') { S.revealed = true; render(); }
}
function onKey(e) {
  const teach = ctxRef.getMode() === 'teach';
  if (e.code === 'Space') {
    e.preventDefault(); if (e.type === 'keyup') return;
    if (!teach) { const n = panel.querySelector('#qnext'); if (n && n.style.visibility !== 'hidden') n.click(); return; }
    if (!S.stampAnim) { if (S.stamped && !S.revealed) { S.revealed = true; render(); } else { startStamp(); render(); } }
    return;
  }
  if (e.type === 'keydown' && (e.key === 'r' || e.key === 'R')) stage.reset();
}

export default {
  title: '盖印章',
  badge: '小乐趣',
  mount(body, ctx) {
    ctxRef = ctx;
    S = { solid: 0, faceNo: 0, stamped: null, stampAnim: null, stampDone: false, revealed: false, q: null };
    body.innerHTML = '<div class="stagecol"><div class="stage" id="host"></div></div><div class="panel" id="panel"></div>';
    host = body.querySelector('#host'); panel = body.querySelector('#panel');
    gl = stage.mount(host, { home: home3, onFrame: frame }).ok;
    stamp = null; imprint = null;
    panel.addEventListener('click', onPanel);
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
    offMode = ctx.onMode(() => { S.q = null; S.stampAnim = null; S.stampDone = false; loadSolid(S.solid); render(); });
    if (gl) { loadSolid(0); const h0 = home3(); stage.fly = null; stage.controls.enabled = true; stage.place(h0.target, h0.sph); }
    render();
    window.__stamp = { S: () => S, startStamp, loadSolid };
  },
  unmount() {
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    offMode?.(); stamp = null; imprint = null;
    stage.unmount(); delete window.__stamp;
  },
};
