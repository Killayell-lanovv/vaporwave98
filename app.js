const desktop = document.getElementById('desktop');
const startBtn = document.getElementById('start-btn');
const startMenu = document.getElementById('start-menu');
const tasks = document.getElementById('tasks');

/* ===== Menu Iniciar ===== */
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startMenu.classList.toggle('hidden');
  startBtn.classList.toggle('active');
});
document.addEventListener('click', () => {
  startMenu.classList.add('hidden');
  startBtn.classList.remove('active');
});

/* ===== Registro dos apps (as próximas etapas preenchem o render) ===== */
const apps = {
    paint:   { title: 'Paint',   icon: '🎨', w: 560, h: 500, render: renderPaint },
   player:  { title: 'Player',  icon: '💿', w: 380, h: 500, render: renderPlayer },
    radio:   { title: 'Rádio',   icon: '📻', w: 360, h: 380, render: renderRadio },
    gallery: { title: 'Galeria', icon: '🖼️', w: 480, h: 420, render: renderGallery },
};
function placeholder(nome) {
  return (body) => { body.innerHTML = `<div class="placeholder"><b>${nome}</b><br>Em construção... 🚧</div>`; };
}


/* ===== Gerenciador de janelas ===== */
const wins = {};   // nome -> { el, btn }
let zTop = 10;
let cascade = 0;

function focusWin(name) {
  Object.entries(wins).forEach(([n, w]) => {
    const on = n === name;
    w.el.classList.toggle('focused', on);
    w.btn.classList.toggle('active', on);
  });
  wins[name].el.style.zIndex = ++zTop;
}

function minimizeWin(name) {
  wins[name].el.classList.add('min');
  wins[name].btn.classList.remove('active');
  wins[name].el.classList.remove('focused');
}

function restoreWin(name) {
  wins[name].el.classList.remove('min');
  focusWin(name);
}

function closeWin(name) {
  if (wins[name].cleanup) wins[name].cleanup();
  wins[name].el.remove();
  wins[name].btn.remove();
  delete wins[name];
}

function toggleMax(name) {
  wins[name].el.classList.toggle('max');
  focusWin(name);
}

function openApp(name) {
  if (wins[name]) { restoreWin(name); return; }   // já aberto: só traz para frente
  const app = apps[name];
  const W = desktop.clientWidth, H = desktop.clientHeight;
  const w = Math.min(app.w, W - 16), h = Math.min(app.h, H - 16);

  const el = document.createElement('div');
  el.className = 'win';
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.style.left = Math.max(4, Math.min(30 + cascade * 26, W - w - 4)) + 'px';
  el.style.top = Math.max(4, Math.min(30 + cascade * 26, H - h - 4)) + 'px';
  cascade = (cascade + 1) % 6;
  if (W < 600) el.classList.add('max');            // no celular abre em tela cheia

  el.innerHTML = `
    <div class="titlebar">
      <span>${app.icon}</span><span class="t-text">${app.title}</span>
      <div class="t-btns">
        <button data-act="min" title="Minimizar">_</button>
        <button data-act="max" title="Maximizar">□</button>
        <button data-act="close" title="Fechar">✕</button>
      </div>
    </div>
    <div class="win-body"></div>`;
  desktop.appendChild(el);

  const btn = document.createElement('button');
  btn.className = 'task-btn';
  btn.textContent = app.icon + ' ' + app.title;
  tasks.appendChild(btn);

  wins[name] = { el, btn };
  app.render(el.querySelector('.win-body'), name);
  focusWin(name);

  // Botões da barra de título
  el.querySelector('.t-btns').addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (act === 'min') minimizeWin(name);
    if (act === 'max') toggleMax(name);
    if (act === 'close') closeWin(name);
  });
  el.querySelector('.t-btns').addEventListener('pointerdown', (e) => e.stopPropagation());

  // Foco ao tocar na janela
  el.addEventListener('pointerdown', () => focusWin(name));

  // Duplo toque na barra = maximizar
  el.querySelector('.titlebar').addEventListener('dblclick', () => toggleMax(name));

  // Arrastar pela barra de título (mouse e toque)
  const bar = el.querySelector('.titlebar');
  bar.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('max')) return;
    const dx = e.clientX - el.offsetLeft;
    const dy = e.clientY - el.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const maxX = desktop.clientWidth - 60;
      const maxY = desktop.clientHeight - 30;
      el.style.left = Math.max(60 - el.offsetWidth, Math.min(ev.clientX - dx, maxX)) + 'px';
      el.style.top = Math.max(0, Math.min(ev.clientY - dy, maxY)) + 'px';
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });

  // Botão na barra de tarefas
  btn.addEventListener('click', () => {
    if (el.classList.contains('min')) restoreWin(name);
    else if (el.classList.contains('focused')) minimizeWin(name);
    else focusWin(name);
  });
}

/* ===== Ícones e menu abrem os apps ===== */
document.querySelectorAll('[data-app]').forEach((el) => {
  el.addEventListener('click', () => openApp(el.dataset.app));
});

/* ===== Desligar ===== */
document.getElementById('shutdown').addEventListener('click', () => {
  document.body.innerHTML =
    '<div style="position:fixed;inset:0;background:#000;color:#ff9d00;display:flex;align-items:center;justify-content:center;text-align:center;font-family:Tahoma,sans-serif;font-size:20px;padding:20px">Agora é seguro desligar o computador.<br><br>(recarregue a página para ligar)</div>';
});

/* ===== Relógio ===== */
function tick() {
  const d = new Date();
  document.getElementById('clock').textContent =
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}
tick();
setInterval(tick, 1000);
const SOMA = (canal) => [
  `https://ice1.somafm.com/${canal}-128-mp3`,
  `https://ice2.somafm.com/${canal}-128-mp3`,
  `https://ice4.somafm.com/${canal}-128-mp3`,
  `https://ice.somafm.com/${canal}`
];

const RADIO_ESTACOES = [
  { nome: 'Groove Salad', desc: 'Ambient e downtempo suave', urls: SOMA('groovesalad') },
  { nome: 'Vaporwaves', desc: 'Vaporwave o tempo todo', urls: SOMA('vaporwaves') },
  { nome: 'Drone Zone', desc: 'Texturas ambientes, bem calmo', urls: SOMA('dronezone') },
  { nome: 'Deep Space One', desc: 'Ambient profundo e espacial', urls: SOMA('deepspaceone') },
  { nome: 'Space Station Soma', desc: 'Eletrônica ambiente espacial', urls: SOMA('spacestation') },
  { nome: 'Lush', desc: 'Vocais suaves e relaxantes', urls: SOMA('lush') },
  { nome: 'Groove Salad Classic', desc: 'Downtempo clássico dos anos 2000', urls: SOMA('gsclassic') }
];

function renderRadio(body, name) {
  body.innerHTML = `
    <div class="radio98-corpo">
      <ul class="radio98-lista"></ul>
      <div class="radio98-status">Escolha uma estação</div>
      <div class="radio98-controles">
        <button class="radio98-btn radio98-play">Play</button>
        <input type="range" class="radio98-volume" min="0" max="1" step="0.05" value="0.7" aria-label="Volume">
      </div>
      <div class="radio98-rodape">Streams: SomaFM.com</div>
    </div>`;

  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0.7;
  let indice = -1;
  let tentativa = 0;

  const lista = body.querySelector('.radio98-lista');
  const statusEl = body.querySelector('.radio98-status');
  const btn = body.querySelector('.radio98-play');
  const status = (t) => { statusEl.textContent = t; };

  RADIO_ESTACOES.forEach((e, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${e.nome}<small>${e.desc}</small>`;
    li.addEventListener('click', () => tocar(i));
    lista.appendChild(li);
  });

  function carregar() {
    audio.src = RADIO_ESTACOES[indice].urls[tentativa];
    audio.play().catch((err) => {
      if (err.name === 'NotAllowedError') status('Toque em Play para iniciar');
    });
  }

  function proximoServidor() {
    const urls = RADIO_ESTACOES[indice].urls;
    if (tentativa < urls.length - 1) {
      tentativa++;
      status('Tentando servidor ' + (tentativa + 1) + ' de ' + urls.length + '...');
      carregar();
    } else {
      btn.textContent = 'Play';
      status('Sem sinal');
    }
  }

  function tocar(i) {
    indice = i;
    tentativa = 0;
    const e = RADIO_ESTACOES[i];
    [...lista.children].forEach((li, n) => li.classList.toggle('ativa', n === i));
    status('Conectando...');
    carregar();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: e.nome, artist: 'SomaFM' });
    }
  }

  function parar() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    btn.textContent = 'Play';
    status('Parado');
  }

  audio.addEventListener('playing', () => {
    btn.textContent = 'Parar';
    status('Tocando: ' + RADIO_ESTACOES[indice].nome);
  });
  audio.addEventListener('waiting', () => status('Carregando...'));
  audio.addEventListener('error', () => {
    if (audio.getAttribute('src')) proximoServidor();
  });

  btn.addEventListener('click', () => {
    if (audio.paused) tocar(indice >= 0 ? indice : 0);
    else parar();
  });
  body.querySelector('.radio98-volume').addEventListener('input', (ev) => {
    audio.volume = ev.target.value;
  });

  wins[name].cleanup = parar;
}