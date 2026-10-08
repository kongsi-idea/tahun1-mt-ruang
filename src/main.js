import './style.css';
import { getMode, setMode, onMode } from './core/mode.js';
import { stage } from './core/stage3d.js';

const app = document.getElementById('app');
const MODS = {
  m1: () => import('./modules/m1.js'),
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

const ICON = {
  m1: '<svg viewBox="0 0 160 140" aria-hidden="true"><polygon points="80,14 138,44 80,74 22,44" fill="#FFC93C" stroke="#3B2A1A" stroke-width="5" stroke-linejoin="miter"/><polygon points="22,44 80,74 80,132 22,102" fill="#F2564B" stroke="#3B2A1A" stroke-width="5" stroke-linejoin="miter"/><polygon points="80,74 138,44 138,102 80,132" fill="#3E8EDE" stroke="#3B2A1A" stroke-width="5" stroke-linejoin="miter"/></svg>',
  m2: '<svg viewBox="0 0 160 140" aria-hidden="true"><rect x="12" y="14" width="56" height="56" fill="#F2564B" stroke="#3B2A1A" stroke-width="5"/><circle cx="118" cy="44" r="30" fill="#FFC93C" stroke="#3B2A1A" stroke-width="5"/><polygon points="80,128 40,76 120,76" fill="#46B97A" stroke="#3B2A1A" stroke-width="5" stroke-linejoin="miter"/></svg>',
  m3: '<svg viewBox="0 0 160 140" aria-hidden="true"><rect x="8" y="45" width="36" height="36" fill="#F2564B" stroke="#3B2A1A" stroke-width="5"/><circle cx="80" cy="63" r="18" fill="#FFC93C" stroke="#3B2A1A" stroke-width="5"/><rect x="116" y="45" width="36" height="36" fill="#F2564B" stroke="#3B2A1A" stroke-width="5"/><text x="80" y="124" font-size="30" font-weight="900" text-anchor="middle" fill="#3B2A1A">?</text></svg>',
  m4: '<svg viewBox="0 0 160 140" aria-hidden="true"><rect x="20" y="70" width="60" height="56" fill="#3E8EDE" stroke="#3B2A1A" stroke-width="5"/><rect x="80" y="86" width="60" height="40" fill="#46B97A" stroke="#3B2A1A" stroke-width="5"/><polygon points="50,18 20,70 80,70" fill="#F2564B" stroke="#3B2A1A" stroke-width="5" stroke-linejoin="miter"/></svg>',
  m5: '<svg viewBox="0 0 200 110" aria-hidden="true"><g stroke="#3B2A1A" stroke-width="5"><rect x="62" y="6" width="32" height="32" fill="#F2564B"/><rect x="10" y="38" width="32" height="32" fill="#FFC93C"/><rect x="42" y="38" width="32" height="32" fill="#3E8EDE"/><rect x="74" y="38" width="32" height="32" fill="#46B97A"/><rect x="106" y="38" width="32" height="32" fill="#FF8A3D"/><rect x="42" y="70" width="32" height="32" fill="#8E6BD8"/></g></svg>',
};

function home() {
  const root = document.createElement('div');
  const top = document.createElement('div'); top.className = 'top';
  top.innerHTML = '<h1>空间小天地</h1><span class="grow"></span>';
  const mt = modeToggle(); top.appendChild(mt.el);
  offMode = mt.off;
  const card = (id, t, d, soon) => soon
    ? `<div class="card soon" aria-disabled="true">${ICON[id]}<span class="soon-tag">即将推出</span><span class="t">${t}</span><span class="d">${d}</span></div>`
    : `<a class="card" href="#/${id}" data-id="${id}">${ICON[id]}<span class="t">${t}</span><span class="d">${d}</span></a>`;
  const h = document.createElement('div'); h.className = 'home';
  h.innerHTML = `<div><h2>空间小天地</h2><p class="sub">一年级数学 · 7.0 空间　选一个来玩吧</p></div>
  <div class="cards">
    ${card('m1', 'M1 立体图形', '认识 · 面边顶点 · 生活中的立体')}
    ${card('m2', 'M2 平面图形', '正方形 长方形 三角形 圆形', true)}
    ${card('m3', 'M3 模式排列', '找出规律，猜一猜', true)}
    ${card('m4', 'M4 创意图案', '拼图案 · 搭模型', true)}
  </div>
  <a class="card ext" href="#/m5" data-id="m5">${ICON.m5}<span class="txt"><span class="t">M5 展开图　<span class="ext-tag">延伸</span></span><span class="d">正方体的 11 种展开图 · 这个能折成正方体吗？（不在一年级 DSKP 内）</span></span></a>
  <p class="hint-line">右上角可以切换「老师讲解」和「自己练习」。</p>`;
  root.append(top, h); app.appendChild(root);
}

addEventListener('hashchange', route);
route();
window.__ruang = { stage, route };
