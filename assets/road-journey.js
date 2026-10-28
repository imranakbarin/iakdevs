/* Road trip journey: the drive becomes a trip between named places. Each
 * stretch heads for a town in the next landscape; the status line counts down
 * to it, and arriving shows a postcard (where, how far, the weather on the
 * way) and stamps it into a trip log kept on this device. Town names are
 * original. Pure presentation: it reads the road's own state and changes
 * nothing about the drive. */
const RoadJourney = (() => {
  const TOWNS = [
    ['Pinecrest', 'Eagle Rest', 'Snowmelt Falls', 'High Larch'],
    ['Dustwater', 'Mesa Springs', 'Red Hollow', 'Sundial Flats'],
    ['Fernwood', 'Mossbridge', 'Owl Glen', 'Cedar Hollow'],
    ['Saltwind Bay', 'Gull Point', 'Tidecombe', 'Lantern Cove'],
    ['Brickfield', 'Old Mill Town', 'Market Cross', 'Riverside']
  ];
  const GLYPH = ['⛰', '☀', '🌲', '⚓', '🏙'];
  const SEEN = {sun: 'sunshine', sunset: 'a sunset', rain: 'rain', fog: 'fog', snow: 'snow', night: 'the night'};
  const LEG = 44, FLIP = 38 / 44;   // the place cycle: a new landscape takes over 38 s into each 44 s stretch
  const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return h >>> 0; };
  const town = (ix, n) => TOWNS[ix][hash(n, ix) % TOWNS[ix].length];
  let lastDominant = null, clock = 0, fromTown = '', fromKm = 0, weathers = new Set(), card = null, el = null, stamps = null, n = 0;
  const store = {
    get() { try { return new Set(JSON.parse(localStorage.getItem('road-trip:stamps')) || []); } catch (_) { return new Set(); } },
    set(s) { try { localStorage.setItem('road-trip:stamps', JSON.stringify([...s])); } catch (_) {} }
  };
  const total = TOWNS.reduce((a, t) => a + t.length, 0);

  function postcard(name, place, ix, km, came) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'trip-postcard'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;top:78px;transform:translate(-50%,-8px);z-index:6;pointer-events:none;opacity:0;transition:opacity .9s,transform .9s;'
        + 'width:min(320px,calc(100vw - 32px));box-sizing:border-box;padding:14px 18px 12px;border-radius:6px;background:#fbf4e3;color:#3b2a1c;'
        + 'box-shadow:0 10px 30px #0004;border:1px solid #e3d3b0;font:500 13px/1.35 system-ui,-apple-system,sans-serif';
      document.body.append(el);
    }
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div><div style="font:700 10px/1 system-ui;letter-spacing:.14em;color:#9a7b4f">POSTCARD · ${place.toUpperCase()}</div>
      <div style="font:600 24px/1.15 Georgia,serif;margin:6px 0 4px">${name}</div></div>
      <div style="flex:none;width:46px;height:52px;border:2px dashed #b9855a;border-radius:4px;display:grid;place-items:center;font-size:24px;background:#f3e3c2;transform:rotate(4deg)">${GLYPH[ix]}</div></div>
      <div>${km} km from ${fromTown || 'the start'}${came ? ` · came through ${came}` : ''}</div>
      <div style="margin-top:6px;font-size:11.5px;color:#8a6f4c">Stamp ${stamps.size} of ${total} in your trip log</div>`;
    card = {until: performance.now() + 7000};
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translate(-50%,0)'; });
  }
  function arrive(ix, km, places) {
    const name = town(ix, ++n);
    stamps = stamps || store.get(); stamps.add(name); store.set(stamps);
    const came = [...weathers].filter(w => w !== 'sun').map(w => SEEN[w]);
    postcard(name, places[ix].name, ix, Math.max(0.1, km - fromKm).toFixed(1), came.length ? came.slice(0, 2).join(' and ') : '');
    fromTown = name; fromKm = km; weathers = new Set();
  }
  // Called once per road frame with the road's own state; returns the status line.
  function update(s) {
    const {dt, km, speed, dominant, auto, phase, weights, weather, names, cue, stop, places} = s;
    for (const [k, v] of Object.entries(weights)) if (v > .5) weathers.add(k);
    if (card && performance.now() > card.until && el) { el.style.opacity = '0'; el.style.transform = 'translate(-50%,-8px)'; card = null; }
    // Where the drive is heading, and how far that is at the current speed.
    let dest, secs;
    if (auto) {
      const frac = phase % 1, idx = Math.floor(phase) % places.length, ahead = frac < FLIP ? 1 : 2;
      dest = town((idx + ahead) % places.length, n + 1); secs = ((ahead === 1 ? FLIP : 1 + FLIP) - frac) * LEG;
      if (lastDominant !== null && dominant !== lastDominant) arrive(dominant, km, places);
    } else {
      clock += dt;
      if (clock >= LEG) { clock -= LEG; arrive(dominant, km, places); }
      dest = town(dominant, n + 1); secs = LEG - clock;
    }
    if (lastDominant === null) { fromKm = km; lastDominant = dominant; }
    lastDominant = dominant;
    const left = Math.max(0, secs * speed / 1000), dist = left < .1 ? 'arriving' : `in ${left.toFixed(1)} km`;
    const w = ({sun: 'Sunny', sunset: 'Sunset', rain: 'Rain', fog: 'Fog', snow: 'Snow', night: 'Night'})[weather];
    return innerWidth < 600 ? `${places[dominant].name} · ${w} · ${dest} ${dist}` : `${names} · ${w} · ${cue}${stop} · ${dest} ${dist}`;
  }
  return {update, stamps: () => (stamps = stamps || store.get()).size, total};
})();
