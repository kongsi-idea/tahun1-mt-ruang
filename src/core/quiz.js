// 练习模式共用：大选项、即时回馈、鼓励动画（不计分、不计时、不排名）
export const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// labels: 选项文字数组；correct: 正确的 index；cols: 1~3
export function mountOptions(box, labels, correct, cols, onAnswer) {
  box.className = 'opts' + (cols === 2 ? ' c2' : '');
  if (cols === 3) box.style.gridTemplateColumns = 'repeat(3,1fr)'; else box.style.gridTemplateColumns = '';
  box.innerHTML = '';
  let done = false;
  const btns = labels.map((t, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn opt yellow'; b.innerHTML = esc(t);
    b.onclick = () => {
      if (done) return; done = true;
      const ok = i === correct;
      b.classList.add(ok ? 'right' : 'wrong');
      if (!ok) btns[correct].classList.add('right', 'hint');
      btns.forEach((x) => (x.disabled = true));
      onAnswer(ok, i);
    };
    box.appendChild(b); return b;
  });
  return { btns, isDone: () => done };
}

export function feedback(el, ok, goodMsg, tryMsg) {
  el.className = 'fb ' + (ok ? 'good' : 'try');
  el.innerHTML = ok ? `<span class="em">答对了！好棒！</span>${esc(goodMsg || '')}` : `<span class="em">没关系，再看一看</span>${esc(tryMsg || '')}`;
}
export function idleFeedback(el, msg) { el.className = 'fb'; el.innerHTML = esc(msg); }

export function burst(host) {
  if (!host) return;
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('div'); s.className = 'star';
    s.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="12,1.5 15,9 23,9.5 17,14.5 19,22.5 12,18 5,22.5 7,14.5 1,9.5 9,9" fill="#FFC93C" stroke="#3B2A1A" stroke-width="2" stroke-linejoin="miter"/></svg>';
    const a = (i / 12) * Math.PI * 2, d = 90 + Math.random() * 90;
    s.style.left = '50%'; s.style.top = '45%'; s.style.marginLeft = '-17px';
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    host.appendChild(s); setTimeout(() => s.remove(), 1200);
  }
}
