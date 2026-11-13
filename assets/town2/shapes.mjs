// New Toy Town: two small shape helpers shared by the figure builders (people.mjs, animals.mjs).
// ell: an ellipsoid with the given radii at (x, y, z). rod: a tapered rod from point A to point B (radius r0 at A, r1 at B).
// How round the little blobs are: the light version for weak browsers (TVs) uses fewer segments. Set once, before any figure is built.
export const DETAIL = {seg: 9, head: 18, rod: 8, lite: false};
export const setDetail = lite => { Object.assign(DETAIL, lite ? {seg: 6, head: 10, rod: 5, lite: true} : {seg: 9, head: 18, rod: 8, lite: false}); };
export const ell = (b, x, y, z, rx, ry, rz, colour, seg = 9, o = {}) => b.sph(1, colour, {x, y, z, sx: rx, sy: ry, sz: rz, seg: Math.min(seg, DETAIL.seg), ...o});
export function rod(b, A, B, r0, r1, colour, seg = 7) {
  const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], len = Math.hypot(dx, dy, dz) || 1e-4;
  b.cyl(r1, r0, len, colour, {x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2, z: (A[2] + B[2]) / 2, rx: Math.atan2(Math.hypot(dx, dz), dy), ry: Math.atan2(dx, dz), centre: true, seg: Math.min(seg, DETAIL.rod)});
}
