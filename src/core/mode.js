// 老师讲解 / 自己练习：选择存在 localStorage（读写都包 try/catch）
const KEY = 'ruang.mode';
let cur = 'teach';
try { const v = localStorage.getItem(KEY); if (v === 'teach' || v === 'practice') cur = v; } catch (e) {}
const subs = new Set();
export const getMode = () => cur;
export function setMode(m) {
  if (m === cur) return;
  cur = m;
  try { localStorage.setItem(KEY, m); } catch (e) {}
  subs.forEach((f) => f(m));
}
export const onMode = (f) => { subs.add(f); return () => subs.delete(f); };
