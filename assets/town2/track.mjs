// New Toy Town: where a parcel is on its way. Pure. A parcel goes through these steps (the short list when it is just walked over).
export const STEPS_TRAIN = ['Waiting for a carrier', 'On its way to the station', 'Waiting at the station', 'On the train', 'At the far station', 'On its way to the door', 'Delivered'];
export const STEPS_DIRECT = ['Waiting for a carrier', 'Being carried to the door', 'Delivered'];
// c: a cargo item {state: ready|carried|station|train, direct, dispatched, at, originStation, destStation}
export function stageOf(c) {
  if (c.direct) return {step: c.state === 'ready' ? 0 : 1, steps: STEPS_DIRECT.length, label: STEPS_DIRECT[c.state === 'ready' ? 0 : 1]};
  let k = 0;
  if (c.state === 'carried') k = c.dispatched ? 5 : 1; else if (c.state === 'station') k = c.at === c.destStation ? 4 : 2; else if (c.state === 'train') k = 3;
  return {step: k, steps: STEPS_TRAIN.length, label: STEPS_TRAIN[k]};
}
export const dots = (step, steps) => Array.from({length: steps}, (_, i) => i <= step ? '●' : '○').join('');
// seconds until the train reaches a station, from the train's state. train: {at, wait, next}; stops: [{id, ahead}] where ahead is the distance still to run to that station's stopping point.
export function etas(train, stops, speed = 1.38, dwell = 7.5) {
  const out = {}, order = stops.slice().sort((a, b) => a.ahead - b.ahead);
  order.forEach((st, i) => { out[st.id] = st.id === train.at ? 0 : st.ahead / speed + (train.at ? Math.max(0, train.wait) : 0) + i * dwell - (order[0].id === train.at ? dwell : 0); });
  return out;
}
