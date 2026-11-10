// New Toy Town: the pace and balance settings (day speed, how much work the train gets, news staging). Pure: storage is passed in.
export const KEY = 'toytown-new-settings';
export const SPEEDS = [.5, 1, 2, 4], BUSY = ['quiet', 'normal', 'busy'], BUSY_FACTOR = {quiet: .4, normal: 1, busy: 2};
export const DEFAULTS = {speed: 1, busy: 'normal', news: true};
export function normalise(o) {
  const s = {...DEFAULTS};
  if (o && typeof o === 'object') { if (SPEEDS.includes(o.speed)) s.speed = o.speed; if (BUSY.includes(o.busy)) s.busy = o.busy; if (typeof o.news === 'boolean') s.news = o.news; }
  return s;
}
export function load(storage) { try { return normalise(JSON.parse(storage.getItem(KEY))); } catch (e) { return {...DEFAULTS}; } }
export function save(storage, s) { try { storage.setItem(KEY, JSON.stringify(normalise(s))); return true; } catch (e) { return false; } }
// how many simulation steps (each at most 50 ms) a frame of `dt` seconds takes at a speed
export const stepsFor = (dt, speed) => Math.max(1, Math.min(10, Math.ceil(dt * speed / .05)));
