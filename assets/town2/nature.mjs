// New Toy Town: the wind. Pure. One gentle breeze for the whole town, swelling and easing: foliage, smoke and petals all lean the same way.
// Returns {x, z, gust}: x and z are a lean direction scaled by strength (about 0.3 to 1), gust is 0..1 for how strong it is now.
export function wind(t) {
  const gust = .55 + .3 * Math.sin(t * .31) + .15 * Math.sin(t * .83 + 1.7), a = .45 + .25 * Math.sin(t * .05);   // it also veers a little
  return {x: Math.cos(a) * gust, z: Math.sin(a) * gust, gust};
}
