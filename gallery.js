/* Avisa a galeria aberta quando algo novo é salvo (pelo Paint ou por importação) */
(() => {
  const add = DB.add.bind(DB);
  DB.add = async (...args) => {
    const r = await add(...args);
    window.dispatchEvent(new Event('gallery-changed'));
    return r;
  };
})();

/* Reduz fotos grandes antes de guardar */
async function shrinkImage(file, max = 2048) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('falha ao converter'))), 'image/jpeg', 0.9));
}

function renderGallery(body) {
  body.innerHTML = `
    <div class="gal">
      <div class="g-bar">
        <button class="btn" data-a="import">📥 Importar fotos</button>
        <button class="btn" data-a="refresh" title="Atualizar">↻</button>
        <span class="g-count"></span>
      </div>
      <input type="file" accept="image/*" multiple hidden>
      <div class="g-grid"></div>
      <div class="g-view hidden">
        <div class="g-top">
          <span class="g-name"></span>
          <button class="btn" data-a="download" title="Baixar">⬇️</button>
          <button class="btn" data-a="delete" title="Excluir">🗑️</button>
          <button class="btn" data-a="close" title="Fechar">✕</button>
        </div>
        <div class="g-stage"><img alt=""></div>
        <div class="g-nav">
          <button class="btn" data-a="prev">◀</button>
          <button class="btn" data-a="next">▶</button>
        </div>
      </div>
    </div>`;

  const $ = (s) => body.querySelector(s);
  const grid = $('.g-grid'), view = $('.g-view'), img = $('.g-stage img'), input = $('input[type=file]');
  let items = [], urls = [], idx = 0;

  async function load() {
    const all = await DB.getAll();
    all.sort((a, b) => b.date - a.date);
    urls.forEach((u) => URL.revokeObjectURL(u));
    items = all;
    urls = all.map((p) => URL.createObjectURL(p.blob));
    $('.g-count').textContent = items.length + (items.length === 1 ? ' item' : ' itens');
    grid.innerHTML = '';
    if (!items.length) {
      grid.innerHTML = '<div class="g-empty">Nenhuma imagem ainda.<br>Desenhe no Paint e toque em 💾,<br>ou importe fotos do celular.</div>';
      return;
    }
    items.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'g-th';
      const im = document.createElement('img');
      im.src = urls[i]; im.loading = 'lazy'; im.alt = p.name;
      b.appendChild(im);
      b.onclick = () => show(i);
      grid.appendChild(b);
    });
  }

  function show(i) {
    idx = (i + items.length) % items.length;
    img.src = urls[idx];
    $('.g-name').textContent = items[idx].name;
    view.classList.remove('hidden');
  }
  function hide() { view.classList.add('hidden'); img.removeAttribute('src'); }

  body.querySelector('.gal').addEventListener('click', async (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (a === 'import') input.click();
    if (a === 'refresh') load();
    if (a === 'close') hide();
    if (a === 'prev') show(idx - 1);
    if (a === 'next') show(idx + 1);
    if (a === 'download') {
      const l = document.createElement('a');
      l.href = urls[idx]; l.download = items[idx].name; l.click();
    }
    if (a === 'delete') {
      if (!confirm('Excluir esta imagem?')) return;
      await DB.remove(items[idx].id);
      await load();
      if (!items.length) hide(); else show(Math.min(idx, items.length - 1));
    }
  });

  input.onchange = async () => {
    for (const f of input.files) {
      try {
        const blob = await shrinkImage(f);
        await DB.add(blob, f.name.replace(/\.[^.]+$/, '') + '.jpg');
      } catch (err) {
        await DB.add(f, f.name);   // se não der para reduzir, guarda o original
      }
    }
    input.value = '';
  };

  /* Deslizar para os lados troca de imagem */
  let sx = null;
  const stage = $('.g-stage');
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (dx > 50) show(idx - 1);
    if (dx < -50) show(idx + 1);
  });

  /* Atualiza quando algo novo é salvo; se a janela fechar, remove o aviso */
  const onChange = () => {
    if (!body.isConnected) { window.removeEventListener('gallery-changed', onChange); return; }
    load();
  };
  window.addEventListener('gallery-changed', onChange);

  load();
}