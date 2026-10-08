// 展开图的 3D 物件：多面体（铰链折叠）、圆柱（侧面卷起＋盖子盖上）、圆锥（扇形卷成锥面）
// 统一接口：{ group, setP(p) 0＝摊平 1＝合起, segs() 给顶点尖角补丁, update(camera), bounds, solidCenter, dispose? }
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { COLORS, faceMaterial, lineFrom, dynamicLine, setDynamic, circlePts, inkMat, allLineMats, LINE_BIAS } from '../core/ink.js';
import { hingeSign } from './netgeo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

// 接缝线（卷好以后淡出，让合起来的圆柱、圆锥和一般立体一样干净）
export const seamMat = new LineMaterial({ color: '#3B2A1A', linewidth: 4.5, transparent: true });
seamMat.vertexShader = seamMat.vertexShader.replace('gl_Position = clip;', `clip.z -= ${LINE_BIAS} * clip.w; gl_Position = clip;`);
seamMat.userData.shared = true; allLineMats.push(seamMat);

// ——— 展开图的 2D 范围 ———
export function netBounds(polys) {
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  polys.forEach((p) => p.forEach(([u, v]) => { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }));
  return { u0, u1, v0, v1, cu: (u0 + u1) / 2, cv: (v0 + v1) / 2, w: u1 - u0, h: v1 - v0 };
}

// ——— 轮廓线：网格上「一面朝向镜头、一面背向镜头」的共用边（跟直线边一样粗，卷到哪里都对）———
class Silhouette {
  constructor(geo, maxSeg = 900) {
    this.geo = geo; this.max = maxSeg;
    const idx = geo.index.array, map = new Map();
    for (let t = 0; t < idx.length / 3; t++) for (let k = 0; k < 3; k++) {
      const a = idx[t * 3 + k], b = idx[t * 3 + ((k + 1) % 3)], key = a < b ? a + '_' + b : b + '_' + a;
      const e = map.get(key); if (e) e.t2 = t; else map.set(key, { a, b, t1: t, t2: -1 });
    }
    this.edges = [...map.values()].filter((e) => e.t2 >= 0);
    this.face = new Uint8Array(idx.length / 3);
    const g = new LineSegmentsGeometry(); g.setPositions(new Float32Array(maxSeg * 6));
    this.lines = new LineSegments2(g, inkMat); this.lines.frustumCulled = false; this.lines.renderOrder = 3;
    this.n = 0;
  }
  update(camPos) {
    const P = this.geo.attributes.position.array, idx = this.geo.index.array, F = this.face;
    for (let t = 0; t < F.length; t++) {
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      F[t] = nx * nx + ny * ny + nz * nz < 1e-14 ? 2 : nx * (camPos.x - P[a]) + ny * (camPos.y - P[a + 1]) + nz * (camPos.z - P[a + 2]) > 0 ? 1 : 0; // 2＝零面积（锥尖那一圈），不参与
    }
    const arr = this.lines.geometry.attributes.instanceStart.data.array; let n = 0;
    for (const e of this.edges) {
      if (F[e.t1] === F[e.t2] || F[e.t1] === 2 || F[e.t2] === 2 || n >= this.max) continue;
      const a = e.a * 3, b = e.b * 3, o = n * 6;
      arr[o] = P[a]; arr[o + 1] = P[a + 1]; arr[o + 2] = P[a + 2]; arr[o + 3] = P[b]; arr[o + 4] = P[b + 1]; arr[o + 5] = P[b + 2]; n++;
    }
    for (let i = n; i < this.n; i++) { const o = i * 6; arr[o] = arr[o + 1] = arr[o + 2] = arr[o + 3] = arr[o + 4] = arr[o + 5] = 0; }
    this.n = n;
    this.lines.geometry.attributes.instanceStart.data.needsUpdate = true;
    this.lines.geometry.instanceCount = Math.max(n, 1);
  }
  segs() { return []; }
}

function gridMesh(NS, NW, color) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array((NS + 1) * (NW + 1) * 3), ind = [];
  for (let i = 0; i < NS; i++) for (let j = 0; j < NW; j++) {
    const a = i * (NW + 1) + j, b = (i + 1) * (NW + 1) + j, c = (i + 1) * (NW + 1) + j + 1, d = i * (NW + 1) + j + 1;
    ind.push(a, d, b, b, d, c);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(ind);
  const m = new THREE.Mesh(g, faceMaterial(color, { side: THREE.DoubleSide }));
  m.castShadow = true; m.frustumCulled = false;
  return m;
}
function flatDisc(r, color) {
  const geo = new THREE.CircleGeometry(r, 96); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, faceMaterial(color, { side: THREE.DoubleSide })); m.castShadow = true; return m;
}

// ═══════════ 多面体 ═══════════
export function buildPolyNet(net, colors = COLORS) {
  const group = new THREE.Group(), nodes = [], hinges = [];
  let maxD = 1; net.faces.forEach((f) => (maxD = Math.max(maxD, f.depth)));
  const order = [...net.faces].sort((a, b) => a.depth - b.depth), loops = [];
  for (const f of order) {
    const node = new THREE.Group(); nodes[f.id] = node;
    const pts = f.poly.map(([u, v]) => V(u, 0, v)), pos = [];
    for (let i = 1; i < pts.length - 1; i++) pos.push(pts[0].x, 0, pts[0].z, pts[i].x, 0, pts[i].z, pts[i + 1].x, 0, pts[i + 1].z);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, faceMaterial(colors[f.id % 6], { side: THREE.DoubleSide })); mesh.castShadow = true;
    const loop = lineFrom([...pts, pts[0]]);
    node.add(mesh, loop); loops.push({ loop, pts });
    if (f.parent == null) group.add(node);
    else {
      const A = f.hinge.A, B = f.hinge.B, pivot = new THREE.Group();
      pivot.position.set(A[0], 0, A[1]); node.position.set(-A[0], 0, -A[1]); pivot.add(node); nodes[f.parent].add(pivot);
      hinges.push({ pivot, axis: V(B[0] - A[0], 0, B[1] - A[1]).normalize(), sign: hingeSign(net, f), theta: f.theta, depth: f.depth });
    }
  }
  const b = netBounds(net.faces.map((f) => f.poly));
  const sc = net.faces[0] && net.solidCenter ? net.solidCenter : V(0, 0.6, 0);
  const obj = {
    kind: 'poly', group, bounds: b, solidCenter: sc, p: 0,
    setP(p) {
      obj.p = p; const t = p * (1 + 0.7 * (maxD - 1));
      for (const h of hinges) h.pivot.quaternion.setFromAxisAngle(h.axis, h.sign * h.theta * ease(clamp01(t - 0.7 * (h.depth - 1))));
    },
    update() { group.updateMatrixWorld(true); },
    segs() {
      const out = [];
      for (const { loop, pts } of loops) { const w = pts.map((p) => p.clone().applyMatrix4(loop.matrixWorld)); for (let i = 0; i < w.length; i++) out.push([w[i], w[(i + 1) % w.length]]); }
      return out;
    },
  };
  obj.setP(0);
  return obj;
}

// ═══════════ 圆柱体 ═══════════
export const CYL = { r: 0.6, h: 1.25 };
export function buildCylinderNet() {
  const { r, h } = CYL, L = 2 * Math.PI * r, NS = 192, NW = 8;
  const group = new THREE.Group();
  const bottom = flatDisc(r, COLORS[3]); group.add(bottom, lineFrom(circlePts(r, 0, 96)));
  const lat = gridMesh(NS, NW, COLORS[2]); group.add(lat);
  // 盖子：绕侧面上缘的一点（切点）转上去
  const lid = new THREE.Group(), lidIn = new THREE.Group(); lidIn.position.set(0, 0, r); lid.add(lidIn);
  lidIn.add(flatDisc(r, COLORS[1]), lineFrom(circlePts(r, 0, 96))); group.add(lid);
  const top = dynamicLine(NS + 1), bot = dynamicLine(NS + 1), sideL = dynamicLine(2, seamMat), sideR = dynamicLine(2, seamMat);
  [top, bot, sideL, sideR].forEach((l) => group.add(l));
  const sil = new Silhouette(lat.geometry); group.add(sil.lines);
  const P0 = V(0, 0, r), TH = V(1, 0, 0), NIN = V(0, 0, -1);
  const pt = (s, w, a) => {
    const k = a / r, g = (a * Math.PI) / 2;
    let cx, cz, ox, oz; // 曲线上的点 C(s)、向外法线 e_out(s)（地面上；e_out ＝ −N，N ＝ n_in·cos − t·sin）
    if (k < 1e-6) { cx = s; cz = 0; ox = 0; oz = 1; }
    else { const sn = Math.sin(k * s), cs = Math.cos(k * s); cx = sn / k; cz = -(1 - cs) / k; ox = sn; oz = cs; }
    const c = Math.cos(g), sg = Math.sin(g);
    return [cx + w * c * ox, w * sg, r + cz + w * c * oz];
  };
  const P = lat.geometry.attributes.position.array;
  const setLat = (a) => {
    let o = 0;
    for (let i = 0; i <= NS; i++) { const s = -L / 2 + (L * i) / NS; for (let j = 0; j <= NW; j++) { const q = pt(s, (h * j) / NW, a); P[o++] = q[0]; P[o++] = q[1]; P[o++] = q[2]; } }
    lat.geometry.attributes.position.needsUpdate = true; lat.geometry.computeVertexNormals();
  };
  // 让合起来时法线朝外：试算
  setLat(1);
  { const ia = lat.geometry.index.array, a = ia[0] * 3, b = ia[1] * 3, c = ia[2] * 3, p = (i) => V(P[i], P[i + 1], P[i + 2]);
    const n = p(b).sub(p(a)).cross(p(c).sub(p(a))), out = p(a); out.y = 0;
    if (n.dot(out) < 0) { const arr = lat.geometry.index.array; for (let t = 0; t < arr.length; t += 3) { const x = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = x; } lat.geometry.index.needsUpdate = true; } }
  const obj = {
    kind: 'cyl', group, p: 0, solidCenter: V(0, h / 2, 0),
    bounds: { u0: -L / 2, u1: L / 2, v0: -r, v1: r + h + 2 * r, cu: 0, cv: (-r + r + h + 2 * r) / 2, w: L, h: h + 4 * r },
    setP(p) {
      obj.p = p;
      const a = ease(clamp01(p / 0.7)), b = ease(clamp01((p - 0.5) / 0.5)), g = (a * Math.PI) / 2, alpha = g + (b * Math.PI) / 2;
      setLat(a);
      const tp = [], bp = [];
      for (let i = 0; i <= NS; i++) { const s = -L / 2 + (L * i) / NS; tp.push(V(...pt(s, h, a))); bp.push(V(...pt(s, 0, a))); }
      setDynamic(top, tp); setDynamic(bot, bp);
      setDynamic(sideL, [bp[0], tp[0]]); setDynamic(sideR, [bp[NS], tp[NS]]);
      const Q = V(...pt(0, h, a)); lid.position.copy(Q); lid.quaternion.setFromAxisAngle(TH, -alpha);
      seamMat.opacity = 1 - clamp01((p - 0.9) / 0.1);
      obj._tp = tp; obj._bp = bp;
    },
    update(cam) { group.updateMatrixWorld(true); sil.update(cam.position); },
    segs() {
      const tp = obj._tp, bp = obj._bp; if (obj.p > 0.95) return [];
      return [[bp[0], bp[1]], [bp[0], tp[0]], [bp[NS], bp[NS - 1]], [bp[NS], tp[NS]], [tp[0], tp[1]], [tp[0], bp[0]], [tp[NS], tp[NS - 1]], [tp[NS], bp[NS]]];
    },
  };
  obj.setP(0);
  return obj;
}

// ═══════════ 圆锥体 ═══════════
export const CONE = { r: 0.65, h: 1.35 };
CONE.l = Math.hypot(CONE.r, CONE.h);              // 斜高（扇形半径）
CONE.theta = (2 * Math.PI * CONE.r) / CONE.l;     // 扇形的圆心角：使扇形弧长 ＝ 底圆周长
export function buildConeNet() {
  const { r, h, l, theta } = CONE, NR = 24, NA = 200;
  const group = new THREE.Group();
  const base = flatDisc(r, COLORS[1]); group.add(base, lineFrom(circlePts(r, 0, 96)));
  const lat = gridMesh(NR, NA, COLORS[0]); group.add(lat);
  const arc = dynamicLine(NA + 1), radL = dynamicLine(2, seamMat), radR = dynamicLine(2, seamMat);
  [arc, radL, radR].forEach((x) => group.add(x));
  const sil = new Silhouette(lat.geometry); group.add(sil.lines);
  const aF = Math.atan2(h, -r), bF = Math.asin(r / l);
  const P0 = V(0, 0, r);
  const P = lat.geometry.attributes.position.array;
  // 形态：a＝母线从「平躺朝外」抬起的角度，beta＝锥面半顶角（平躺＝90°，合起＝asin(r/斜高)）
  const shape = (u) => ({ a: aF * u, beta: Math.PI / 2 + (bF - Math.PI / 2) * u });
  const frame = ({ a, beta }) => {
    const g = V(0, Math.sin(a), Math.cos(a)), A = P0.clone().addScaledVector(g, l), d0 = g.clone().negate();
    const th = a + Math.PI - beta, hh = V(0, Math.sin(th), Math.cos(th));
    const e1 = d0.clone().addScaledVector(hh, -Math.cos(beta)).multiplyScalar(1 / Math.sin(beta)), e2 = V(1, 0, 0);
    return { A, hh, e1, e2, beta };
  };
  const dirOf = (F, psi) => { const ph = psi / Math.sin(F.beta); return F.hh.clone().multiplyScalar(Math.cos(F.beta)).addScaledVector(F.e1, Math.sin(F.beta) * Math.cos(ph)).addScaledVector(F.e2, Math.sin(F.beta) * Math.sin(ph)); };
  const setLat = (F) => {
    let o = 0;
    for (let i = 0; i <= NR; i++) { const rho = (l * i) / NR; for (let j = 0; j <= NA; j++) { const psi = -theta / 2 + (theta * j) / NA, q = F.A.clone().addScaledVector(dirOf(F, psi), rho); P[o++] = q.x; P[o++] = q.y; P[o++] = q.z; } }
    lat.geometry.attributes.position.needsUpdate = true; lat.geometry.computeVertexNormals();
  };
  // 合起来时法线朝外
  setLat(frame(shape(1)));
  { const ia = lat.geometry.index.array, a = ia[0] * 3, b = ia[1] * 3, c = ia[2] * 3, p = (i) => V(P[i], P[i + 1], P[i + 2]);
    const n = p(b).sub(p(a)).cross(p(c).sub(p(a))), out = p(a); out.y = 0;
    if (n.dot(out) < 0) { const arr = lat.geometry.index.array; for (let t = 0; t < arr.length; t += 3) { const x = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = x; } lat.geometry.index.needsUpdate = true; } }
  const apexClosed = V(0, h, 0);
  const obj = {
    kind: 'cone', group, p: 0, solidCenter: V(0, h / 2, 0), minY: 0,
    bounds: { u0: -l * Math.sin(theta / 2), u1: l * Math.sin(theta / 2), v0: -r, v1: r + l, cu: 0, cv: (-r + r + l) / 2, w: 2 * l * Math.sin(theta / 2), h: l + 2 * r },
    setP(p) {
      obj.p = p; const u = ease(clamp01(p)), F = frame(shape(u));
      setLat(F);
      const ap = [], ends = [];
      for (let j = 0; j <= NA; j++) { const psi = -theta / 2 + (theta * j) / NA; ap.push(F.A.clone().addScaledVector(dirOf(F, psi), l)); }
      setDynamic(arc, ap); setDynamic(radL, [F.A, ap[0]]); setDynamic(radR, [F.A, ap[NA]]);
      obj._A = F.A; obj._ap = ap;
      seamMat.opacity = 1 - clamp01((p - 0.9) / 0.1);
      let mn = 1e9; for (let i = 1; i < P.length; i += 3) mn = Math.min(mn, P[i]); obj.minY = mn;
    },
    update(cam) { group.updateMatrixWorld(true); sil.update(cam.position); },
    segs() {
      const out = [], A = obj._A, ap = obj._ap;
      if (obj.p > 0.97) { // 合起来：顶点（锥尖）用解析的两条轮廓母线，跟立体图形里的圆锥一样
        const c = cam0; if (!c) return out;
        const cc = c.clone(); if (Math.abs(cc.y - h) < 1e-3) cc.y += 2e-3;
        const s = (0 - h) / (h - cc.y), Pp = apexClosed.clone().addScaledVector(apexClosed.clone().sub(cc), s), D = Math.hypot(Pp.x, Pp.z);
        if (D > r * 1.0005) { const psi = Math.atan2(Pp.z, Pp.x), phi = Math.acos(r / D); [psi + phi, psi - phi].forEach((t) => out.push([apexClosed.clone(), V(r * Math.cos(t), 0, r * Math.sin(t))])); }
        return out;
      }
      if (obj.p < 0.02) { out.push([ap[0], A], [ap[NA], A], [ap[0], ap[1]], [ap[NA], ap[NA - 1]]); } // 摊平时扇形的三个尖角
      return out;
    },
  };
  let cam0 = null; const upd = obj.update; obj.update = (cam) => { cam0 = cam.position; upd(cam); };
  obj.setP(0);
  return obj;
}
