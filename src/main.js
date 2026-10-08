import './style.css';
import { getMode, setMode, onMode } from './core/mode.js';
import { stage } from './core/stage3d.js';

const app = document.getElementById('app');
const MODS = {
  m1: () => import('./modules/m1.js'),
  m2: () => import('./modules/m2.js'),
  m3: () => import('./modules/m3.js'),
  m4: () => import('./modules/m4.js'),
  m5: () => import('./modules/m5.js'),
};
let cur = null, token = 0, offMode = null;

function modeToggle() {
  const w = document.createElement('div'); w.className = 'seg'; w.setAttribute('role', 'group'); w.setAttribute('aria-label', '模式');
  const mk = (id, txt) => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = txt; b.dataset.mode = id; b.onclick = () => setMode(id); return b; };
  w.append(mk('teach', '老师讲解'), mk('practice', '自己练习'));
  const sync = () => w.querySelectorAll('.btn').forEach((b) => { const on = b.dataset.mode === getMode(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  sync(); const off = onMode(sync);
  return { el: w, off };
}

async function route() {
  const my = ++token;
  const id = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  if (cur) { try { cur.unmount(); } catch (e) { console.error(e); } cur = null; }
  offMode?.(); offMode = null;
  app.innerHTML = '';
  document.title = '空间小天地 · 一年级数学';
  if (!MODS[id]) return home();
  const mod = (await MODS[id]()).default;
  if (my !== token) return;
  const root = document.createElement('div'); root.className = 'module';
  const top = document.createElement('div'); top.className = 'top';
  top.innerHTML = `<a class="btn small" href="#/" style="text-decoration:none;display:inline-flex;align-items:center">← 回首页</a><h1>${mod.title}</h1>${mod.ext ? '<span class="ext-tag">延伸活动（不在一年级 DSKP 内）</span>' : ''}<span class="grow"></span>`;
  const mt = modeToggle(); top.appendChild(mt.el);
  const body = document.createElement('div'); body.className = 'body';
  root.append(top, body); app.appendChild(root);
  document.title = mod.title + ' · 空间小天地';
  mod.mount(body, { getMode, onMode });
  cur = mod;
  const o1 = mt.off; offMode = () => o1();
  window.scrollTo(0, 0);
}

// 图标：120×120 同一画布、同样的线宽。面只填色不描边；外轮廓用单条闭合路径描边，所以转角是干净的尖角，没有多余的毛刺。
const SW = 'stroke="#3B2A1A" stroke-width="5"';
const ICON = {
  m1: `<svg class="ic" viewBox="0 0 120 120" aria-hidden="true"><polygon points="60,16 100,39 60,62 20,39" fill="#FFC93C"/><polygon points="20,39 60,62 60,108 20,85" fill="#F2564B"/><polygon points="60,62 100,39 100,85 60,108" fill="#3E8EDE"/><path d="M60,62 L20,39 M60,62 L100,39 M60,62 L60,108" fill="none" ${SW} stroke-linecap="round"/><path d="M60,16 L100,39 L100,85 L60,108 L20,85 L20,39 Z" fill="none" ${SW} stroke-linejoin="miter"/></svg>`,
  m2: `<svg class="ic" viewBox="0 0 120 120" aria-hidden="true"><rect x="12" y="12" width="44" height="44" fill="#F2564B" ${SW}/><circle cx="88" cy="34" r="24" fill="#FFC93C" ${SW}/><path d="M60,66 L96,112 L24,112 Z" fill="#46B97A" ${SW} stroke-linejoin="miter"/></svg>`,
  m3: `<svg class="ic" viewBox="0 0 120 120" aria-hidden="true"><rect x="5" y="14" width="34" height="34" fill="#F2564B" ${SW}/><circle cx="60" cy="31" r="17" fill="#FFC93C" ${SW}/><rect x="81" y="14" width="34" height="34" fill="#F2564B" ${SW}/><rect x="5" y="68" width="34" height="34" fill="#FFC93C" ${SW}/><circle cx="60" cy="85" r="17" fill="#fff" ${SW}/><text x="60" y="97" font-size="32" font-weight="900" text-anchor="middle" fill="#3B2A1A">?</text><rect x="81" y="68" width="34" height="34" fill="#fff" ${SW}/></svg>`,
  m4: `<svg class="ic" viewBox="0 0 120 120" aria-hidden="true"><path d="M12,108 L12,70 L44,24 L76,70 L76,108 Z" fill="#3E8EDE"/><path d="M12,70 L44,24 L76,70 Z" fill="#F2564B"/><rect x="76" y="80" width="32" height="28" fill="#46B97A"/><path d="M12,108 L12,70 L44,24 L76,70 L76,108 Z M12,70 L76,70" fill="none" ${SW} stroke-linejoin="miter"/><path d="M76,80 L108,80 L108,108 L76,108" fill="none" ${SW} stroke-linejoin="miter"/></svg>`,
  m5: `<svg class="ic" viewBox="0 0 120 120" aria-hidden="true"><g ${SW}><rect x="34" y="14" width="26" height="26" fill="#F2564B"/><rect x="8" y="40" width="26" height="26" fill="#FFC93C"/><rect x="34" y="40" width="26" height="26" fill="#3E8EDE"/><rect x="60" y="40" width="26" height="26" fill="#46B97A"/><rect x="86" y="40" width="26" height="26" fill="#FF8A3D"/><rect x="60" y="66" width="26" height="26" fill="#8E6BD8"/></g></svg>`,
};
const LOGO = `<svg viewBox="0 0 120 120" aria-hidden="true"><polygon points="60,16 100,39 60,62 20,39" fill="#FFC93C"/><polygon points="20,39 60,62 60,108 20,85" fill="#F2564B"/><polygon points="60,62 100,39 100,85 60,108" fill="#3E8EDE"/><path d="M60,62 L20,39 M60,62 L100,39 M60,62 L60,108" fill="none" stroke="#3B2A1A" stroke-width="7"/><path d="M60,16 L100,39 L100,85 L60,108 L20,85 L20,39 Z" fill="none" stroke="#3B2A1A" stroke-width="7"/></svg>`;
const CAP = { teach: '老师操作，学生先猜后揭晓', practice: '自己点选答案，答错也没关系' };
const NAME = { teach: '老师讲解', practice: '自己练习' };

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}

function home() {
  const root = document.createElement('div');
  const top = document.createElement('div'); top.className = 'top';
  top.innerHTML = `<span class="logo">${LOGO}空间小天地</span><span class="grow"></span>`;
  const mt = modeToggle(); top.appendChild(mt.el);
  const h = document.createElement('div'); h.className = 'home';
  const card = (id, cls, t, d, badge, soon) => soon
    ? `<button type="button" class="card ${cls}" data-soon="${t}">${ICON[id]}<span class="badge">即将推出</span><span class="t">${t}</span><span class="d">${d}</span></button>`
    : `<a class="card ${cls}" href="#/${id}" data-id="${id}">${ICON[id]}${badge ? `<span class="badge ext">${badge}</span>` : ''}<span class="t">${t}</span><span class="d">${d}</span></a>`;
  h.innerHTML = `<div class="hero"><p class="hello"><span>一年级数学 · 7.0 空间</span> <span>选一个来玩吧</span></p><p class="mode-cap" id="modeCap"></p></div>
  <div class="cards">
    ${card('m1', 'big', 'M1 立体图形', '认识立体 · 数面边顶点')}
    ${card('m2', 'big', 'M2 平面图形', '认识平面图形')}
    ${card('m3', '', 'M3 模式排列', '找规律，猜一猜')}
    ${card('m4', '', 'M4 创意图案', '拼图案，搭模型')}
    ${card('m5', 'm5', 'M5 展开图', '11 种 · 能折吗？', '延伸')}
  </div>`;
  const cap = h.querySelector('#modeCap');
  const sync = () => { cap.innerHTML = `<b>${NAME[getMode()]}</b>${CAP[getMode()]}`; };
  sync(); const off2 = onMode(sync);
  h.addEventListener('click', (e) => { const c = e.target.closest('[data-soon]'); if (c) toast(`${c.dataset.soon} 还在准备中，下次再来玩！`); });
  root.append(top, h); app.appendChild(root);
  const o1 = mt.off; offMode = () => { o1(); off2(); };
}

addEventListener('hashchange', route);
route();
window.__ruang = { stage, route };
