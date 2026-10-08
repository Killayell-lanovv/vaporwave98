function renderPlayer(body) {
  body.innerHTML = `
    <div class="pl">
      <div class="pl-screen sunken">
        <canvas width="320" height="90"></canvas>
        <div class="pl-title">Nenhuma música</div>
      </div>
      <div class="pl-seek">
        <span class="pl-cur">0:00</span>
        <input type="range" class="pl-prog" min="0" max="1000" value="0">
        <span class="pl-dur">0:00</span>
      </div>
      <div class="pl-ctrl">
        <button class="btn" data-a="shuffle" title="Aleatório">🔀</button>
        <button class="btn" data-a="prev" title="Anterior">⏮</button>
        <button class="btn pl-play" data-a="play" title="Play/Pause">▶</button>
        <button class="btn" data-a="next" title="Próxima">⏭</button>
        <button class="btn" data-a="repeat" title="Repetir playlist">🔁</button>
      </div>
      <div class="pl-vol">
        🔊 <input type="range" class="pl-volr" min="0" max="100" value="80">
        <button class="btn" data-a="add">➕ Adicionar</button>
      </div>
      <input type="file" accept="audio/*" multiple hidden>
      <ul class="pl-list"></ul>
    </div>`;

  const $ = (s) => body.querySelector(s);
  const audio = new Audio();
  audio.volume = 0.8;
  const tracks = [];
  let cur = -1, shuffle = false, repeat = false, seeking = false;
  let actx = null, an = null;

  const cv = $('canvas'), g = cv.getContext('2d');
  const list = $('.pl-list'), title = $('.pl-title'), prog = $('.pl-prog');
  const playBtn = $('.pl-play'), input = $('input[type=file]');

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  /* Visualizador: só liga depois do primeiro toque (regra do navegador) */
  function setupAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaElementSource(audio);
      an = actx.createAnalyser();
      an.fftSize = 128; an.smoothingTimeConstant = 0.8;
      src.connect(an); an.connect(actx.destination);
    } catch (e) { an = null; }
  }

  function renderList() {
    list.innerHTML = '';
    if (!tracks.length) {
      list.innerHTML = '<li class="pl-empty">Toque em ➕ Adicionar para escolher músicas do celular.</li>';
      return;
    }
    tracks.forEach((t, i) => {
      const li = document.createElement('li');
      if (i === cur) li.className = 'on';
      li.innerHTML = '<span class="n">' + (i + 1) + '.</span><span class="t"></span><button class="x" title="Remover">✕</button>';
      li.querySelector('.t').textContent = t.name;
      li.onclick = (e) => { if (e.target.classList.contains('x')) removeTrack(i); else play(i); };
      list.appendChild(li);
    });
  }

  function play(i) {
    if (!tracks.length) return;
    cur = (i + tracks.length) % tracks.length;
    setupAudio();
    audio.src = tracks[cur].url;
    audio.play().catch(() => {});
    title.textContent = tracks[cur].name;
    renderList();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: tracks[cur].name, artist: 'VaporOS 98' });
    }
  }

  function next() {
    if (!tracks.length) return;
    if (shuffle && tracks.length > 1) {
      let n;
      do { n = Math.floor(Math.random() * tracks.length); } while (n === cur);
      play(n);
    } else play(cur + 1);
  }

  function prev() {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else play(cur < 0 ? 0 : cur - 1);
  }

  function toggle() {
    if (cur < 0) { play(0); return; }
    setupAudio();
    audio.paused ? audio.play() : audio.pause();
  }

  function removeTrack(i) {
    URL.revokeObjectURL(tracks[i].url);
    tracks.splice(i, 1);
    if (i === cur) {
      audio.pause(); audio.removeAttribute('src'); cur = -1;
      title.textContent = 'Nenhuma música';
      prog.value = 0; $('.pl-cur').textContent = '0:00'; $('.pl-dur').textContent = '0:00';
    } else if (i < cur) cur--;
    renderList();
  }

  /* Eventos do áudio */
  audio.onplay = () => { playBtn.textContent = '⏸'; };
  audio.onpause = () => { playBtn.textContent = '▶'; };
  audio.onloadedmetadata = () => { $('.pl-dur').textContent = fmt(audio.duration); };
  audio.ontimeupdate = () => {
    $('.pl-cur').textContent = fmt(audio.currentTime);
    if (!seeking && audio.duration) prog.value = (audio.currentTime / audio.duration) * 1000;
  };
  audio.onended = () => {
    if (shuffle || cur < tracks.length - 1) next();
    else if (repeat) play(0);
    else playBtn.textContent = '▶';
  };

  /* Barra de progresso e volume */
  prog.addEventListener('pointerdown', () => { seeking = true; });
  prog.addEventListener('input', () => { if (audio.duration) audio.currentTime = (prog.value / 1000) * audio.duration; });
  prog.addEventListener('change', () => { seeking = false; });
  $('.pl-volr').oninput = (e) => { audio.volume = e.target.value / 100; };

  /* Botões */
  body.querySelector('.pl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'play') toggle();
    if (a === 'next') next();
    if (a === 'prev') prev();
    if (a === 'add') input.click();
    if (a === 'shuffle') { shuffle = !shuffle; b.classList.toggle('sel', shuffle); }
    if (a === 'repeat') { repeat = !repeat; b.classList.toggle('sel', repeat); }
  });

  input.onchange = () => {
    for (const f of input.files) {
      tracks.push({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) });
    }
    input.value = '';
    const first = cur < 0;
    renderList();
    if (first && tracks.length) play(0);
  };

  /* Controles de mídia do Android (notificação / tela de bloqueio) */
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    } catch (e) {}
  }

  /* Visualizador de barras (e limpeza quando a janela é fechada) */
  const bins = new Uint8Array(64);
  const N = 32;
  function draw() {
    if (!body.isConnected) {
      audio.pause(); audio.removeAttribute('src');
      tracks.forEach((t) => URL.revokeObjectURL(t.url));
      if (actx) actx.close();
      return;
    }
    requestAnimationFrame(draw);
    const W = cv.width, H = cv.height, bw = W / N;
    g.fillStyle = '#0d0221'; g.fillRect(0, 0, W, H);
    if (an && !audio.paused) an.getByteFrequencyData(bins); else bins.fill(0);
    for (let i = 0; i < N; i++) {
      const h = Math.max(2, (bins[i] / 255) * H);
      g.fillStyle = 'hsl(' + (320 - i * 4) + ',100%,60%)';
      g.fillRect(i * bw + 1, H - h, bw - 2, h);
    }
  }
  draw();
  renderList();
}