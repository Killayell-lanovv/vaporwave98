/* ===== Armazenamento da galeria (IndexedDB) ===== */
const DB = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('vaporos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode);
      const req = fn(t.objectStore('photos'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  },
  add(blob, name) { return this.tx('readwrite', (s) => s.add({ blob, name, date: Date.now() })); },
  getAll() { return this.tx('readonly', (s) => s.getAll()); },
  remove(id) { return this.tx('readwrite', (s) => s.delete(id)); },
};

/* ===== Utilidades de cor ===== */
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (d) => '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');

/* ===== Balde de tinta ===== */
function floodFill(ctx, x, y, hex) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data, vis = new Uint8Array(w * h);
  const o = (y * w + x) * 4, tr = d[o], tg = d[o + 1], tb = d[o + 2];
  const c = hexToRgb(hex);
  const ok = (i) => !vis[i >> 2] && Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= 60;
  const stack = [[x, y]];
  while (stack.length) {
    let [cx, cy] = stack.pop();
    let i = (cy * w + cx) * 4;
    while (cy >= 0 && ok(i)) { cy--; i -= w * 4; }
    cy++; i += w * 4;
    let l = false, r = false;
    while (cy < h && ok(i)) {
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; vis[i >> 2] = 1;
      if (cx > 0) { if (ok(i - 4)) { if (!l) { stack.push([cx - 1, cy]); l = true; } } else l = false; }
      if (cx < w - 1) { if (ok(i + 4)) { if (!r) { stack.push([cx + 1, cy]); r = true; } } else r = false; }
      cy++; i += w * 4;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ===== App Paint ===== */
function renderPaint(body) {
  const S = { tool: 'pencil', color: '#000000', size: 4, fill: false };
  const TOOLS = [
    ['pencil', '✏️', 'Lápis'], ['brush', '🖌️', 'Pincel'], ['spray', '💨', 'Spray'],
    ['eraser', '🧽', 'Borracha'], ['line', '📏', 'Linha'], ['rect', '⬜', 'Retângulo'],
    ['ellipse', '⭕', 'Elipse'], ['fill', '🪣', 'Balde de tinta'], ['picker', '💉', 'Conta-gotas'],
    ['text', '🔤', 'Texto'],
  ];
  const COLORS = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#ff71ce', '#b967ff', '#01cdfe', '#05ffa1', '#fffb96', '#ff9d00',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffb3e6', '#d4b3ff', '#b3ecff', '#b3ffe0', '#fff7b3', '#ffd699',
  ];

  body.innerHTML = `
    <div class="paint">
      <div class="p-tools t"></div>
      <div class="p-tools a"></div>
      <div class="p-canvaswrap"><canvas width="640" height="480"></canvas></div>
      <div class="p-bottom">
        <div class="p-cur sunken"></div>
        <div class="p-palette"></div>
        <label class="p-size">Tam <input type="range" min="1" max="40" value="4"> <b>4</b></label>
        <input type="color" value="#000000" title="Cor personalizada">
      </div>
      <div class="p-status sunken">Lápis</div>
    </div>`;

  const $ = (s) => body.querySelector(s);
  const cv = $('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.lineJoin = 'round';
  const status = $('.p-status');
  const say = (t) => { status.textContent = t; };

  /* Ajusta o tamanho do canvas na tela */
  const wrap = $('.p-canvaswrap');
  const fit = () => {
    const s = Math.min((wrap.clientWidth - 8) / cv.width, (wrap.clientHeight - 8) / cv.height);
    cv.style.width = Math.max(60, cv.width * s) + 'px';
    cv.style.height = Math.max(45, cv.height * s) + 'px';
  };
  new ResizeObserver(fit).observe(wrap);

  /* Desfazer */
  const undo = [];
  const pushUndo = () => {
    undo.push(ctx.getImageData(0, 0, cv.width, cv.height));
    if (undo.length > 20) undo.shift();
  };

  /* Ferramentas */
  const tools = $('.p-tools.t');
  TOOLS.forEach(([id, ic, nm]) => {
    const b = document.createElement('button');
    b.textContent = ic; b.title = nm;
    if (id === S.tool) b.classList.add('sel');
    b.onclick = () => {
      S.tool = id;
      tools.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
      say(nm);
    };
    tools.appendChild(b);
  });

  /* Ações */
  const ACTS = [
    ['↶', 'Desfazer', () => { const s = undo.pop(); if (s) ctx.putImageData(s, 0, 0); }],
    ['🗑️', 'Nova imagem', () => { pushUndo(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); say('Nova imagem'); }],
    ['◼', 'Formas preenchidas (liga/desliga)', (b) => {
      S.fill = !S.fill; b.classList.toggle('sel', S.fill);
      say(S.fill ? 'Formas preenchidas' : 'Formas só com contorno');
    }],
    ['💾', 'Salvar na galeria', () => {
      cv.toBlob(async (blob) => {
        try {
          const nome = 'desenho-' + new Date().toLocaleString('pt-BR').replace(/[\/:, ]+/g, '-') + '.png';
          await DB.add(blob, nome);
          say('Salvo na galeria! ✔');
        } catch (e) { say('Erro ao salvar: ' + e.message); }
      }, 'image/png');
    }],
    ['⬇️', 'Baixar PNG', () => {
      cv.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'desenho.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    }],
  ];
  const acts = $('.p-tools.a');
  ACTS.forEach(([ic, nm, fn]) => {
    const b = document.createElement('button');
    b.textContent = ic; b.title = nm;
    b.onclick = () => fn(b);
    acts.appendChild(b);
  });

  /* Cores e tamanho */
  const cur = $('.p-cur'), picker = $('input[type=color]');
  const setColor = (c) => { S.color = c; cur.style.background = c; picker.value = c; };
  COLORS.forEach((c) => {
    const s = document.createElement('div');
    s.className = 'sw'; s.style.background = c;
    s.onclick = () => setColor(c);
    $('.p-palette').appendChild(s);
  });
  picker.oninput = () => setColor(picker.value);
  const range = $('input[type=range]');
  range.oninput = () => { S.size = +range.value; $('.p-size b').textContent = S.size; };
  setColor('#000000');

  /* Desenho */
  let drawing = false, last = null, start = null, snap = null, sprayTimer = null;
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
  };

  function styleFor(t) {
    ctx.lineCap = 'round';
    ctx.shadowBlur = 0;
    ctx.lineWidth = S.size;
    ctx.strokeStyle = t === 'eraser' ? '#fff' : S.color;
    ctx.fillStyle = S.color;
    if (t === 'pencil') ctx.lineWidth = Math.max(1, S.size / 2);
    if (t === 'eraser') ctx.lineWidth = S.size * 3;
    if (t === 'brush') { ctx.lineWidth = S.size * 1.5; ctx.shadowBlur = S.size; ctx.shadowColor = S.color; }
  }

  function shape(t, a, b) {
    ctx.beginPath();
    if (t === 'line') { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    if (t === 'rect') {
      if (S.fill) ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      else ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    if (t === 'ellipse') {
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      S.fill ? ctx.fill() : ctx.stroke();
    }
  }

  function spray(p) {
    ctx.fillStyle = S.color;
    const r = S.size * 2 + 4;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      ctx.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.5, 1.5);
    }
  }

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = pos(e), t = S.tool;
    if (t === 'fill') { pushUndo(); floodFill(ctx, Math.floor(p.x), Math.floor(p.y), S.color); return; }
    if (t === 'picker') {
      setColor(rgbToHex(ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data));
      say('Cor capturada'); return;
    }
    if (t === 'text') {
      const txt = prompt('Digite o texto:');
      if (txt) {
        pushUndo(); styleFor(t);
        ctx.font = (S.size * 3 + 12) + 'px Tahoma, Arial'; ctx.textBaseline = 'top';
        ctx.fillText(txt, p.x, p.y);
      }
      return;
    }
    cv.setPointerCapture(e.pointerId);
    pushUndo(); drawing = true; last = p; start = p;
    styleFor(t);
    if (t === 'line' || t === 'rect' || t === 'ellipse') snap = ctx.getImageData(0, 0, cv.width, cv.height);
    else if (t === 'spray') { spray(p); sprayTimer = setInterval(() => spray(last), 30); }
    else { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.01, p.y); ctx.stroke(); }
  });

  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e), t = S.tool;
    if (t === 'spray') { last = p; return; }
    if (t === 'line' || t === 'rect' || t === 'ellipse') { ctx.putImageData(snap, 0, 0); shape(t, start, p); return; }
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
  });

  const end = () => {
    if (!drawing) return;
    drawing = false; clearInterval(sprayTimer); ctx.shadowBlur = 0; snap = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}