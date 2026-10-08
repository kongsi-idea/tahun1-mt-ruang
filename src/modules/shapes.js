// M1 的 6 种立体：面、边、顶点数据都由几何直接生成，数量不手写
import * as THREE from 'three';
import { COLORS, faceMaterial, lineFrom, dynamicLine, setDynamic, circlePts, hlMats } from '../core/ink.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SEG = 96; // 曲面分段（≥64）

export const SHAPE_IDS = ['cube', 'cuboid', 'pyramid', 'cone', 'cylinder', 'sphere'];
export const NAMES = { cube: '正方体', cuboid: '长方体', pyramid: '正方棱锥体', cone: '圆锥体', cylinder: '圆柱体', sphere: '球体' };

function addHl(group, pts, type) {
  const hl = lineFrom(pts, type === 'curve' ? hlMats.curve : hlMats.line);
  hl.visible = false; hl.renderOrder = 6; hl.frustumCulled = false;
  group.add(hl);
  return hl;
}

function polyFaceMesh(pts, color, solidCenter) {
  const c = pts.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / pts.length);
  const n = pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));
  const flip = n.dot(c.clone().sub(solidCenter)) < 0;
  const p = flip ? [...pts].reverse() : pts;
  const pos = [];
  for (let i = 1; i < p.length - 1; i++) pos.push(p[0].x, p[0].y, p[0].z, p[i].x, p[i].y, p[i].z, p[i + 1].x, p[i + 1].y, p[i + 1].z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, faceMaterial(color));
  m.castShadow = true;
  const normal = n.normalize().multiplyScalar(flip ? -1 : 1);
  return { mesh: m, centroid: c, normal };
}

function polyhedron(id, verts, faces, notes, colors) {
  const group = new THREE.Group();
  const center = verts.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / verts.length);
  const shape = { id, name: NAMES[id], group, faces: [], edges: [], verts: verts.map((v) => v.clone()), occluders: [] };
  faces.forEach((f, i) => {
    const r = polyFaceMesh(f.map((k) => verts[k]), colors[i], center);
    group.add(r.mesh); shape.occluders.push(r.mesh);
    const anc = r.centroid.clone().addScaledVector(r.normal, 0.03);
    shape.faces.push({ type: '平面', note: notes[i], mesh: r.mesh, anchor: () => anc });
  });
  const seen = new Set();
  faces.forEach((f) => f.forEach((a, i) => {
    const b = f[(i + 1) % f.length], k = Math.min(a, b) + '-' + Math.max(a, b);
    if (seen.has(k)) return; seen.add(k);
    const A = verts[a], B = verts[b];
    group.add(lineFrom([A, B]));
    const mid = A.clone().add(B).multiplyScalar(0.5);
    shape.edges.push({ type: 'line', a: A, b: B, hl: addHl(group, [A, B], 'line'), anchor: () => mid });
  }));
  // 数的顺序：离默认视角近的先数（看得见的先数，背面的后数）
  const camP = new THREE.Vector3().setFromSpherical(new THREE.Spherical(7.6, THREE.MathUtils.degToRad(66), THREE.MathUtils.degToRad(35))).add(V(0, 0.85, 0));
  const dist = (p) => p.distanceTo(camP);
  shape.faces.sort((a, b) => dist(a.anchor()) - dist(b.anchor()));
  shape.edges.sort((a, b) => dist(a.anchor()) - dist(b.anchor()));
  shape.verts.sort((a, b) => dist(a) - dist(b));
  const segs = shape.edges.map((e) => [e.a, e.b]);
  shape.segs = () => segs;
  shape.update = () => {};
  return shape;
}

function box(id, w, h, d, notes, colors) {
  const x = w / 2, z = d / 2;
  const v = [V(-x, 0, -z), V(x, 0, -z), V(x, 0, z), V(-x, 0, z), V(-x, h, -z), V(x, h, -z), V(x, h, z), V(-x, h, z)];
  return polyhedron(id, v, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]], notes, colors);
}

const frontAngle = (cam, cx = 0, cz = 0) => Math.atan2(cam.position.z - cz, cam.position.x - cx);

function curvedMesh(geo, color) {
  const m = new THREE.Mesh(geo, faceMaterial(color));
  m.castShadow = true;
  return m;
}
function disc(r, y, up, color) {
  const g = new THREE.CircleGeometry(r, SEG);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2); g.translate(0, y, 0);
  return curvedMesh(g, color);
}

function cylinder() {
  const r = 0.85, h = 1.8, group = new THREE.Group();
  const lg = new THREE.CylinderGeometry(r, r, h, SEG, 1, true); lg.translate(0, h / 2, 0);
  const lat = curvedMesh(lg, COLORS[2]), top = disc(r, h, true, COLORS[1]), bot = disc(r, 0, false, COLORS[3]);
  group.add(lat, top, bot);
  const shape = { id: 'cylinder', name: NAMES.cylinder, group, verts: [], occluders: [lat, top, bot] };
  const tA = V(0, h + 0.03, 0), bA = V(0, -0.03, 0);
  shape.faces = [
    { type: '平面', note: '圆形', mesh: top, anchor: () => tA },
    { type: '曲面', note: '', mesh: lat, anchor: (cam) => { const a = frontAngle(cam); return V(Math.cos(a) * (r + 0.03), h / 2, Math.sin(a) * (r + 0.03)); } },
    { type: '平面', note: '圆形', mesh: bot, anchor: () => bA },
  ];
  const ptsT = circlePts(r, h, SEG), ptsB = circlePts(r, 0, SEG);
  group.add(lineFrom(ptsT), lineFrom(ptsB));
  shape.edges = [
    { type: 'curve', hl: addHl(group, ptsT, 'curve'), anchor: (cam) => { const a = frontAngle(cam); return V(Math.cos(a) * r, h, Math.sin(a) * r); } },
    { type: 'curve', hl: addHl(group, ptsB, 'curve'), anchor: (cam) => { const a = frontAngle(cam); return V(Math.cos(a) * r, 0, Math.sin(a) * r); } },
  ];
  const sil = [dynamicLine(2), dynamicLine(2)]; sil.forEach((s) => group.add(s));
  shape.segs = () => [];
  shape.update = (cam) => {
    const dx = cam.position.x, dz = cam.position.z, D = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx), phi = Math.acos(Math.min(r / Math.max(D, r + 1e-4), 1));
    [a + phi, a - phi].forEach((t, i) => setDynamic(sil[i], [V(r * Math.cos(t), 0, r * Math.sin(t)), V(r * Math.cos(t), h, r * Math.sin(t))]));
  };
  return shape;
}

function cone() {
  const r = 0.9, h = 1.9, group = new THREE.Group();
  const lg = new THREE.ConeGeometry(r, h, SEG, 1, true); lg.translate(0, h / 2, 0);
  const lat = curvedMesh(lg, COLORS[0]), bot = disc(r, 0, false, COLORS[1]);
  group.add(lat, bot);
  const apex = V(0, h, 0);
  const shape = { id: 'cone', name: NAMES.cone, group, verts: [apex], occluders: [lat, bot] };
  const bA = V(0, -0.03, 0);
  shape.faces = [
    { type: '曲面', note: '', mesh: lat, anchor: (cam) => { const a = frontAngle(cam), f = 0.38, rr = r * (1 - f) + 0.04; return V(Math.cos(a) * rr, h * f, Math.sin(a) * rr); } },
    { type: '平面', note: '圆形', mesh: bot, anchor: () => bA },
  ];
  const ptsB = circlePts(r, 0, SEG);
  group.add(lineFrom(ptsB));
  shape.edges = [{ type: 'curve', hl: addHl(group, ptsB, 'curve'), anchor: (cam) => { const a = frontAngle(cam); return V(Math.cos(a) * r, 0, Math.sin(a) * r); } }];
  const sil = [dynamicLine(2), dynamicLine(2)]; sil.forEach((s) => group.add(s));
  let cur = [];
  shape.segs = () => cur;
  shape.update = (cam) => {
    const c = cam.position.clone(); if (Math.abs(c.y - h) < 1e-3) c.y += 2e-3;
    const s = h / (c.y - h);
    const P = apex.clone().addScaledVector(apex.clone().sub(c), s);
    const D = Math.hypot(P.x, P.z);
    cur = [];
    if (D > r * 1.0005) {
      const psi = Math.atan2(P.z, P.x), phi = Math.acos(r / D);
      [psi + phi, psi - phi].forEach((t, i) => {
        const T = V(r * Math.cos(t), 0, r * Math.sin(t));
        setDynamic(sil[i], [apex, T]); sil[i].visible = true; cur.push([apex, T]);
      });
    } else sil.forEach((l) => (l.visible = false));
  };
  return shape;
}

function sphere() {
  const R = 1.0, cy = R, group = new THREE.Group();
  const g = new THREE.SphereGeometry(R, 128, 64); g.translate(0, cy, 0);
  const m = curvedMesh(g, COLORS[3]);
  group.add(m);
  const shape = { id: 'sphere', name: NAMES.sphere, group, verts: [], edges: [], occluders: [m] };
  shape.faces = [{ type: '曲面', note: '', mesh: m, anchor: (cam) => { const o = V(0, cy, 0), d = cam.position.clone().sub(o).normalize(); d.y += 0.25; d.normalize(); return o.addScaledVector(d, R + 0.03); } }];
  const N = 128, ring = dynamicLine(N + 1); group.add(ring);
  const O = V(0, cy, 0);
  shape.segs = () => [];
  shape.update = (cam) => {
    const n = cam.position.clone().sub(O), d = n.length(); n.normalize();
    const u = Math.abs(n.y) < 0.99 ? V(0, 1, 0).cross(n).normalize() : V(1, 0, 0), v = n.clone().cross(u);
    const C = O.clone().addScaledVector(n, (R * R) / d), rho = (R * Math.sqrt(d * d - R * R)) / d;
    const pts = [];
    for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI * 2; pts.push(C.clone().addScaledVector(u, rho * Math.cos(t)).addScaledVector(v, rho * Math.sin(t))); }
    setDynamic(ring, pts);
  };
  return shape;
}

export function buildShape(id) {
  switch (id) {
    case 'cube': return box('cube', 1.7, 1.7, 1.7, Array(6).fill('正方形'), COLORS);
    case 'cuboid': return box('cuboid', 2.4, 1.3, 1.6, Array(6).fill('长方形'), COLORS);
    case 'pyramid': {
      const s = 0.95, h = 1.9;
      const v = [V(-s, 0, -s), V(s, 0, -s), V(s, 0, s), V(-s, 0, s), V(0, h, 0)];
      return polyhedron('pyramid', v, [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
        ['正方形', '三角形', '三角形', '三角形', '三角形'], [COLORS[5], COLORS[0], COLORS[1], COLORS[2], COLORS[3]]);
    }
    case 'cone': return cone();
    case 'cylinder': return cylinder();
    case 'sphere': return sphere();
  }
}

// 数量表（SPEC §2）——只用来在验收时对照，工具显示的数字来自几何本身
export const EXPECT = {
  cube: { f: 6, e: 12, v: 8 }, cuboid: { f: 6, e: 12, v: 8 }, pyramid: { f: 5, e: 8, v: 5 },
  cone: { f: 2, e: 1, v: 1 }, cylinder: { f: 3, e: 2, v: 0 }, sphere: { f: 1, e: 0, v: 0 },
};
