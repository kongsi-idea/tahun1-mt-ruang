// 展开图的几何：多面体（正方体、长方体、正方棱锥体）→ 枚举所有「展开方式」，验证平面上不重叠、折起来真的回到立体。
// 做法（通用，不手写展开图）：
//   1. 立体的面邻接图（面＝点，共用一条边＝线）；展开图 ＝ 邻接图的一棵生成树（沿树上的边摊平）。
//   2. 沿树把每个面绕共用的边转到根面所在的平面上，得到 2D 多边形；
//   3. 2D 多边形两两不可重叠（内部不相交）才是一个有效展开图；
//   4. 用「铰链＋折叠角」把它折回去，所有面的顶点必须正好落回立体的顶点（逐面核对）。
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ——— 立体定义（面的顶点按外法线朝外排列）———
export function makePoly(id) {
  let v, f;
  if (id === 'cube' || id === 'cuboid') {
    const [w, h, d] = id === 'cube' ? [1, 1, 1] : [1.8, 1.0, 1.2], x = w / 2, z = d / 2;
    v = [V(-x, 0, -z), V(x, 0, -z), V(x, 0, z), V(-x, 0, z), V(-x, h, -z), V(x, h, -z), V(x, h, z), V(-x, h, z)];
    f = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
  } else if (id === 'pyramid') {
    const s = 0.75, h = 1.5;
    v = [V(-s, 0, -s), V(s, 0, -s), V(s, 0, s), V(-s, 0, s), V(0, h, 0)];
    f = [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
  } else throw new Error('unknown poly ' + id);
  const center = v.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / v.length);
  const faces = f.map((idx, i) => {
    const pts = idx.map((k) => v[k]);
    const c = pts.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / pts.length);
    let n = pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).normalize();
    let ord = idx;
    if (n.dot(c.clone().sub(center)) < 0) { n.negate(); ord = [...idx].reverse(); }
    return { id: i, idx: ord, pts: ord.map((k) => v[k]), c, n };
  });
  // 邻接：两个面共用两个顶点
  const edges = [];
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const sh = faces[i].idx.filter((k) => faces[j].idx.includes(k));
    if (sh.length === 2) edges.push({ a: i, b: j, p: sh[0], q: sh[1] });
  }
  return { id, verts: v, faces, edges, center };
}

// ——— 生成树枚举 ———
export function spanningTrees(P) {
  const n = P.faces.length, E = P.edges, out = [];
  const pick = [];
  const find = (par, x) => (par[x] === x ? x : (par[x] = find(par, par[x])));
  (function rec(i) {
    if (pick.length === n - 1) { out.push([...pick]); return; }
    if (i >= E.length || E.length - i < n - 1 - pick.length) return;
    // 选 E[i]（不成环才选）
    const par = [...Array(n).keys()];
    pick.forEach((k) => { par[find(par, E[k].a)] = find(par, E[k].b); });
    if (find(par, E[i].a) !== find(par, E[i].b)) { pick.push(i); rec(i + 1); pick.pop(); }
    rec(i + 1);
  })(0);
  return out;
}

// ——— 展开 ———
// 返回 { faces:[{id, poly:[[u,v]..], parent, hinge:{A:[u,v],B:[u,v]}|null, theta, depth}], root, T }
// T：把立体搬到「根面平放在 y=0 平面、立体在上方」的位置的函数
export function unfold(P, treeEdgeIdx, root = 0) {
  const n = P.faces.length, adj = Array.from({ length: n }, () => []);
  treeEdgeIdx.forEach((k) => { const e = P.edges[k]; adj[e.a].push({ to: e.b, e }); adj[e.b].push({ to: e.a, e }); });
  const R = P.faces[root];
  const e1 = P.verts[R.idx[1]].clone().sub(P.verts[R.idx[0]]).normalize(), e2 = R.n.clone().cross(e1).normalize(), c0 = R.c.clone();
  const toPlane = (q) => [q.clone().sub(c0).dot(e1), q.clone().sub(c0).dot(e2)];
  const T = (p) => { const d = p.clone().sub(c0); return V(d.dot(e1), -d.dot(R.n), d.dot(e2)); };
  const M = new Array(n).fill(null); M[root] = new THREE.Matrix4();
  const info = new Array(n).fill(null); info[root] = { id: root, parent: null, hinge: null, theta: 0, depth: 0 };
  const seen = new Set([root]), q = [root];
  while (q.length) {
    const p = q.shift();
    for (const { to, e } of adj[p]) {
      if (seen.has(to)) continue; seen.add(to); q.push(to);
      const A = P.verts[e.p], B = P.verts[e.q], axis = B.clone().sub(A).normalize();
      const nP = P.faces[p].n, nC = P.faces[to].n, th = Math.acos(THREE.MathUtils.clamp(nP.dot(nC), -1, 1));
      // 把子面绕共用边转到与父面共面（法线对齐）、且在边的另一侧
      let best = null;
      for (const s of [1, -1]) {
        const rot = new THREE.Matrix4().makeTranslation(A.x, A.y, A.z).multiply(new THREE.Matrix4().makeRotationAxis(axis, s * th)).multiply(new THREE.Matrix4().makeTranslation(-A.x, -A.y, -A.z));
        const nn = nC.clone().transformDirection(rot);
        if (nn.dot(nP) > 1 - 1e-6) best = rot;
      }
      if (!best) best = new THREE.Matrix4(); // th = 0（共面）
      M[to] = M[p].clone().multiply(best);
      const Af = A.clone().applyMatrix4(M[p]), Bf = B.clone().applyMatrix4(M[p]);
      info[to] = { id: to, parent: p, hinge: { A: toPlane(Af), B: toPlane(Bf) }, theta: th, depth: info[p].depth + 1 };
    }
  }
  const faces = P.faces.map((F, i) => ({ ...info[i], poly: F.pts.map((pt) => toPlane(pt.clone().applyMatrix4(M[i]))) }));
  return { faces, root, T, tree: treeEdgeIdx };
}

// ——— 2D 不重叠（凸多边形，内部不相交；只碰到边或点不算重叠）———
function overlap2(a, b) {
  const polys = [a, b];
  for (const poly of polys) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = -(q[1] - p[1]), ny = q[0] - p[0], L = Math.hypot(nx, ny) || 1;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, y] of a) { const d = (x * nx + y * ny) / L; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const [x, y] of b) { const d = (x * nx + y * ny) / L; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6) return false; // 找到分离轴
  }
  return true;
}
export function hasOverlap(net) {
  const f = net.faces;
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (overlap2(f[i].poly, f[j].poly)) return true;
  return false;
}

// ——— 标准形（用来去掉全等的重复）：对每条有向边做对齐，取字典序最小 ———
export function canonical(net) {
  const polys = net.faces.map((f) => f.poly), all = [];
  for (const poly of polys) for (let i = 0; i < poly.length; i++) all.push([poly[i], poly[(i + 1) % poly.length]]);
  let best = null;
  for (const refl of [1, -1]) for (const [p, q] of all) for (const dir of [1, -1]) {
    const a = dir === 1 ? p : q, b = dir === 1 ? q : p, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    const tf = ([x, y]) => { let X = (x - a[0]) * c - (y - a[1]) * s, Y = (x - a[0]) * s + (y - a[1]) * c; return [Math.round(X * 1e3) / 1e3 + 0, Math.round(refl * Y * 1e3) / 1e3 + 0]; };
    const key = polys.map((poly) => poly.map(tf).map((t) => t.join(',')).sort().join(';')).sort().join('|');
    if (best === null || key < best) best = key;
  }
  return best;
}

// ——— 折叠：用铰链＋折叠角把展开图折回去，算每个面的顶点位置 ———
// 约定：展开图在 y=0 平面（x=u, z=v）；子面绕铰链转 σ·θ（σ 取「往上折」的方向），累乘到父面。
export function hingeSign(net, f) {
  const A = f.hinge.A, B = f.hinge.B, d = new THREE.Vector3(B[0] - A[0], 0, B[1] - A[1]).normalize();
  const cen = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]);
  let nc = new THREE.Vector3(cen[0] - A[0], 0, cen[1] - A[1]); nc.sub(d.clone().multiplyScalar(nc.dot(d))).normalize();
  return Math.sign(d.clone().cross(nc).y) || 1;
}
export function foldedPoints(net, frac = () => 1) {
  const F = new Array(net.faces.length), out = new Array(net.faces.length);
  const order = [...net.faces].sort((a, b) => a.depth - b.depth);
  for (const f of order) {
    if (f.parent == null) F[f.id] = new THREE.Matrix4();
    else {
      const A = f.hinge.A, B = f.hinge.B, d = new THREE.Vector3(B[0] - A[0], 0, B[1] - A[1]).normalize();
      const ang = hingeSign(net, f) * f.theta * frac(f);
      const Rm = new THREE.Matrix4().makeTranslation(A[0], 0, A[1]).multiply(new THREE.Matrix4().makeRotationAxis(d, ang)).multiply(new THREE.Matrix4().makeTranslation(-A[0], 0, -A[1]));
      F[f.id] = F[f.parent].clone().multiply(Rm);
    }
    out[f.id] = f.poly.map(([u, v]) => new THREE.Vector3(u, 0, v).applyMatrix4(F[f.id]));
  }
  return out;
}
// 核对：折完之后每个面的顶点集合 ＝ 立体对应面的顶点集合（搬到根面平放的位置后）
export function verifyFold(P, net) {
  const pts = foldedPoints(net), errs = [];
  P.faces.forEach((F, i) => {
    const want = F.pts.map((p) => net.T(p));
    const got = pts[i];
    const okAll = got.length === want.length && got.every((g) => want.some((w) => g.distanceTo(w) < 1e-5)) && want.every((w) => got.some((g) => g.distanceTo(w) < 1e-5));
    if (!okAll) errs.push(i);
  });
  return errs;
}

// ——— 全部有效展开图（不重叠、能折）———
export function enumerateNets(id) {
  const P = makePoly(id), trees = spanningTrees(P);
  const stats = { poly: id, faces: P.faces.length, trees: trees.length, overlapping: 0, valid: 0, foldFail: 0 };
  const byKey = new Map();
  for (const t of trees) {
    const net = unfold(P, t, 0);
    if (hasOverlap(net)) { stats.overlapping++; continue; }
    const bad = verifyFold(P, net);
    if (bad.length) { stats.foldFail++; continue; }
    stats.valid++;
    const key = canonical(net);
    if (!byKey.has(key)) byKey.set(key, { net, key, trees: [t] }); else byKey.get(key).trees.push(t);
  }
  stats.distinct = byKey.size;
  return { P, stats, nets: [...byKey.values()] };
}

// 立方体展开图的类别（用来给长方体的展开图分类：同一棵树放到正方体上是哪一种）
export function cubeClassOf(cubeP, tree) { return canonical(unfold(cubeP, tree, 0)); }
