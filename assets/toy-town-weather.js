/* Toy Town weather — the town gets the weather of your part of the world.
 * Uses Open-Meteo (free, no key). There is no location prompt: the browser's
 * time zone picks a nearby city (e.g. Asia/Kolkata → Delhi), so only that
 * coarse city's coordinates are ever sent. If the request fails, the town keeps
 * fine weather. ?weather=clear|cloud|fog|rain|snow|storm overrides it.
 * window.ToyTownWeather = {state, ready, describe} ; state = {kind, emoji, label, temp, wind, source} */
(function (root) {
  'use strict';
  // Time-zone → representative city (lat, lon). The continent default covers the rest.
  const CITIES = {
    'Asia/Kolkata': [28.61, 77.21], 'Asia/Calcutta': [28.61, 77.21], 'Asia/Dubai': [25.2, 55.27], 'Asia/Karachi': [24.86, 67.0],
    'Asia/Dhaka': [23.81, 90.41], 'Asia/Kathmandu': [27.72, 85.32], 'Asia/Colombo': [6.93, 79.86], 'Asia/Singapore': [1.35, 103.82],
    'Asia/Kuala_Lumpur': [3.14, 101.69], 'Asia/Bangkok': [13.76, 100.5], 'Asia/Jakarta': [-6.2, 106.85], 'Asia/Manila': [14.6, 120.98],
    'Asia/Shanghai': [31.23, 121.47], 'Asia/Hong_Kong': [22.32, 114.17], 'Asia/Tokyo': [35.68, 139.69], 'Asia/Seoul': [37.57, 126.98],
    'Asia/Riyadh': [24.71, 46.68], 'Asia/Qatar': [25.29, 51.53], 'Asia/Tehran': [35.69, 51.39], 'Asia/Jerusalem': [31.77, 35.21],
    'Europe/London': [51.51, -0.13], 'Europe/Dublin': [53.35, -6.26], 'Europe/Paris': [48.86, 2.35], 'Europe/Berlin': [52.52, 13.4],
    'Europe/Madrid': [40.42, -3.7], 'Europe/Rome': [41.9, 12.5], 'Europe/Amsterdam': [52.37, 4.9], 'Europe/Stockholm': [59.33, 18.07],
    'Europe/Istanbul': [41.01, 28.98], 'Europe/Moscow': [55.76, 37.62], 'America/New_York': [40.71, -74.01], 'America/Chicago': [41.88, -87.63],
    'America/Denver': [39.74, -104.99], 'America/Los_Angeles': [34.05, -118.24], 'America/Toronto': [43.65, -79.38], 'America/Vancouver': [49.28, -123.12],
    'America/Mexico_City': [19.43, -99.13], 'America/Sao_Paulo': [-23.55, -46.63], 'America/Buenos_Aires': [-34.6, -58.38],
    'Africa/Cairo': [30.04, 31.24], 'Africa/Lagos': [6.52, 3.38], 'Africa/Nairobi': [-1.29, 36.82], 'Africa/Johannesburg': [-26.2, 28.05],
    'Australia/Sydney': [-33.87, 151.21], 'Australia/Melbourne': [-37.81, 144.96], 'Australia/Perth': [-31.95, 115.86], 'Pacific/Auckland': [-36.85, 174.76]
  };
  const CONTINENT = {Asia: [28.61, 77.21], Europe: [51.51, -0.13], America: [40.71, -74.01], Africa: [-1.29, 36.82], Australia: [-33.87, 151.21], Pacific: [-36.85, 174.76]};
  // WMO weather codes → the town's kinds.
  function describe(code, wind = 0) {
    const k = code >= 95 ? 'storm' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow'
      : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? 'rain' : code === 45 || code === 48 ? 'fog' : code >= 2 ? 'cloud' : 'clear';
    const look = {clear: ['☀️', 'sunny'], cloud: ['⛅', 'cloudy'], fog: ['🌫️', 'misty'], rain: ['🌧️', 'rain'], snow: ['❄️', 'snow'], storm: ['⛈️', 'thunderstorm']}[k];
    return {kind: k, emoji: look[0], label: wind > 35 && k !== 'storm' ? look[1] + ' and windy' : look[1], windy: wind > 35};
  }
  const fine = {kind: 'clear', emoji: '☀️', label: 'fine', temp: null, wind: 0, source: 'default'};
  const api = {state: fine, describe};
  const forced = typeof location !== 'undefined' && new URLSearchParams(location.search).get('weather');
  async function load() {
    if (forced) { const codes = {clear: 0, cloud: 3, fog: 45, rain: 63, snow: 73, storm: 95}; const d = describe(codes[forced] ?? 0); return Object.assign({temp: null, wind: 0, source: 'override'}, d); }
    if (typeof fetch !== 'function') return fine;
    let zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    const [lat, lon] = CITIES[zone] || CONTINENT[zone.split('/')[0]] || CITIES['Europe/London'];
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = setTimeout(() => ctl && ctl.abort(), 5000);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m,wind_speed_10m`, ctl ? {signal: ctl.signal} : {});
      const c = (await r.json()).current; if (!c || !Number.isFinite(c.weather_code)) return fine;
      return Object.assign({temp: Math.round(c.temperature_2m), wind: c.wind_speed_10m || 0, source: 'Open-Meteo', zone}, describe(c.weather_code, c.wind_speed_10m || 0));
    } catch (e) { return fine; } finally { clearTimeout(timer); }
  }
  api.ready = load().then(s => {
    api.state = s;
    const el = typeof document !== 'undefined' && document.getElementById('weather');
    if (el && s.source !== 'default') { el.textContent = ` · ${s.emoji}${s.temp !== null ? ' ' + s.temp + '°' : ''}`; el.title = `Weather: ${s.label}${s.source === 'Open-Meteo' ? ' (Open-Meteo, near ' + (s.zone || 'you').split('/').pop().replace(/_/g, ' ') + ')' : ''}`; }
    return s;
  });
  root.ToyTownWeather = api;
})(typeof window !== 'undefined' ? window : globalThis);
