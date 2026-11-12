// New Toy Town: the long story. Pure. Ages, birthdays (a "year" is a week of days), weddings between close friends, and babies.
import {cleanChest} from './chest.mjs';
import {clean as cleanChronicle} from './chronicle.mjs';
import {clean as cleanAlbum} from './album.mjs';
import {cleanVisit} from './welcome.mjs';
import {clean as cleanGuide} from './guide.mjs';
export const YEAR_DAYS = 7;
export const AGES = {crumb: 52, pott: 47, bell: 38, pip: 26, tilly: 34, embers: 45, moss: 79, sprocket: 58, hay: 55, chalk: 33, sparky: 29, salt: 67, wick: 61, ada: 15, lew: 14, dot: 8, dash: 9, ivy: 36, rudy: 13, nell: 31, otto: 49, bea: 41, finn: 44, june: 59, ted: 40, gill: 42, apple: 46, mint: 35};
export const BABY_NAMES = ['Pebble', 'Poppy', 'Biscuit', 'Clover', 'Mossy', 'Button', 'Tiny Tim', 'Daisy-May'];
const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// the day of the "year" (0..6) on which somebody has their birthday
export const birthdayOf = id => hash(id) % YEAR_DAYS;
export const isAdult = (id, age) => age >= 20;
// who might marry: two adults, neither married, each other's closest friend and friends enough (score >= need). people: [{id, age, spouse, friends:{id:score}, lamplighter}]
export function pickCouple(people, need = 3) {
  let best = null;
  for (const a of people) { if (a.spouse || a.age < 20 || a.lamplighter) continue;
    for (const b of people) { if (b.id <= a.id || b.spouse || b.age < 20 || b.lamplighter) continue; if (Math.abs(a.age - b.age) > 25) continue;
      const s = Math.min(a.friends[b.id] || 0, b.friends[a.id] || 0); if (s >= need && (!best || s > best.s)) best = {a: a.id, b: b.id, s}; } }
  return best;
}
// a baby for a married couple: at most two each and four in the town
export const canHaveBaby = (kids, totalBabies, marriedDays) => marriedDays >= 2 && kids < 2 && totalBabies < 4;
// Saving the saga between visits (storage is passed in, and may be blocked or full)
export const SAGA_KEY = 'toytown-new-saga';
export function loadSaga(storage) {
  try { const o = JSON.parse(storage.getItem(SAGA_KEY)); if (!o || typeof o !== 'object') return null; const ages = {}; for (const [k, v] of Object.entries(o.ages || {})) if (typeof v === 'number' && v >= 0 && v < 120) ages[k] = v;
    const marriages = (Array.isArray(o.marriages) ? o.marriages : []).filter(m => Array.isArray(m) && m.length === 2 && m.every(x => typeof x === 'string')), babies = (Array.isArray(o.babies) ? o.babies : []).filter(b => b && typeof b.name === 'string' && Array.isArray(b.parents)).map(b => ({name: String(b.name).slice(0, 20), parents: b.parents.filter(x => typeof x === 'string')})).slice(0, 8); const effects = {}; for (const [k, v] of Object.entries(o.effects || {})) if (typeof v === 'string' && k.length < 20 && v.length < 20) effects[k] = v; return {ages, marriages, babies, effects, chest: cleanChest(o.chest), chronicle: cleanChronicle(o.chronicle), album: cleanAlbum(o.album), visit: cleanVisit(o.visit), guide: cleanGuide(o.guide), seasons: (Array.isArray(o.seasons) ? o.seasons : []).filter(x => ['spring', 'summer', 'autumn', 'winter'].includes(x)), wishesTotal: Number.isFinite(o.wishesTotal) && o.wishesTotal >= 0 && o.wishesTotal < 1e6 ? Math.floor(o.wishesTotal) : 0, quest: o.quest && typeof o.quest === 'object' && Number.isFinite(o.quest.day) ? {day: o.quest.day | 0, done: (Array.isArray(o.quest.done) ? o.quest.done : []).filter(x => typeof x === 'string').slice(0, 6), counters: {fish: Math.max(0, o.quest.counters && o.quest.counters.fish | 0), plant: Math.max(0, o.quest.counters && o.quest.counters.plant | 0), feed: Math.max(0, o.quest.counters && o.quest.counters.feed | 0), rest: Math.max(0, o.quest.counters && o.quest.counters.rest | 0), parcel: Math.max(0, o.quest.counters && o.quest.counters.parcel | 0), boat: Math.max(0, o.quest.counters && o.quest.counters.boat | 0), paper: Math.max(0, o.quest.counters && o.quest.counters.paper | 0), tap: Object.fromEntries(Object.keys(o.quest.counters && o.quest.counters.tap || {}).slice(0, 40).map(k => [k, true]))}} : null}; } catch (e) { return null; }
}
export function saveSaga(storage, state) { try { storage.setItem(SAGA_KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
