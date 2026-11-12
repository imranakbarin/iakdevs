// New Toy Town: the first-minute guide. Pure. Steps are done by doing the thing; the guide shows the first step not yet done and then retires.
export const STEPS = [
  {id: 'look', text: 'Welcome! Drag to look around, pinch or scroll to zoom'},
  {id: 'tap', text: 'Tap a resident to meet them'},
  {id: 'paper', text: 'Open the newspaper (top right) to read the day'},
  {id: 'wish', text: 'Check the Wishes tab: neighbours would like your help'},
  {id: 'care', text: 'Open Nature and plant some flowers for the bees'}
];
export const next = done => STEPS.find(s => !done.includes(s.id)) || null;
export const clean = list => (Array.isArray(list) ? list : []).filter(id => STEPS.some(s => s.id === id));
