// 生活中的立体：程式画的 SVG（粗墨线、鲜明色，不用 emoji）
const INK = '#3B2A1A';
const st = (w = 6, j = 'miter') => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="${j}" stroke-linecap="round"`;
const pts = (a) => a.map((p) => p.join(',')).join(' ');
const poly = (a, fill, w = 6) => `<polygon points="${pts(a)}" fill="${fill}" ${st(w)}/>`;
const shadow = (cx = 120, cy = 214, rx = 80, ry = 11) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(59,42,26,.16)"/>`;
const svg = (body) => `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${body}</svg>`;

// 等角长方体：F=前下角，a/b=左/右边长，h=高
function isoBox(F, a, b, h, [ct, cl, cr]) {
  const k = 0.866, F1 = [F[0], F[1] - h], L0 = [F[0] - k * a, F[1] - 0.5 * a], L1 = [L0[0], L0[1] - h];
  const R0 = [F[0] + k * b, F[1] - 0.5 * b], R1 = [R0[0], R0[1] - h];
  const B1 = [L1[0] + R1[0] - F1[0], L1[1] + R1[1] - F1[1]];
  const top = (s, t) => [F1[0] + s * (L1[0] - F1[0]) + t * (R1[0] - F1[0]), F1[1] + s * (L1[1] - F1[1]) + t * (R1[1] - F1[1])];
  const mat = (O, U, V) => `matrix(${U[0]} ${U[1]} ${V[0]} ${V[1]} ${O[0]} ${O[1]})`;
  const d = (p, q) => [p[0] - q[0], p[1] - q[1]];
  return {
    F, F1, L0, L1, R0, R1, B1, top,
    mTop: mat(L1, d(F1, L1), d(B1, L1)), mLeft: mat(L1, d(F1, L1), d(L0, L1)), mRight: mat(F1, d(R1, F1), d(F, F1)),
    body: poly([F1, L1, B1, R1], ct) + poly([F, L0, L1, F1], cl) + poly([F, R0, R1, F1], cr),
  };
}
const pip = (x, y) => `<circle cx="${x}" cy="${y}" r=".1" fill="${INK}"/>`;
const PIPS = {
  1: pip(.5, .5), 2: pip(.27, .27) + pip(.73, .73), 3: pip(.25, .25) + pip(.5, .5) + pip(.75, .75),
  4: pip(.27, .27) + pip(.73, .27) + pip(.27, .73) + pip(.73, .73),
  5: pip(.27, .27) + pip(.73, .27) + pip(.27, .73) + pip(.73, .73) + pip(.5, .5),
};

function dice() {
  const b = isoBox([120, 192], 74, 74, 74, ['#FFFFFF', '#FFE9C7', '#F4CC8F']);
  return svg(shadow(120, 200, 86) + b.body +
    `<g transform="${b.mTop}">${PIPS[5]}</g><g transform="${b.mLeft}">${PIPS[3]}</g><g transform="${b.mRight}">${PIPS[2]}</g>`);
}
function rubik() {
  const b = isoBox([120, 192], 74, 74, 74, ['#fff', '#fff', '#fff']);
  const cols = [['#F2564B', '#FFC93C', '#3E8EDE'], ['#46B97A', '#fff', '#F2564B'], ['#FF8A3D', '#3E8EDE', '#46B97A']];
  const grid = (m, pal) => {
    let s = '';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += `<rect x="${i / 3}" y="${j / 3}" width=".3333" height=".3333" fill="${pal[(i + j * 2) % 3 === 0 ? 0 : (i * 2 + j) % 3]}" stroke="${INK}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
    return `<g transform="${m}">${s}</g>`;
  };
  const outline = poly([b.F1, b.L1, b.B1, b.R1], 'none') + poly([b.F, b.L0, b.L1, b.F1], 'none') + poly([b.F, b.R0, b.R1, b.F1], 'none');
  return svg(shadow(120, 200, 86) + grid(b.mTop, ['#FFC93C', '#F2564B', '#FFFFFF']) + grid(b.mLeft, ['#3E8EDE', '#46B97A', '#FFC93C']) + grid(b.mRight, ['#F2564B', '#FF8A3D', '#3E8EDE']) + outline);
}
function carton() {
  const b = isoBox([120, 196], 100, 72, 64, ['#E8B368', '#D29A4A', '#B98036']);
  const t = (s, u) => b.top(s, u);
  const tape = poly([t(0, .42), t(1, .42), t(1, .58), t(0, .58)], '#FFE08A', 4);
  const tape2 = poly([[b.F[0] - 6, b.F[1] - 64 + 3], [b.F[0] + 8, b.F[1] - 64 + 3 + 1], [b.F[0] + 8, b.F[1] - 8], [b.F[0] - 6, b.F[1] - 8]], 'none', 0);
  return svg(shadow(120, 204, 96) + b.body + tape);
}
function tissue() {
  const b = isoBox([120, 190], 84, 62, 52, ['#CFE8FF', '#5BA4E8', '#3E8EDE']);
  const t = b.top;
  const c = t(.5, .5);
  return svg(shadow(120, 198, 84) + b.body +
    poly([t(.28, .28), t(.72, .28), t(.72, .72), t(.28, .72)], '#3B2A1A', 4) +
    `<path d="M${c[0] - 26},${c[1] + 2} C${c[0] - 40},${c[1] - 40} ${c[0] - 8},${c[1] - 46} ${c[0] - 6},${c[1] - 70} C${c[0] + 6},${c[1] - 56} ${c[0] + 34},${c[1] - 56} ${c[0] + 24},${c[1] - 20} C${c[0] + 34},${c[1] - 6} ${c[0] + 22},${c[1] + 8} ${c[0]},${c[1] + 8} Z" fill="#fff" ${st(5, 'round')}/>`);
}
function pyramid() {
  const Fr = [120, 196], Le = [30, 166], Re = [210, 166], Ap = [120, 38];
  return svg(`<ellipse cx="120" cy="190" rx="112" ry="30" fill="#F7E3A5"/><circle cx="196" cy="48" r="24" fill="#FF8A3D" ${st(5, 'round')}/>` +
    poly([Le, Fr, Ap], '#FFC93C') + poly([Fr, Re, Ap], '#E89F1A') +
    `<g stroke="${INK}" stroke-width="3" opacity=".45" fill="none"><path d="M${75},${101} L${120},${124}M${51},${134} L${120},${160}M${165},${101} L${120},${124}M${189},${134} L${120},${160}"/></g>`);
}
function tent() {
  const Fr = [120, 200], Le = [34, 170], Re = [206, 170], Ap = [120, 56];
  return svg(shadow(120, 204, 100, 12) +
    poly([Le, Fr, Ap], '#F2564B') + poly([Fr, Re, Ap], '#D2392F') +
    poly([[96, 196], [120, 200], [120, 122], [102, 130]], INK, 4) +
    `<line x1="120" y1="56" x2="120" y2="22" ${st(5, 'round')}/><polygon points="120,22 154,32 120,44" fill="#FFC93C" ${st(5)}/>`);
}
function iceCream() {
  const hatch = '<g stroke="' + INK + '" stroke-width="3" opacity=".55"><path d="M82,116 L130,180M100,108 L146,164M118,104 L160,150M138,104 L172,128M96,150 L108,126M120,184 L140,140"/></g>';
  return svg(shadow(120, 220, 36, 8) + poly([[66, 104], [174, 104], [120, 216]], '#FFA94D') + hatch +
    `<path d="M62,108 C52,70 76,44 120,44 C164,44 188,70 178,108 C168,116 158,112 150,120 C140,112 128,122 120,118 C112,122 100,112 90,120 C82,112 72,116 62,108 Z" fill="#FF8FA9" ${st(6, 'round')}/>` +
    `<circle cx="120" cy="38" r="14" fill="#F2564B" ${st(5, 'round')}/><path d="M120,24 C126,12 136,10 142,12" fill="none" ${st(4, 'round')}/>`);
}
function partyHat() {
  return svg(shadow(120, 216, 66, 9) +
    `<path d="M56,190 L120,46 L184,190 A64,18 0 0 1 56,190 Z" fill="#8E6BD8" ${st(6)}/>` +
    `<path d="M90,150 Q120,168 150,150 M104,112 Q120,124 136,112" fill="none" stroke="#FFC93C" stroke-width="9" stroke-linecap="round"/>` +
    `<circle cx="102" cy="176" r="8" fill="#FFC93C" ${st(3, 'round')}/><circle cx="138" cy="176" r="8" fill="#46B97A" ${st(3, 'round')}/><circle cx="120" cy="86" r="7" fill="#fff" ${st(3, 'round')}/>` +
    `<circle cx="120" cy="40" r="16" fill="#FFC93C" ${st(5, 'round')}/>`);
}
function trafficCone() {
  return svg(shadow(120, 220, 92, 10) +
    `<path d="M104,34 Q120,22 136,34 L184,184 L56,184 Z" fill="#FF8A3D" ${st(6)}/>` +
    `<path d="M92,84 L148,84 L158,118 L82,118 Z" fill="#fff" ${st(5)}/>` +
    poly([[28, 184], [212, 184], [212, 212], [28, 212]], '#3E8EDE'));
}
function can() {
  return svg(shadow(120, 220, 74, 10) +
    `<path d="M52,70 L52,184 A68,22 0 0 0 188,184 L188,70 Z" fill="#E3E8EE" ${st(6)}/>` +
    `<path d="M52,100 L52,156 A68,22 0 0 0 188,156 L188,100 A68,22 0 0 1 52,100 Z" fill="#F2564B" ${st(6)}/>` +
    `<circle cx="120" cy="132" r="14" fill="#FFC93C" ${st(4, 'round')}/>` +
    `<ellipse cx="120" cy="70" rx="68" ry="22" fill="#F5F7FA" ${st(6)}/><ellipse cx="120" cy="70" rx="42" ry="12" fill="none" ${st(3, 'round')}/>`);
}
function candle() {
  return svg(shadow(120, 220, 62, 9) +
    `<path d="M76,86 L76,194 A44,14 0 0 0 164,194 L164,86 Z" fill="#FFF0B8" ${st(6)}/>` +
    `<path d="M76,86 L76,100 Q86,116 98,100 Q108,126 120,100 Q132,122 144,100 Q154,114 164,100 L164,86 Z" fill="#fff" ${st(4, 'round')}/>` +
    `<ellipse cx="120" cy="86" rx="44" ry="14" fill="#FFFAE0" ${st(6)}/>` +
    `<line x1="120" y1="86" x2="120" y2="68" ${st(5, 'round')}/>` +
    `<path d="M120,18 C142,42 144,62 120,68 C98,62 100,42 120,18 Z" fill="#FF8A3D" ${st(5, 'round')}/><path d="M120,44 C130,54 128,62 120,64 C112,62 111,54 120,44 Z" fill="#FFC93C"/>`);
}
function cake() {
  return svg(shadow(120, 220, 96, 11) +
    `<path d="M32,104 L32,184 A88,26 0 0 0 208,184 L208,104 Z" fill="#FFC9D6" ${st(6)}/>` +
    `<path d="M32,104 Q50,132 70,104 Q88,134 108,104 Q128,134 148,104 Q168,134 188,104 Q200,120 208,104 A88,26 0 0 1 32,104 Z" fill="#fff" ${st(5, 'round')}/>` +
    `<ellipse cx="120" cy="104" rx="88" ry="26" fill="#FFF4DC" ${st(6)}/>` +
    `<circle cx="84" cy="100" r="9" fill="#F2564B" ${st(4, 'round')}/><circle cx="156" cy="100" r="9" fill="#F2564B" ${st(4, 'round')}/><circle cx="120" cy="112" r="9" fill="#F2564B" ${st(4, 'round')}/>` +
    `<rect x="115" y="62" width="10" height="34" fill="#3E8EDE" ${st(4)}/><path d="M120,40 C130,50 130,58 120,60 C110,58 110,50 120,40 Z" fill="#FFC93C" ${st(4, 'round')}/>`);
}
function basketball() {
  return svg(shadow(120, 220, 70, 9) + `<circle cx="120" cy="120" r="92" fill="#FF8A3D" ${st(6, 'round')}/>` +
    `<g fill="none" ${st(5, 'round')}><line x1="120" y1="28" x2="120" y2="212"/><line x1="28" y1="120" x2="212" y2="120"/><path d="M49.5,61 C86,92 86,148 49.5,179"/><path d="M190.5,61 C154,92 154,148 190.5,179"/></g>`);
}
function orange() {
  return svg(shadow(120, 222, 68, 9) + `<circle cx="120" cy="128" r="88" fill="#FFA21F" ${st(6, 'round')}/>` +
    `<path d="M64,100 C72,74 92,60 114,58" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".8"/>` +
    `<g fill="${INK}" opacity=".4"><circle cx="150" cy="120" r="3"/><circle cx="130" cy="156" r="3"/><circle cx="170" cy="150" r="3"/><circle cx="104" cy="132" r="3"/><circle cx="150" cy="176" r="3"/></g>` +
    `<path d="M120,42 C128,22 148,14 166,20 C160,40 142,48 120,42 Z" fill="#46B97A" ${st(5, 'round')}/><line x1="120" y1="42" x2="120" y2="30" ${st(5, 'round')}/>`);
}

// 交错排列，让相邻两件不是同一种立体
export const OBJECTS = [
  { id: 'dice', name: '骰子', solid: 'cube', svg: dice },
  { id: 'can', name: '罐头', solid: 'cylinder', svg: can },
  { id: 'icecream', name: '雪糕筒', solid: 'cone', svg: iceCream },
  { id: 'basketball', name: '篮球', solid: 'sphere', svg: basketball },
  { id: 'carton', name: '纸箱', solid: 'cuboid', svg: carton },
  { id: 'pyramid', name: '金字塔', solid: 'pyramid', svg: pyramid },
  { id: 'candle', name: '蜡烛', solid: 'cylinder', svg: candle },
  { id: 'orange', name: '橘子', solid: 'sphere', svg: orange },
  { id: 'rubik', name: '魔术方块', solid: 'cube', svg: rubik },
  { id: 'hat', name: '派对帽', solid: 'cone', svg: partyHat },
  { id: 'tissue', name: '面纸盒', solid: 'cuboid', svg: tissue },
  { id: 'tent', name: '帐篷', solid: 'pyramid', svg: tent },
  { id: 'cake', name: '蛋糕', solid: 'cylinder', svg: cake },
  { id: 'trafficcone', name: '交通锥', solid: 'cone', svg: trafficCone },
];
