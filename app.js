// Student review site. Screens: home (bento) → topic (film, then 8 questions) or vocabulary.
// Progress lives only in this browser; nothing is sent anywhere.
const { topics: TOPICS, vocab: VOCAB, ui: UI } = window.DATA;
const app = document.getElementById('app');
const COLORS = { coral: ['#E76F51', '#FBF5ED'], teal: ['#2A9D8F', '#FBF5ED'], navy: ['#264653', '#FBF5ED'], gold: ['#E9C46A', '#264653'], sand: ['#F4A261', '#264653'] };
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('nowUsual.' + k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('nowUsual.' + k, JSON.stringify(v)); } catch (e) {} } };

let lang = store.get('lang', 'he');
if (!UI[lang]) lang = 'he';
const T = () => UI[lang];
const applyLang = () => { document.documentElement.lang = lang; document.documentElement.dir = T().dir; };
const iso = s => !/[\u0400-\u06FF]/.test(s) ? `<span class="en">${esc(s)}</span>` : esc(s).replace(/[A-Za-z][A-Za-z0-9'\/+!\-]*(?: [+=\/] [A-Za-z][A-Za-z\/]*| [A-Za-z][A-Za-z0-9'\/!\-]*)*!?/g, m => `<span class="en">${m}</span>`);

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l14 8-14 8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  again: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
  speak: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm11-1v8a4.5 4.5 0 0 0 0-8z"/></svg>'
};

let stopCurrent = () => {};
const go = fn => { stopCurrent(); stopCurrent = () => {}; fn(); scrollTo(0, 0); };

/* ---------- pronounced words ---------- */
const wordAudio = new Audio();
const say = id => { wordAudio.src = `audio/w-${id}.mp3`; wordAudio.play().catch(() => {}); };

/* ---------- home ---------- */
function home() {
  applyLang();
  const scores = store.get('scores', {});
  const boxes = TOPICS.map(t => {
    const [c, on] = COLORS[t.color], s = scores[t.id];
    return `<button class="box ${t.size || ''}" data-t="${t.id}" style="--c:${c};--on:${on}"><span class="glyph">${esc(t.glyph)}</span>
      <h2>${iso(t.title[lang])}</h2><small>${s != null ? `${s} / 8 ${T().score}` : T().topicHint}</small>${s != null ? `<div class="meter"><i style="width:${s / 8 * 100}%"></i></div>` : ''}</button>`;
  }).join('');
  app.innerHTML = `<header class="top"><div><h1>${T().title}</h1><p>${iso(T().sub)}</p></div>
      <div class="langs" role="group" aria-label="${T().chooseLang}">${Object.keys(UI).map(l => `<button data-l="${l}" aria-pressed="${l === lang}">${UI[l].name}</button>`).join('')}</div></header>
    <div class="bento">${boxes}
      <button class="box vocab" id="vocab"><div><h2>${T().vocab}</h2><small>${T().vocabSub}</small></div><div class="modes"><span>${T().flash}</span><span>${T().memory}</span><span>${T().mc}</span></div></button>
    </div>`;
  app.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { lang = b.dataset.l; store.set('lang', lang); home(); });
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => go(() => film(TOPICS.find(t => t.id === b.dataset.t))));
  document.getElementById('vocab').onclick = () => go(vocabScreen);
}

/* ---------- film: a recorded clip, or narrated scenes synced to one audio file ---------- */
const showHTML = s => esc(s).split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}">${w.replace(/\[([^\]]+)\]/g, '<b>$1</b>').replace(/\{([^}]+)\}/g, '<em>$1</em>')}</span>`).join(' ');
const timeline = k => k === 'habit'
  ? `<div class="tline"><i class="nw"></i>${Array.from({ length: 9 }, (_, i) => `<span class="d" style="left:${6 + i * 11}%;--i:${i}"></span>`).join('')}</div>`
  : k === 'now' ? `<div class="tline"><span class="seg"></span><i class="nw"></i></div>` : '';

function header(t) {
  return `<div class="bar"><button class="backb" id="back">${T().back}</button><h2>${iso(t.title[lang])}</h2></div>`;
}
function film(t) {
  const clip = t.clip?.[lang];
  app.innerHTML = `${header(t)}<div class="film"><div class="stage" id="stage">${clip ? `<video src="${clip}" controls playsinline preload="metadata"></video>` : ''}</div>
      ${clip ? '' : `<div class="cap" id="cap"></div><div class="ctl"><button id="pp" aria-label="${T().play}">${ICON.play}</button><div class="seek" id="seek"><i id="pos"></i></div><button id="re" aria-label="${T().again}">${ICON.again}</button></div>`}</div>
    <div class="row after"><button class="btn" id="toQ">${T().skipFilm}</button></div>`;
  document.getElementById('back').onclick = () => go(home);
  document.getElementById('toQ').onclick = () => go(() => quiz(t, t.items));
  if (clip) { const v = app.querySelector('video'); stopCurrent = () => v.pause(); v.play().catch(() => {}); return; }

  const key = `${t.id}-${lang}`, time = window.TIMING[key], audio = new Audio(`audio/${key}.mp3`);
  const stage = document.getElementById('stage'), cap = document.getElementById('cap'), pp = document.getElementById('pp'), pos = document.getElementById('pos');
  let shown = -1;
  const scene = i => {
    if (i === shown) return; shown = i;
    const f = t.film[i];
    stage.innerHTML = `<div class="show">${showHTML(f.show)}</div>${timeline(f.tl)}`;
    cap.innerHTML = iso(f.say[lang]);
  };
  const tick = () => {
    const now = audio.currentTime; let i = 0;
    time.starts.forEach((s, k) => { if (now >= s - .1) i = k; });
    scene(i);
    pos.style.width = Math.min(100, now / time.total * 100) + '%';
  };
  audio.ontimeupdate = tick;
  audio.onplay = () => pp.innerHTML = ICON.pause;
  audio.onpause = () => pp.innerHTML = ICON.play;
  audio.onended = () => { pp.innerHTML = ICON.again; document.getElementById('toQ').focus(); };
  pp.onclick = () => audio.ended ? (audio.currentTime = 0, audio.play()) : audio.paused ? audio.play().catch(() => {}) : audio.pause();
  document.getElementById('re').onclick = () => { audio.currentTime = 0; audio.play().catch(() => {}); };
  document.getElementById('seek').onclick = e => {
    const r = e.currentTarget.getBoundingClientRect(); audio.currentTime = (e.clientX - r.left) / r.width * time.total; tick();
  };
  scene(0);
  stopCurrent = () => { audio.pause(); audio.src = ''; };
  audio.play().catch(() => {});
}

/* ---------- questions ---------- */
function quiz(t, list) {
  const whole = list === t.items;
  let i = 0; const res = [], missed = [];
  const next = () => { i < list.length - 1 ? (i++, draw()) : finish(); };

  function draw() {
    const q = list[i];
    app.innerHTML = `${header(t)}<div class="bar"><span>${T().q} ${i + 1} ${T().of} ${list.length}</span><div class="prog">${list.map((_, k) => `<i class="${k === i ? 'cur' : res[k] === true ? 'ok' : res[k] === false ? 'no' : ''}"></i>`).join('')}</div></div>
      <section class="card" id="card"></section>`;
    document.getElementById('back').onclick = () => go(home);
    const card = document.getElementById('card');
    ({ choice: drawChoice, when: drawWhen, type: drawType, build: drawBuild })[q.type](q, card);
  }
  const blank = (s, fill) => esc(s).replace('___', fill ? `<span class="blank fill">${esc(fill)}</span>` : '<span class="blank"></span>');

  function verdict(q, ok, card, answer) {
    res[i] = ok; if (!ok) missed.push(q);
    if (ok) { tone([523, 659, 784]); }
    const fb = document.createElement('div');
    fb.className = 'fb ' + (ok ? 'good' : 'bad');
    fb.innerHTML = `<b>${ok ? T().right : T().wrong}</b>${!ok ? `<span>${T().correct}</span><div class="ans-line">${esc(answer)}</div>` : ''}<div>${iso(q.why[lang])}</div>`;
    const row = document.createElement('div'); row.className = 'row';
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = T().next; b.onclick = next;
    row.append(b); card.append(fb, row); b.focus({ preventScroll: true }); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function drawChoice(q, card) {
    card.innerHTML = `<p class="q">${blank(q.q)}</p><div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>`;
    card.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const k = +b.dataset.k, ok = k === q.c;
      card.querySelectorAll('.opt').forEach((x, n) => { x.disabled = true; x.classList.add(n === q.c ? 'ok' : n === k ? 'bad' : 'dim'); });
      const qe = card.querySelector('.q'); if (q.q.includes('___')) qe.innerHTML = blank(q.q, q.opts[q.c]);
      verdict(q, ok, card, q.q.includes('___') ? q.q.replace('___', q.opts[q.c]).replace(' .', '.') : q.opts[q.c]);
    });
  }
  function drawWhen(q, card) {
    const opts = [['now', T().now], ['usual', T().usual]];
    card.innerHTML = `<p class="q">${esc(q.q)}</p><div class="opts">${opts.map(([k, l]) => `<button class="opt he" data-k="${k}">${l}</button>`).join('')}</div>`;
    card.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const ok = b.dataset.k === q.c;
      card.querySelectorAll('.opt').forEach(x => { x.disabled = true; x.classList.add(x.dataset.k === q.c ? 'ok' : x === b ? 'bad' : 'dim'); });
      verdict(q, ok, card, q.q);
    });
  }
  function drawType(q, card) {
    card.innerHTML = `<p class="q">${blank(q.q)}</p><form id="f"><input class="ans" id="in" autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr" placeholder="${T().typeHere}" aria-label="${T().typeHere}"></form><div class="row"><button class="btn" id="chk" form="f">${T().check}</button></div>`;
    const input = document.getElementById('in'); input.focus({ preventScroll: true });
    document.getElementById('f').onsubmit = e => {
      e.preventDefault();
      const v = input.value.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!v) { input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); return; }
      const ok = v === q.a;
      input.disabled = true; document.getElementById('chk').parentElement.remove();
      card.querySelector('.q').innerHTML = blank(q.q, q.a);
      verdict(q, ok, card, q.q.replace('___', q.a).replace(/\s*\([^)]*\)/, ''));
    };
  }
  function drawBuild(q, card) {
    card.innerHTML = `<p class="q he">${esc(q.prompt[lang])}</p><div class="line" id="line"></div><p class="hint">${T().buildHint}</p>
      <div class="bank" id="bank">${shuffle([...q.chips, ...q.extra]).map(w => `<button class="chip">${esc(w)}</button>`).join('')}</div>
      <div class="row" id="acts"><button class="btn" id="chk">${T().check}</button></div>`;
    const line = document.getElementById('line'), bank = document.getElementById('bank');
    const place = b => b.onclick = () => (b.parentElement === bank ? line : bank).appendChild(b);
    bank.querySelectorAll('.chip').forEach(place);
    document.getElementById('chk').onclick = () => {
      const got = [...line.children].map(c => c.textContent);
      if (!got.length) { line.classList.add('shake'); setTimeout(() => line.classList.remove('shake'), 400); return; }
      const ok = got.join(' ') === q.chips.join(' ');
      document.getElementById('acts').remove();
      card.querySelectorAll('.chip').forEach(c => c.disabled = true);
      verdict(q, ok, card, q.chips.join(' ') + '.');
    };
  }

  function finish() {
    const n = res.filter(Boolean).length;
    if (whole) { const s = store.get('scores', {}); s[t.id] = Math.max(s[t.id] ?? 0, n); store.set('scores', s); }
    tone(n === list.length ? [523, 659, 784, 1047] : [523, 659]);
    app.innerHTML = `${header(t)}<section class="card end"><h2>${T().done}</h2><div class="bigscore">${n} / ${list.length}</div>
      ${missed.length ? `<div class="miss">${missed.map(q => `<div>${q.q ? `<span class="en">${esc(q.q)}</span>` : ''}${iso(q.why[lang])}</div>`).join('')}</div>` : `<p>${T().perfect}</p>`}
      <div class="row">${missed.length ? `<button class="btn" id="redo">${T().redo}</button>` : ''}<button class="btn alt" id="hm">${T().home}</button></div></section>`;
    document.getElementById('back').onclick = () => go(home);
    document.getElementById('hm').onclick = () => go(home);
    const r = document.getElementById('redo'); if (r) r.onclick = () => go(() => quiz(t, [...missed]));
  }
  draw();
}

/* ---------- vocabulary ---------- */
let ac;
function tone(fs) { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); fs.forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), s = ac.currentTime + i * .09; o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.1, s); g.gain.exponentialRampToValueAtTime(.001, s + .2); o.connect(g).connect(ac.destination); o.start(s); o.stop(s + .2); }); } catch (e) {} }

function vocabScreen() {
  const v = { group: store.get('vgroup', 'time'), mode: store.get('vmode', 'flash') };
  const words = () => v.group === 'all' ? VOCAB.flatMap(g => g.words) : VOCAB.find(g => g.id === v.group).words;
  const draw = () => {
    store.set('vgroup', v.group); store.set('vmode', v.mode);
    app.innerHTML = `<div class="bar"><button class="backb" id="back">${T().back}</button><h2>${T().vocab}</h2></div>
      <div class="tabs mode">${[['flash', T().flash], ['memory', T().memory], ['mc', T().mc]].map(([k, l]) => `<button data-m="${k}" aria-pressed="${k === v.mode}">${l}</button>`).join('')}</div>
      <div class="tabs">${[...VOCAB.map(g => [g.id, g.name[lang]]), ['all', T().all]].map(([k, l]) => `<button data-g="${k}" aria-pressed="${k === v.group}">${l}</button>`).join('')}</div>
      <div id="pane"></div>`;
    document.getElementById('back').onclick = () => go(home);
    app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { v.mode = b.dataset.m; draw(); });
    app.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { v.group = b.dataset.g; draw(); });
    ({ flash: flashcards, memory: memoryGame, mc: multipleChoice })[v.mode](words(), document.getElementById('pane'));
  };
  draw();
}

function flashcards(words, pane) {
  let deck = shuffle(words), i = 0, enFront = store.get('enFront', false), up = false;
  const draw = () => {
    if (!deck.length) { pane.innerHTML = `<div class="end card"><h2>${T().finished}</h2><button class="btn" id="more">${T().again}</button></div>`; document.getElementById('more').onclick = () => { deck = shuffle(words); i = 0; draw(); }; return; }
    const w = deck[i % deck.length];
    const front = enFront ? ['', w.en] : ['tr', w.tr[lang]], back = enFront ? ['tr', w.tr[lang]] : ['', w.en];
    pane.innerHTML = `<div class="count">${deck.length} ${T().left}</div>
      <button class="flash" id="card" aria-label="${T().flip}"><span class="inner"><span class="face ${front[0]}">${esc(front[1])}<small>${T().flip}</small></span><span class="face back ${back[0]}">${esc(back[1])}</span></span></button>
      <div class="row" style="margin-top:14px"><button class="btn alt" id="again">${T().notYet}</button><button class="spk" id="spk" aria-label="${T().listen}">${ICON.speak}</button><button class="btn" id="know">${T().know}</button></div>
      <div class="row" style="margin-top:12px"><button class="backb" id="side">${enFront ? T().heFront : T().enFront}</button></div>`;
    const card = document.getElementById('card'); up = false;
    card.onclick = () => { up = !up; card.classList.toggle('on', up); if (up !== enFront) say(w.a); };
    document.getElementById('spk').onclick = () => say(w.a);
    document.getElementById('know').onclick = () => { deck.splice(i % deck.length, 1); draw(); };
    document.getElementById('again').onclick = () => { i++; draw(); };
    document.getElementById('side').onclick = () => { enFront = !enFront; store.set('enFront', enFront); draw(); };
    if (enFront) say(w.a);
  };
  draw();
}

function memoryGame(words, pane) {
  const start = () => {
    const pick = shuffle(words).slice(0, 6);
    const cards = shuffle(pick.flatMap((w, k) => [{ k, text: w.en, en: true, w }, { k, text: w.tr[lang], en: false, w }]));
    let open = [], found = 0, moves = 0, lock = false;
    pane.innerHTML = `<div class="count"><span id="mv">0</span> ${T().moves}</div><div class="grid">${cards.map((_, i) => `<button class="mem" data-i="${i}"><i>?</i></button>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="backb" id="ng">${T().newGame}</button></div>`;
    document.getElementById('ng').onclick = start;
    pane.querySelectorAll('.mem').forEach(b => b.onclick = () => {
      const c = cards[+b.dataset.i];
      if (lock || b.classList.contains('up') || b.classList.contains('done')) return;
      b.classList.add('up'); b.classList.toggle('en', c.en); b.textContent = c.text;
      if (c.en) say(c.w.a);
      open.push([b, c]);
      if (open.length < 2) return;
      document.getElementById('mv').textContent = ++moves;
      const [[b1, c1], [b2, c2]] = open; open = [];
      if (c1.k === c2.k) {
        [b1, b2].forEach(x => { x.classList.remove('up'); x.classList.add('done'); }); tone([659, 784]);
        if (++found === pick.length) setTimeout(() => tone([523, 659, 784, 1047]), 250);
      } else { lock = true; setTimeout(() => { [b1, b2].forEach(x => { x.classList.remove('up', 'en'); x.innerHTML = '<i>?</i>'; }); lock = false; }, 1100); }
    });
  };
  start();
}

function multipleChoice(words, pane) {
  const all = VOCAB.flatMap(g => g.words);
  const start = () => {
    const list = shuffle(words).slice(0, 10); let i = 0, right = 0;
    const draw = () => {
      if (i === list.length) {
        pane.innerHTML = `<div class="card end"><h2>${T().done}</h2><div class="bigscore">${right} / ${list.length}</div><button class="btn" id="more">${T().newGame}</button></div>`;
        document.getElementById('more').onclick = start; return;
      }
      const w = list[i], toTr = i % 2 === 0, pool = shuffle((words.length > 3 ? words : all).filter(x => x.en !== w.en && x.tr[lang] !== w.tr[lang])).slice(0, 3);
      const opts = shuffle([w, ...pool]), label = x => toTr ? x.tr[lang] : x.en;
      pane.innerHTML = `<section class="card"><div class="count">${i + 1} ${T().of} ${list.length} · ${toTr ? T().whichMeaning : T().whichWord}</div>
        <div class="chooser"><p class="q ${toTr ? '' : 'he'}" style="margin:0">${esc(toTr ? w.en : w.tr[lang])}</p>${toTr ? `<button class="spk" id="spk" aria-label="${T().listen}">${ICON.speak}</button>` : ''}</div>
        <div class="opts">${opts.map((o, k) => `<button class="opt ${toTr ? 'he' : ''}" data-k="${k}">${esc(label(o))}</button>`).join('')}</div></section>`;
      if (toTr) { document.getElementById('spk').onclick = () => say(w.a); say(w.a); }
      const card = pane.querySelector('.card');
      card.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = opts[+b.dataset.k] === w; if (ok) { right++; tone([659, 784]); }
        card.querySelectorAll('.opt').forEach((x, n) => { x.disabled = true; x.classList.add(opts[n] === w ? 'ok' : x === b ? 'bad' : 'dim'); });
        if (!toTr) say(w.a);
        const r = document.createElement('div'); r.className = 'row';
        const nb = document.createElement('button'); nb.className = 'btn'; nb.textContent = T().next; nb.onclick = () => { i++; draw(); };
        r.append(nb); card.append(r); nb.focus({ preventScroll: true });
      });
    };
    draw();
  };
  start();
}

home();
