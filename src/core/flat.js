// 平面图形数据（M2、M3、M4 共用）。数量（直线边、曲线、角）全部由这里的数据算出，不手写。
import { COLORS, INK } from './ink.js';

// 单位坐标（中心在原点）。多边形的顶点按顺时针排列。
export const FLAT = {
  square: { name: '正方形', poly: [[-1, -1], [1, -1], [1, 1], [-1, 1]], curves: 0 },
  rect: { name: '长方形', poly: [[-1.4, -0.8], [1.4, -0.8], [1.4, 0.8], [-1.4, 0.8]], curves: 0 },
  tri: { name: '三角形', poly: [[0, -1], [1.2, 1], [-1.2, 1]], curves: 0 },
  circle: { name: '圆形', poly: null, curves: 1, r: 1 },
};
export const FLAT_IDS = ['square', 'rect', 'tri', 'circle'];
export const COLOR_NAMES = { '#F2564B': '红色', '#FFC93C': '黄色', '#3E8EDE': '蓝色', '#46B97A': '绿色', '#FF8A3D': '橙色', '#8E6BD8': '紫色' };
export const PAL = COLORS;

// 数量表（由数据得出）
export const countOf = (id) => {
  const f = FLAT[id];
  return { lines: f.poly ? f.poly.length : 0, curves: f.curves, angles: f.poly ? f.poly.length : 0 };
};
export const hasAngle = (id) => countOf(id).angles > 0;

// 画一个图形（返回 SVG 字符串）。cx, cy, k=缩放（单位→画面）, rot=度, sx=水平翻转
export function flatSVG(id, { cx = 0, cy = 0, k = 40, rot = 0, color = '#FFC93C', sw = 6, flip = false, extra = '' } = {}) {
  const f = FLAT[id];
  const tf = `translate(${cx} ${cy}) rotate(${rot}) scale(${flip ? -1 : 1} 1)`;
  const st = `fill="${color}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="miter" stroke-miterlimit="8" vector-effect="non-scaling-stroke"`;
  if (id === 'circle') return `<g transform="${tf}" ${extra}><circle r="${k * f.r}" ${st}/></g>`;
  const pts = f.poly.map(([x, y]) => `${x * k},${y * k}`).join(' ');
  return `<g transform="${tf}" ${extra}><polygon points="${pts}" ${st}/></g>`;
}
// 独立小图标（按钮、选项用）
export function flatIcon(id, color = '#FFC93C', size = 56, rot = 0) {
  return `<svg viewBox="-60 -60 120 120" width="${size}" height="${size}" aria-hidden="true">${flatSVG(id, { k: 40, color, rot, sw: 6 })}</svg>`;
}
