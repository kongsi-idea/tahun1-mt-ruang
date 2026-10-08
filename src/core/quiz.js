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

// ———— 通用题目面板（M2–M5 新模块用）————
// q: { title(html), labels[], correct(index) 或 multi:true + correctSet[](index),
//      cols, done, picked, ok, goodMsg, badMsg, onDone(ok) }
// opts: { next(), burstHost, extra(html) }
export function renderQuiz(box, q, opts = {}) {
  const multi = !!q.multi;
  box.innerHTML = `<div class="quiz-q">${q.title}</div><div class="opts" id="qopts"></div><div class="fb" id="qfb"></div>${opts.extra || ''}` +
    (multi && !q.done ? '<button type="button" class="btn s6 blue" id="qok" disabled>确定</button>' : '') +
    `<button type="button" class="btn s6 green" id="qnext" style="${q.done ? '' : 'visibility:hidden'}">下一题 ▶</button>`;
  const ob = box.querySelector('#qopts'), fb = box.querySelector('#qfb');
  ob.className = 'opts' + (q.cols === 2 ? ' c2' : '') + (q.cols === 4 ? ' c4' : '');
  ob.style.gridTemplateColumns = q.cols === 3 ? 'repeat(3,1fr)' : q.cols === 4 ? 'repeat(2,1fr)' : '';
  const sel = new Set(q.picked || []);
  const set = new Set(multi ? q.correctSet : [q.correct]);
  const btns = q.labels.map((t, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn opt yellow'; b.innerHTML = esc(t); b.dataset.i = i;
    ob.appendChild(b); return b;
  });
  const paint = () => btns.forEach((b, i) => {
    b.classList.remove('right', 'wrong', 'hint', 'sel');
    if (q.done) {
      b.disabled = true;
      if (set.has(i)) b.classList.add('right'); if (set.has(i) && !sel.has(i)) b.classList.add('hint');
      if (sel.has(i) && !set.has(i)) b.classList.add('wrong');
    } else if (sel.has(i)) b.classList.add('sel');
  });
  const finish = () => {
    q.picked = [...sel]; q.done = true;
    q.ok = multi ? (sel.size === set.size && [...sel].every((i) => set.has(i))) : sel.has(q.correct);
    if (q.ok && opts.burstHost) burst(opts.burstHost);
    q.onDone?.(q.ok);
    renderQuiz(box, q, opts);
  };
  btns.forEach((b, i) => (b.onclick = () => {
    if (q.done) return;
    if (multi) { sel.has(i) ? sel.delete(i) : sel.add(i); paint(); box.querySelector('#qok').disabled = sel.size === 0; }
    else { sel.clear(); sel.add(i); finish(); }
  }));
  if (multi && !q.done) box.querySelector('#qok').onclick = finish;
  paint();
  if (q.done) {
    fb.className = 'fb ' + (q.ok ? 'good' : 'try');
    fb.innerHTML = (q.ok ? '<span class="em">答对了！好棒！</span>' + esc(q.goodMsg || '') : '<span class="em">没关系，再看一看</span>' + esc(q.badMsg || ''));
  } else idleFeedback(fb, q.hint || (multi ? '可以选好几个，选好了按「确定」。' : '看一看，选一个答案。'));
  box.querySelector('#qnext').onclick = () => opts.next?.();
}
