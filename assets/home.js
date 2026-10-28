/* "Today": the home screen. One card per experience, each with a small moving
 * preview and what you have done there (Pip's best on today's world and his
 * finds, Road trip postcards, whether you have raked the garden). Tapping a
 * card opens it; "⌂ Today" in the experience menu (and in Cozy Worlds' own
 * menu) brings you back. It opens on a visit without a link, or with #today;
 * a link to an experience still goes straight there. While it is open the
 * scene behind it pauses. Progress is read from what each experience already
 * keeps on this device; nothing new is stored. */
const Home = (() => {
  const firstHash = location.hash;   // read before the page settles on a mode and rewrites it
  let el = null, grid = null, current = null, resume = false, backHash = '', artTimer = 0;
  const get = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch (_) { return fallback; } };
  const today = () => new Date().toISOString().slice(0, 10);
  const ART = ['assets/og-gond.jpg', 'assets/art-japan-living.webp', 'assets/mexican-amate-panorama.webp'];

  function cards() {
    const best = get('pip-run:best', null), seen = get('pip-run:seen', []), stamps = get('road-trip:stamps', []);
    let raked = false; try { raked = !!localStorage.getItem('zen-rake-hint'); } catch (_) {}
    return [
      {mode: 'pip', hero: true, tag: 'Today’s world', title: 'Pip Run', text: 'An original platformer. Watch the AI plan its runs, set it challenges, or play.',
        progress: [best && best.day === today() ? `Your best today: ${best.m} m` : 'Today’s world is waiting for your run', Array.isArray(seen) && seen.length ? `${seen.length} of 10 sights found` : 'Ten sights to find along the way'], preview: 'pip'},
      {mode: 'art', title: 'World art', text: 'Seven folk traditions as endless living paintings.', progress: ['Kites, flocks and rainbows drift by'], preview: 'art'},
      {mode: 'road', title: 'Road trip', text: 'A drive through five landscapes and every weather.', progress: [stamps.length ? `${stamps.length} of 20 postcards collected` : 'Collect postcards from 20 towns'], preview: 'road'},
      {mode: 'zen', title: 'Zen garden', text: 'A steel ball draws in the sand. Rake it yourself.', progress: [raked ? 'You have raked the sand' : 'A bird and a dragonfly visit'], preview: 'zen'},
      {mode: 'cozy', title: 'Cozy Worlds', text: 'A reading nook, a tea garden and a lakeside cabin.', progress: ['Calm rooms to rest in'], preview: 'cozy'},
      {mode: 'mushroom', title: 'Mushroom Island', text: 'Pip’s cinematic run through a painted kingdom.', progress: [], preview: 'mushroom'}
    ];
  }
  const PREVIEW = {
    pip: '<div class="img pan" style="background-image:url(assets/mushroom-cinematic-kingdom.webp)"></div><div class="pip-run-sprite"></div>',
    art: '<div class="img pan art-a"></div><div class="img pan art-b" style="opacity:0"></div>',
    road: '<div class="img" style="background-image:url(assets/road-painted-mountains.webp);background-position:50% 0;height:58%"></div><div class="ground"></div><div class="road"></div><div class="lane"></div><img class="car" alt="" src="assets/road-painted-car.webp">',
    zen: '<div class="img zoom" style="background-image:url(assets/garden-koi-wide.webp)"></div>',
    cozy: '<div class="img zoom" style="background-image:url(assets/cozy-nook-thumb.webp)"></div>',
    mushroom: '<div class="img pan" style="background-image:url(assets/mushroom-cinematic-kingdom.webp);animation-direction:alternate-reverse"></div>'
  };
  const CSS = `
#home{position:fixed;inset:0;z-index:30;overflow:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;padding:max(20px,env(safe-area-inset-top)) 18px 30px;
 background:radial-gradient(120% 80% at 50% 0%,#26392f,#0f1914);color:#f4ead0;font:15px/1.45 system-ui,-apple-system,sans-serif;opacity:0;transition:opacity .45s}
#home.open{opacity:1}#home[hidden]{display:none}
#home header,#home .grid,#home footer{max-width:1080px;margin:0 auto}
#home header{margin-bottom:18px;padding-right:44px}
#home .kicker{font:600 11px/1 system-ui;letter-spacing:.16em;color:#c8bd8a;text-transform:uppercase}
#home h2{font:400 36px/1.1 Georgia,serif;margin:8px 0 4px}#home .date{color:#bfb59a}
#home .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
#home .card{appearance:none;border:1px solid #ffffff17;background:#1b2a24;color:inherit;font:inherit;text-align:left;padding:0;cursor:pointer;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:transform .2s,border-color .2s}
#home .card:hover,#home .card:focus-visible{transform:translateY(-2px);border-color:#e8ddbd77;outline:none}
#home .card.hero{grid-column:span 2;grid-row:span 2}
#home .pv{position:relative;aspect-ratio:16/10;overflow:hidden;background:#22322b}
#home .hero .pv{aspect-ratio:auto;flex:1;min-height:250px}
#home .img{position:absolute;inset:0;background:center/cover no-repeat;transition:opacity 1.6s}
#home .txt{padding:12px 15px 15px}
#home .t{font:400 21px/1.2 Georgia,serif}#home .d{color:#cfc6ad;font-size:13.5px;margin-top:3px}
#home .p{color:#ffd36a;font-size:12.5px;margin-top:6px}#home .p+.p{margin-top:2px;color:#cde3d6}
#home .tag{position:absolute;left:10px;top:10px;background:#ffd36add;color:#3b2a10;font:700 10.5px/1 system-ui;letter-spacing:.08em;padding:5px 9px;border-radius:999px;text-transform:uppercase}
#home footer{margin-top:20px;color:#9fb0a6;font-size:12.5px}
#home .x{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;width:40px;height:40px;border-radius:50%;border:1px solid #ffffff22;background:#ffffff12;color:#f4ead0;font:18px/1 system-ui;cursor:pointer}
#home .pan{animation:homePan 46s linear infinite alternate}#home .zoom{animation:homeZoom 26s ease-in-out infinite alternate}
@keyframes homePan{from{background-position:0% 50%}to{background-position:100% 50%}}
@keyframes homeZoom{from{transform:scale(1)}to{transform:scale(1.09)}}
#home .pip-run-sprite{position:absolute;bottom:9%;left:16%;width:61px;height:76px;background:url(assets/pip-full-run-22.webp) 0 0/1342px 76px no-repeat;animation:homePip .75s steps(16) infinite}
#home .hero .pip-run-sprite{width:92px;height:115px;background-size:2024px 115px;animation-name:homePipBig}
@keyframes homePip{to{background-position:-976px 0}}@keyframes homePipBig{to{background-position:-1472px 0}}
#home .ground{position:absolute;inset:52% 0 0 0;background:linear-gradient(#7fa463,#5d8549)}
#home .road{position:absolute;inset:52% 0 0 0;background:linear-gradient(#6c777a,#3e484b);clip-path:polygon(47% 0,53% 0,96% 100%,4% 100%)}
#home .lane{position:absolute;left:49.5%;width:1%;top:56%;bottom:0;background:repeating-linear-gradient(#f4ead0 0 9px,transparent 9px 22px);animation:homeLane .55s linear infinite}
@keyframes homeLane{to{background-position:0 22px}}
#home .car{position:absolute;bottom:6%;left:50%;width:24%;transform:translateX(-50%);animation:homeBob 1.3s ease-in-out infinite alternate}
@keyframes homeBob{to{transform:translate(-50%,-2px)}}
@media(max-width:700px){#home h2{font-size:30px}#home .grid{grid-template-columns:1fr;gap:12px}#home .card{flex-direction:row;min-height:100px}
 #home .pv{width:118px;flex:none;aspect-ratio:auto}#home .card.hero{flex-direction:column;grid-column:auto;grid-row:auto}#home .hero .pv{width:auto;min-height:180px}
 #home .txt{padding:10px 12px}#home .t{font-size:19px}#home .d{font-size:12.5px}#home .car{width:34%}}
@media(prefers-reduced-motion:reduce){#home *{animation:none!important;transition:none!important}}`;

  function build() {
    const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
    el = document.createElement('div'); el.id = 'home'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Today');
    el.innerHTML = `<button class="x" type="button" aria-label="Close Today">✕</button>
      <header><div class="kicker">Infinite World Scrolls</div><h2>Today</h2><div class="date"></div></header>
      <div class="grid"></div>
      <footer>“⌂ Today” in the experience menu brings you back here.</footer>`;
    document.body.append(el);
    grid = el.querySelector('.grid');
    el.querySelector('.x').addEventListener('click', close);
    addEventListener('keydown', e => { if (!el.hidden && e.key === 'Escape') close(); });
  }
  function render() {
    el.querySelector('.date').textContent = new Date().toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'});
    grid.textContent = '';
    for (const c of cards()) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card' + (c.hero ? ' hero' : '');
      b.innerHTML = `<div class="pv">${PREVIEW[c.preview]}${c.tag ? `<span class="tag">${c.tag}</span>` : ''}</div>
        <div class="txt"><div class="t">${c.title}</div><div class="d">${c.text}</div>${c.progress.map(p => `<div class="p">${p}</div>`).join('')}</div>`;
      b.addEventListener('click', () => open(c.mode));
      grid.append(b);
    }
    // World art's preview cycles through traditions, loading each only when it is due.
    let k = 0;
    const a = grid.querySelector('.art-a'), b = grid.querySelector('.art-b');
    a.style.backgroundImage = `url(${ART[0]})`;
    clearInterval(artTimer);
    artTimer = setInterval(() => {
      k = (k + 1) % ART.length;
      const [show, hide] = k % 2 ? [b, a] : [a, b], img = new Image();
      img.onload = () => { show.style.backgroundImage = `url(${ART[k]})`; show.style.opacity = '1'; hide.style.opacity = '0'; };
      img.src = ART[k];
    }, 9000);
  }
  function show() {
    if (!el) build();
    render();
    backHash = location.hash;
    el.hidden = false; requestAnimationFrame(() => el.classList.add('open'));
    resume = typeof playing !== 'undefined' && playing;
    if (resume) playBtn.click();   // the scene behind pauses (each mode handles its own pause)
    try { history.replaceState(null, '', location.pathname + location.search + '#today'); } catch (_) {}
    const first = grid.querySelector('.card'); if (first) first.focus({preventScroll: true});
  }
  function hide() {
    if (!el || el.hidden) return;
    el.classList.remove('open'); el.hidden = true; clearInterval(artTimer);
  }
  function close() {
    hide();
    try { history.replaceState(null, '', location.pathname + location.search + backHash); } catch (_) {}
    if (resume && !playing) playBtn.click();
  }
  function open(mode) {
    if (mode === current) { close(); return; }
    hide();
    modeBtn.value = mode; modeBtn.onchange();
    if (resume && !playing) playBtn.click();
  }
  function install() {
    current = modeBtn.value;
    const original = modeBtn.onchange;
    modeBtn.onchange = function () {
      if (modeBtn.value === 'home') { modeBtn.value = current; show(); return; }
      current = modeBtn.value;
      return original.apply(this, arguments);
    };
    if (!firstHash || firstHash === '#' || firstHash === '#today') show();
  }
  return {install, show, open, isOpen: () => !!el && !el.hidden};
})();
