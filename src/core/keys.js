// 快捷键提示：宽屏（≥1400）每个快捷键一行；窄屏只显示一个按钮，点开再看；手机隐藏（CSS）
let open = false;
export const toggleKeys = () => { open = !open; };
export function keysHTML(items) {
  const body = items.map(([k, t]) => `<span class="k">${k} ${t}</span>`).join('');
  if (innerWidth >= 1400) return `<div class="keys">${body}</div>`;
  return `<div class="keys"><button class="btn small" data-a="keys" aria-expanded="${open}">⌨ 快捷键</button>${open ? `<div class="kb">${body}</div>` : ''}</div>`;
}
