// 墨线：屏幕等宽粗线（Line2）＋ 顶点尖角补丁（miter）＋ 共用颜色
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

export const COLORS = ['#F2564B', '#FFC93C', '#3E8EDE', '#46B97A', '#FF8A3D', '#8E6BD8'];
export const INK = '#3B2A1A';
export const INK_PX = 4.5;

// 线条往镜头方向挪一点点深度（固定的 NDC 偏移），让线稳稳压在面上，不被相邻面咬掉一截
export const LINE_BIAS = 1.5e-4;
function biased(m) {
  m.vertexShader = m.vertexShader.replace('gl_Position = clip;', `clip.z -= ${LINE_BIAS} * clip.w; gl_Position = clip;`);
  return m;
}

// 所有墨线共用一个材质 → 线宽处处一致
export const inkMat = biased(new LineMaterial({ color: INK, linewidth: INK_PX }));
inkMat.userData.shared = true;
export const hlMats = {
  line: biased(new LineMaterial({ color: '#F2564B', linewidth: 9, depthTest: false })),
  curve: biased(new LineMaterial({ color: '#3E8EDE', linewidth: 9, depthTest: false })),
  cur: biased(new LineMaterial({ color: '#FFC93C', linewidth: 12, depthTest: false })),
};
Object.values(hlMats).forEach((m) => (m.userData.shared = true));
export const allLineMats = [inkMat, ...Object.values(hlMats)];

export function setResolution(w, h) {
  allLineMats.forEach((m) => m.resolution.set(w, h));
}

export function lineFrom(points, mat = inkMat) {
  const g = new LineGeometry();
  g.setPositions(points.flatMap((p) => (Array.isArray(p) ? p : [p.x, p.y, p.z])));
  const l = new Line2(g, mat);
  l.computeLineDistances();
  return l;
}

// 动态线（每帧改点，不重新配置内存）
export function dynamicLine(nPoints, mat = inkMat) {
  const g = new LineGeometry();
  g.setPositions(new Float32Array(nPoints * 3));
  const l = new Line2(g, mat);
  l.frustumCulled = false;
  l.userData.n = nPoints;
  return l;
}
export function setDynamic(line, pts) {
  const arr = line.geometry.attributes.instanceStart.data.array;
  const n = line.userData.n;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    arr[i * 6] = a.x; arr[i * 6 + 1] = a.y; arr[i * 6 + 2] = a.z;
    arr[i * 6 + 3] = b.x; arr[i * 6 + 4] = b.y; arr[i * 6 + 5] = b.z;
  }
  line.geometry.attributes.instanceStart.data.needsUpdate = true;
}

export function circlePts(r, y, n = 96, cx = 0, cz = 0) {
  const a = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    a.push(new THREE.Vector3(cx + Math.cos(t) * r, y, cz + Math.sin(t) * r));
  }
  return a;
}

// 面材质：略往后推，让边线压在面上不闪烁
export function faceMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.62, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...extra,
  });
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { if (!x.userData?.shared) x.dispose(); });
  });
}

// —— 顶点尖角补丁 ——
// 圆头线帽在转角处会有半径 ≈2px 的圆角；在最外侧的转角补一块尖角（miter），让顶点是真尖角。
const MAX = 96;
export class Corners {
  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.clip = new Float32Array(MAX * 6 * 4);
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6 * 3), 3));
    this.geo.setAttribute('aClip', new THREE.BufferAttribute(this.clip, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(INK) } },
      vertexShader: `attribute vec4 aClip; void main(){ gl_Position = aClip; gl_Position.z -= ${LINE_BIAS} * gl_Position.w; }`,
      fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor,1.0); gl_FragColor = linearToOutputTexel(gl_FragColor); }',
      side: THREE.DoubleSide,
    });
    this.mat.userData.shared = false;
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.geo.setDrawRange(0, 0);
    this._v = new THREE.Vector4();
    this._m = new THREE.Matrix4();
  }
  // segs: [[Vector3 world a, Vector3 world b], ...]
  update(segs, cam, W, H, wpx = INK_PX) {
    cam.updateMatrixWorld();
    this._m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const verts = new Map();
    const P = (p) => {
      this._v.set(p.x, p.y, p.z, 1).applyMatrix4(this._m);
      if (this._v.w <= 1e-4) return null;
      return { x: (this._v.x / this._v.w) * W / 2, y: (this._v.y / this._v.w) * H / 2, z: this._v.z / this._v.w, w: this._v.w };
    };
    const add = (p, q) => {
      const k = Math.round(p.x * 500) + ',' + Math.round(p.y * 500) + ',' + Math.round(p.z * 500);
      const sp = P(p), sq = P(q);
      if (!sp || !sq) return;
      const dx = sq.x - sp.x, dy = sq.y - sp.y, L = Math.hypot(dx, dy);
      if (L < 1e-3) return;
      let e = verts.get(k);
      if (!e) verts.set(k, (e = { s: sp, dirs: [] }));
      e.dirs.push([dx / L, dy / L]);
    };
    for (const [a, b] of segs) { add(a, b); add(b, a); }
    let n = 0;
    const h = wpx / 2;
    const out = (x, y, s) => {
      const i = n * 4; n++;
      this.clip[i] = (x * 2 / W) * s.w; this.clip[i + 1] = (y * 2 / H) * s.w; this.clip[i + 2] = s.z * s.w; this.clip[i + 3] = s.w;
    };
    for (const e of verts.values()) {
      if (e.dirs.length < 2 || n > (MAX - 1) * 6) continue;
      const ang = e.dirs.map((d) => Math.atan2(d[1], d[0])).sort((a, b) => a - b);
      let gap = -1, ia = 0;
      for (let i = 0; i < ang.length; i++) {
        const nx = i + 1 < ang.length ? ang[i + 1] : ang[0] + Math.PI * 2;
        if (nx - ang[i] > gap) { gap = nx - ang[i]; ia = i; }
      }
      if (gap <= Math.PI + 0.02) continue;
      const aEnd = ang[ia], bStart = ang[(ia + 1) % ang.length];
      const da = [Math.cos(aEnd), Math.sin(aEnd)], db = [Math.cos(bStart), Math.sin(bStart)];
      const theta = Math.PI * 2 - gap; // 两边夹角（内侧）
      if (theta < 0.5 || theta > Math.PI - 0.03) continue;
      const bx = da[0] + db[0], by = da[1] + db[1], bl = Math.hypot(bx, by);
      if (bl < 1e-4) continue;
      const bis = [bx / bl, by / bl];
      const mlen = h / Math.sin(theta / 2);
      const M = [e.s.x - bis[0] * mlen, e.s.y - bis[1] * mlen];
      const nrm = (d, o) => { let nx = -d[1], ny = d[0]; if (nx * o[0] + ny * o[1] > 0) { nx = -nx; ny = -ny; } return [nx, ny]; };
      const na = nrm(da, db), nb = nrm(db, da);
      const A = [e.s.x + na[0] * h, e.s.y + na[1] * h], B = [e.s.x + nb[0] * h, e.s.y + nb[1] * h];
      out(e.s.x, e.s.y, e.s); out(A[0], A[1], e.s); out(M[0], M[1], e.s);
      out(e.s.x, e.s.y, e.s); out(M[0], M[1], e.s); out(B[0], B[1], e.s);
    }
    this.geo.attributes.aClip.needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
