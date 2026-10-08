// 展开图验证：枚举全部 6 格拼法，用「滚动法」判定能不能折成正方体
export const key = (r, c) => r + ',' + c;
const DIRS = { N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1] };

export function normalize(cells) {
  const r0 = Math.min(...cells.map((p) => p[0])), c0 = Math.min(...cells.map((p) => p[1]));
  return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
export const sig = (cells) => normalize(cells).map((p) => key(...p)).join(';');

// 所有「固定」六连方块（不合并旋转、镜像）：应为 216 种
export function allHexominoes() {
  let cur = new Map([[sig([[0, 0]]), [[0, 0]]]]);
  for (let n = 2; n <= 6; n++) {
    const nx = new Map();
    for (const cells of cur.values()) {
      const has = new Set(cells.map((p) => key(...p)));
      for (const [r, c] of cells) for (const [dr, dc] of Object.values(DIRS)) {
        const q = [r + dr, c + dc];
        if (has.has(key(...q))) continue;
        const nc = normalize([...cells, q]);
        const s = sig(nc);
        if (!nx.has(s)) nx.set(s, nc);
      }
    }
    cur = nx;
  }
  return [...cur.values()];
}

// 滚动法：让一个立方体在展开图上滚过去，每格底面是哪一面
const ROLL = {
  E: (o) => ({ ...o, bottom: o.east, east: o.top, top: o.west, west: o.bottom }),
  W: (o) => ({ ...o, bottom: o.west, west: o.top, top: o.east, east: o.bottom }),
  N: (o) => ({ ...o, bottom: o.north, north: o.top, top: o.south, south: o.bottom }),
  S: (o) => ({ ...o, bottom: o.south, south: o.top, top: o.north, north: o.bottom }),
};

// root 必须与 3D 折叠用的是同一格
export function analyze(cells, root) {
  const has = new Set(cells.map((p) => key(...p)));
  const faceOf = new Map(), orient = new Map();
  const r0 = root || cells[0];
  const o0 = { bottom: 0, top: 1, north: 2, south: 3, west: 4, east: 5 };
  orient.set(key(...r0), o0); faceOf.set(key(...r0), 0);
  const q = [r0];
  while (q.length) {
    const p = q.shift();
    for (const [d, [dr, dc]] of Object.entries(DIRS)) {
      const nb = [p[0] + dr, p[1] + dc], k = key(...nb);
      if (!has.has(k) || orient.has(k)) continue;
      const o = ROLL[d](orient.get(key(...p)));
      orient.set(k, o); faceOf.set(k, o.bottom); q.push(nb);
    }
  }
  // 非树边一致性检查（含 2×2 方块这类有环的拼法）
  let cyc = false;
  for (const p of cells) for (const [d, [dr, dc]] of Object.entries(DIRS)) {
    const k = key(p[0] + dr, p[1] + dc);
    if (has.has(k) && ROLL[d](orient.get(key(...p))).bottom !== faceOf.get(k)) cyc = true;
  }
  const by = new Map();
  for (const [k, f] of faceOf) by.set(f, [...(by.get(f) || []), k]);
  const dups = [...by.values()].filter((g) => g.length > 1);
  return { valid: !cyc && dups.length === 0, cyc, dups, faceOf };
}

// 含 2×2 方块的有环拼法也一定不能折（四格会让同一个面重叠），照样放进题库
// 与 3D 折叠相同的根格选法
export function pickRoot(cells) {
  const has = new Set(cells.map((p) => key(...p)));
  const R = Math.max(...cells.map((p) => p[0])) + 1, C = Math.max(...cells.map((p) => p[1])) + 1;
  const deg = (p) => Object.values(DIRS).filter((d) => has.has(key(p[0] + d[0], p[1] + d[1]))).length;
  const dist = (p) => Math.abs(p[0] - (R - 1) / 2) + Math.abs(p[1] - (C - 1) / 2);
  return [...cells].sort((a, b) => deg(b) - deg(a) || dist(a) - dist(b))[0];
}

export const landscape = (n) => {
  const h = Math.max(...n.map((p) => p[0])) + 1, w = Math.max(...n.map((p) => p[1])) + 1;
  return h > w ? normalize(n.map(([r, c]) => [c, r])) : n;
};

// 11 种展开图（与 _demo-net.html 相同）
export const RAW = [
  [[0,0],[0,1],[0,2],[1,2],[1,3],[1,4]],
  [[0,0],[0,1],[1,1],[1,2],[1,3],[2,1]],
  [[0,0],[0,1],[1,1],[1,2],[1,3],[2,2]],
  [[0,0],[0,1],[1,1],[1,2],[1,3],[2,3]],
  [[0,0],[0,1],[1,1],[1,2],[2,2],[2,3]],
  [[0,1],[1,0],[1,1],[1,2],[1,3],[2,1]],
  [[0,1],[1,0],[1,1],[1,2],[1,3],[2,2]],
  [[0,0],[0,1],[0,2],[1,1],[2,1],[3,1]],
  [[0,0],[0,1],[1,1],[1,2],[2,1],[3,1]],
  [[0,0],[0,1],[1,1],[2,1],[2,2],[3,1]],
  [[0,0],[0,1],[1,1],[2,1],[3,1],[3,2]]];
export const NETS = RAW.map(landscape);

export function buildPools() {
  const all = allHexominoes();
  const valid = [], invalid = [];
  for (const c of all) {
    const a = analyze(c, pickRoot(c));
    if (a.valid) valid.push(c);
    else if (a.dups.length) invalid.push({ cells: c, dups: a.dups });
  }
  return { total: all.length, valid, invalid, cyclic: all.length - valid.length - invalid.length };
}
