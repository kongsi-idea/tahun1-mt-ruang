// 创意图案的三级小挑战（SPEC §8-5）的「数据层」：图案库、出题、比对。没有任何 DOM，可以直接拿来自动核对。
// 图案用「单位坐标」：1 单位＝图形的半边（正方形半边长＝1，长方形 ±1.4×±0.8，三角形尖在 (0,-1)、底在 y=1 宽 ±1.2，圆半径 1）。
import { FLAT, PAL } from '../core/flat.js';

export const KC = 34;            // 1 单位 = 34 像素（与自由创作的画布同大）
export const CW = 480, CH = 420; // 挑战画布
export const AX = CW / 2;        // 对称轴 x
export const DX = CW / 2;        // 照样拼：左半边 → 右半边 的平移量
export const TOL = 15;           // 位置容许误差（像素，约半个格）
export const COLORS7 = [...PAL, '#FFFFFF'];
export const TYPE_ZH = { square: '正方形', rect: '长方形', tri: '三角形', circle: '圆形' };
export const TYPES = ['square', 'rect', 'tri', 'circle'];

// 图案库：每块 { t 形状, x, y, r 旋转度（顺时针）, c 颜色编号, opt 可有可无（照样拼时省略） }
const P = (t, x, y, r = 0, c = 0, opt = false) => ({ t, x, y, r, c, opt });
const R_ = '#F2564B', Y_ = '#FFC93C', B_ = '#3E8EDE', G_ = '#46B97A', O_ = '#FF8A3D', U_ = '#8E6BD8', W_ = '#FFFFFF';
export const PICS = [
  { id: 'rocket', name: '火箭', themes: [[R_, W_, B_, Y_], [B_, Y_, R_, U_], [U_, W_, O_, G_]], parts: [
    P('tri', 0, -4.2, 0, 0), P('square', 0, -2.2, 0, 1), P('circle', 0, -2.2, 0, 2),
    P('square', 0, -0.2, 0, 1), P('square', 0, 1.8, 0, 1),
    P('tri', -2, 2.6, -90, 0), P('tri', 2, 2.6, 90, 0),
    P('rect', 0, 3.4, 0, 3), P('tri', 0, 5, 180, 2),
    P('rect', -1.8, -0.2, 90, 2, true), P('rect', 1.8, -0.2, 90, 2, true),
  ] },
  // 屋顶是 4 个三角形拼成的大三角形（3 个朝上＋1 个朝下），身体 2×2 个正方形
  { id: 'house', name: '房子', themes: [[R_, Y_, B_, W_], [U_, W_, O_, B_], [O_, W_, G_, B_]], parts: [
    P('tri', 0, -2, 0, 0), P('tri', -1.2, 0, 0, 0), P('tri', 0, 0, 180, 0), P('tri', 1.2, 0, 0, 0),
    P('square', -1, 2, 0, 1), P('square', 1, 2, 0, 1), P('square', -1, 4, 0, 1), P('square', 1, 4, 0, 1),
    P('circle', -1, 2, 0, 3), P('rect', 1, 3.6, 90, 2),
    P('circle', -3.8, -2.6, 0, 3, true), P('square', -3.4, 4, 0, 0, true),
  ] },
  { id: 'robot', name: '机器人', themes: [[O_, B_, Y_, W_], [U_, G_, Y_, W_], [R_, Y_, B_, W_]], parts: [
    P('tri', 0, -5.2, 0, 0), P('square', -1, -3, 0, 1), P('square', 1, -3, 0, 1), P('circle', -1, -3, 0, 3), P('circle', 1, -3, 0, 3),
    P('square', -1, -1, 0, 2), P('square', 1, -1, 0, 2), P('square', -1, 1, 0, 2), P('square', 1, 1, 0, 2),
    P('rect', -2.8, 0, 90, 0, true), P('rect', 2.8, 0, 90, 0, true),
    P('rect', -1, 3.4, 90, 0, true), P('rect', 1, 3.4, 90, 0, true),
  ] },
  { id: 'fish', name: '小鱼', themes: [[O_, R_, B_, W_], [B_, Y_, G_, W_], [U_, O_, B_, W_]], parts: [
    P('square', -0.8, 0, 45, 0), P('square', 0.8, 0, 45, 0), P('tri', -3.2, 0, 90, 1), P('tri', 0, -2.3, 0, 1), P('tri', 0, 2.3, 180, 1),
    P('circle', 1.2, -0.1, 0, 3), P('circle', 3.6, -2.2, 0, 2, true), P('circle', 4.2, -4.2, 0, 2, true), P('rect', -3.4, 3.6, 90, 2, true),
  ] },
  { id: 'tree', name: '大树', themes: [[G_, O_, Y_, R_], [G_, U_, O_, B_]], parts: [
    P('tri', 0, -5, 0, 0), P('tri', 0, -3.2, 0, 0), P('tri', 0, -1.4, 0, 0),
    P('square', 0, 0.6, 0, 1), P('square', 0, 2.6, 0, 1),
    P('square', -2.2, 2.6, 0, 3, true), P('square', 2.2, 2.6, 0, 3, true), P('circle', 3.6, -4.4, 0, 2, true),
  ] },
];

// ——— 图形几何 ———
export const rotPeriod = (t) => (t === 'square' ? 90 : t === 'rect' ? 180 : t === 'circle' ? 1 : 360);
export const normRot = (t, r) => { const p = rotPeriod(t); return ((r % p) + p) % p; };
export const rotEq = (t, a, b) => { const p = rotPeriod(t), d = Math.abs(normRot(t, a) - normRot(t, b)); return Math.min(d, p - d) < 1; };
// 水平镜像后的旋转角（对垂直轴镜像：顺时针变逆时针）
export const mirrorRot = (t, r) => normRot(t, -r);

export function polyOf(t, k = 1) { const f = FLAT[t]; return f.poly ? f.poly.map(([x, y]) => [x * k, y * k]) : null; }
// 单位图案 → 像素图案（以 cx,cy 为图案中心）
export function toPx(parts, cx, cy, k = KC) { return parts.map((p) => ({ ...p, x: cx + p.x * k, y: cy + p.y * k })); }
export function bboxUnits(parts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of parts) {
    const pts = p.t === 'circle' ? [[-1, -1], [1, -1], [1, 1], [-1, 1]] : polyOf(p.t);
    const a = (p.r * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    for (const [x, y] of pts) { const X = p.x + x * c - y * s, Y = p.y + x * s + y * c; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// 生成图案实例：随机配色、随机左右翻转（翻转用同一套数据变换，所以旋转角也要一起翻）
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export function instPic(pic, { flip = Math.random() < 0.5, optional = true } = {}) {
  const cols = pick(pic.themes);
  const parts = pic.parts.filter((p) => optional || !p.opt).map((p) => ({ t: p.t, x: flip ? -p.x : p.x, y: p.y, r: flip ? mirrorRot(p.t, p.r) : normRot(p.t, p.r) || 0, color: cols[p.c], opt: p.opt }));
  const bb = bboxUnits(parts);
  // 居中
  return { id: pic.id, name: pic.name, parts: parts.map((p) => ({ ...p, x: p.x - bb.cx, y: p.y - bb.cy })), w: bb.w, h: bb.h, flip };
}

// ——— ① 拼图数数 ———
export function genCount(picId) {
  const pic = picId ? PICS.find((p) => p.id === picId) : pick(PICS);
  const inst = instPic(pic, { optional: true });
  const count = {}; TYPES.forEach((t) => (count[t] = inst.parts.filter((p) => p.t === t).length));
  const present = TYPES.filter((t) => count[t] > 0);
  const nAsk = Math.random() < 0.5 && present.length >= 2 ? 2 : 1;
  const asks = shuffle(present).slice(0, nAsk).sort((a, b) => TYPES.indexOf(a) - TYPES.indexOf(b));
  const answer = asks.map((t) => count[t]);
  // 选项
  const labelOf = (nums) => (asks.length === 1 ? String(nums[0]) : asks.map((t, i) => `${TYPE_ZH[t]} ${nums[i]} 个`).join('，'));
  const opts = [answer];
  const key = (a) => a.join(',');
  for (let t = 0; t < 200 && opts.length < 3; t++) {
    const w = [...answer];
    if (asks.length === 1) w[0] = Math.max(1, answer[0] + pick([-2, -1, 1, 2]));
    else { const i = rnd(2); w[i] = Math.max(1, w[i] + pick([-1, 1, 2])); if (Math.random() < 0.3) { const j = 1 - i; w[j] = Math.max(1, w[j] + pick([-1, 1])); } if (Math.random() < 0.25) w.reverse(); }
    if (!opts.some((o) => key(o) === key(w))) opts.push(w);
  }
  const options = shuffle(opts);
  return { kind: 'count', pic: inst, asks, answer, count, options, optionLabels: options.map(labelOf), correct: options.findIndex((o) => key(o) === key(answer)), labelOf };
}
export function countTitle(q) { return `用了几个${q.asks.map((t) => TYPE_ZH[t]).join('？几个')}？`.replace(/？几个/g, '？几个'); }

// ——— ② 补对称 ———
// 左半边随机拼 4–6 块（放在 2 列 × 4 行的格子里，不重叠、不越过对称轴），学生在右半边拼出镜像
const CELLS_X = [AX - 62, AX - 175], CELLS_Y = [58, 150, 242, 334]; // 左半边格子中心（像素）
export function genSym() {
  const cells = shuffle(CELLS_X.flatMap((x) => CELLS_Y.map((y) => ({ x, y })))).slice(0, 4 + rnd(3));
  const cols = shuffle(COLORS7).slice(0, 4);
  const left = cells.map((c) => {
    const t = pick(TYPES);
    const r = t === 'tri' ? pick([0, 90, 180, 270]) : t === 'rect' ? pick([0, 90]) : t === 'square' ? pick([0, 45]) : 0;
    return { t, x: c.x, y: c.y, r, color: pick(cols) };
  });
  const target = left.map((p) => ({ t: p.t, x: 2 * AX - p.x, y: p.y, r: mirrorRot(p.t, p.r), color: p.color }));
  return { kind: 'sym', left, target };
}

// ——— ③ 照样拼 ———
// 左半边是目标图（可有可无的块省略，块数 5–9），学生在右半边照样拼（同一个形状、方向、相对位置）
export function genCopy(picId) {
  const pic = picId ? PICS.find((p) => p.id === picId) : pick(PICS);
  const inst = instPic(pic, { optional: false });
  const bb = bboxUnits(inst.parts);
  const parts = inst.parts.map((p) => ({ ...p, x: p.x - bb.cx, y: p.y - bb.cy }));
  const cx = AX / 2, cy = CH / 2;
  const left = toPx(parts, cx, cy);
  const target = left.map((p) => ({ ...p, x: p.x + DX }));
  return { kind: 'copy', name: pic.name, left, target };
}

// ——— 比对（二分图匹配）———
// targets: [{t,x,y,r}]；mine: [{id,t,x,y,r}]。形状、方向（照对称性取模）、位置（容许 tol 像素）都吻合才算。
export function matchParts(targets, mine, tol = TOL) {
  const ok = (a, b) => a.t === b.t && rotEq(a.t, a.r, b.r) && Math.hypot(a.x - b.x, a.y - b.y) <= tol;
  const adj = targets.map((t) => mine.map((m, j) => (ok(t, m) ? j : -1)).filter((j) => j >= 0));
  const owner = new Array(mine.length).fill(-1);
  const tryT = (i, seen) => { for (const j of adj[i]) { if (seen[j]) continue; seen[j] = true; if (owner[j] < 0 || tryT(owner[j], seen)) { owner[j] = i; return true; } } return false; };
  targets.forEach((_, i) => tryT(i, []));
  const matchedT = new Set(owner.filter((x) => x >= 0));
  const missing = targets.map((t, i) => i).filter((i) => !matchedT.has(i));
  const extra = mine.map((m, j) => j).filter((j) => owner[j] < 0);
  return { ok: missing.length === 0 && extra.length === 0, missing, extra, matched: matchedT.size, owner };
}

// ——— 立体小挑战的文字 ———
export const SOLID_ORDER = ['cube', 'cuboid', 'pyramid', 'cone', 'cylinder', 'sphere'];
export function solidLabel(counts, names) {
  return SOLID_ORDER.filter((t) => counts[t] > 0).map((t) => `${names[t]} ${counts[t]} 个`).join('，');
}
