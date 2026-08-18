/**
 * Charcoal on kraft.
 *
 * Everything visible on the page is built here. The rules that keep it from
 * looking machine-made:
 *
 *   - a line wanders on low-frequency noise, it does not vibrate on per-point
 *     random. A hand drifts; static is a computer.
 *   - pressure varies along the stroke. Light going in, bite in the middle,
 *     fading on the way out.
 *   - strokes overshoot their endpoints. Corners never close exactly.
 *   - a searching line goes down first, then the committed one on top.
 *   - the charcoal is masked through the tooth of the paper so it breaks up.
 *
 * Drawing is recorded into a Sheet (a display list) rather than painted
 * straight onto a context. That buys three things at once: strokes can be
 * revealed by arc length (the text writes itself on), a sheet can be cached to
 * an offscreen canvas, and the whole thing stays deterministic between frames.
 */

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- noise --- */

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth 1D value noise. This is what makes a line wander instead of buzz. */
export function noise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i * 1.37 + seed * 57.31);
  const b = hash((i + 1) * 1.37 + seed * 57.31);
  return a + (b - a) * smoothstep(f);
}

/**
 * Proper 2D value noise. Adding 1D noise in x to 1D noise in y is separable and
 * shows up as a plaid weave, which is instantly readable as machine-made — a
 * paper surface has to be built from real 2D noise.
 */
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const at = (a, b) => hash(a * 157.31 + b * 271.17 + seed * 57.73);
  const n00 = at(xi, yi);
  const n10 = at(xi + 1, yi);
  const n01 = at(xi, yi + 1);
  const n11 = at(xi + 1, yi + 1);
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}

/** Three octaves. Big lazy drift plus small tremor, like a real hand. */
export function fbm(x, seed = 0) {
  return (
    noise(x, seed) * 0.6 + noise(x * 2.13, seed + 11.7) * 0.27 + noise(x * 4.91, seed + 23.3) * 0.13
  );
}

/** Centred on zero, range about [-1, 1]. */
function swing(x, seed) {
  return (fbm(x, seed) - 0.5) * 2;
}

/* ------------------------------------------------------------- geometry --- */

/**
 * Where a hand actually goes wrong.
 *
 * A shaky line drawn along a perfect path still reads as machine-made, because
 * the mistake is in the wrong place. What a person gets wrong is the SHAPE: they
 * misjudge where the far corner of a box is, or how far the hem of a coat comes
 * round, and then they draw to that wrong point with a steady hand. Wobbling the
 * stroke instead only produces an exact drawing made by someone shivering.
 *
 * So the error goes in here, into the construction, before anything is drawn —
 * and once it is here the stroke on top is allowed to be calm.
 */
export function nudge(p, seed, amount = 2.2) {
  return {
    x: p.x + (hash(seed * 1.7 + 0.3) - 0.5) * 2 * amount,
    y: p.y + (hash(seed * 3.1 + 1.9) - 0.5) * 2 * amount,
  };
}

/** Nudge every point of a shape, each on its own. */
export function nudgeAll(pts, seed, amount = 2.2) {
  return pts.map((p, i) => nudge(p, seed + i * 7.3, amount));
}

/**
 * One Chaikin pass per call: every corner gets cut. Two passes turn a polygon
 * into something that reads as drawn round rather than plotted.
 */
export function chaikin(pts, closed = true, passes = 1) {
  let cur = pts;
  for (let k = 0; k < passes; k++) {
    const out = [];
    const n = cur.length;
    const last = closed ? n : n - 1;
    if (!closed) out.push(cur[0]);
    for (let i = 0; i < last; i++) {
      const a = cur[i];
      const b = cur[(i + 1) % n];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    if (!closed) out.push(cur[n - 1]);
    cur = out;
  }
  return cur;
}

/**
 * A ring of points round an ellipse, breathing — the shape primitive that
 * replaces `circle()` for anything that is not machined.
 *
 * `hand` says how carefully it was drawn, and it is a statement about the
 * person, not a detail: about .4 for something they looked at while they made it
 * (a head, a face), 1 for a mass they scribbled in (foliage, a heap). Nothing
 * here is a curve — it is points, smoothed once, exactly as a shape gets built
 * on paper.
 */
export function ring(cx, cy, rx, ry, rot = 0, hand = 0.55, seed = 1, n = 16) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    // two harmonics: the slow one is the shape being misjudged, the faster one
    // is the hand not holding the radius steady on the way round
    const k = 1 + (0.17 * Math.sin(th * 2 + seed) + 0.1 * Math.sin(th * 5 + seed * 1.7)) * hand;
    const px = Math.cos(th) * rx * k;
    const py = Math.sin(th) * ry * k;
    pts.push({ x: cx + px * cos - py * sin, y: cy + px * sin + py * cos });
  }
  return chaikin(pts, true, 1);
}



function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polylineLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Evenly spaced points along a polyline. Everything downstream assumes this. */
function resample(pts, spacing) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = dist(a, b);
    if (seg < 1e-6) continue;
    let t = carry;
    while (t + spacing <= seg) {
      t += spacing;
      const u = t / seg;
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
    carry = t - seg;
  }
  const last = pts[pts.length - 1];
  if (dist(out[out.length - 1], last) > spacing * 0.4) out.push(last);
  return out;
}

/** Catmull-Rom through the control points, so curves read as one gesture. */
function spline(pts, per = 8, closed = false) {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice();
  if (closed) p.push(pts[0], pts[1], pts[2]);
  const out = [];
  const n = closed ? pts.length : p.length - 1;
  for (let i = 0; i < n; i++) {
    const p0 = p[Math.max(0, i - 1)] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1] || p[i];
    const p3 = p[i + 2] || p2;
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  if (!closed) out.push(p[p.length - 1]);
  return out;
}

/** Unit normals from central differences. */
function normals(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    out.push({ x: -dy / l, y: dx / l });
  }
  return out;
}

/**
 * Push the line off its perfect path and let it run past both ends.
 * `amp` is in pixels of sideways drift, `over` in pixels of overshoot.
 */
function humanize(pts, seed, amp, over) {
  if (pts.length < 2) return pts;
  const work = pts.slice();

  if (over > 0) {
    const a = work[0];
    const b = work[1];
    const c = work[work.length - 2];
    const d = work[work.length - 1];
    const l1 = dist(a, b) || 1;
    const l2 = dist(c, d) || 1;
    const o1 = over * (0.45 + hash(seed * 3.1) * 0.9);
    const o2 = over * (0.45 + hash(seed * 5.7) * 0.9);
    work.unshift({ x: a.x - ((b.x - a.x) / l1) * o1, y: a.y - ((b.y - a.y) / l1) * o1 });
    work.push({ x: d.x + ((d.x - c.x) / l2) * o2, y: d.y + ((d.y - c.y) / l2) * o2 });
  }

  const nrm = normals(work);
  const total = polylineLength(work) || 1;
  let run = 0;
  const out = [];
  for (let i = 0; i < work.length; i++) {
    if (i > 0) run += dist(work[i - 1], work[i]);
    const t = run / total;
    // one slow arc across the whole stroke plus a finer tremor on top
    const bow = Math.sin(t * Math.PI) * swing(seed * 0.37, seed) * amp * 0.9;
    const tremor = swing(run * 0.035 + seed * 7.3, seed + 3) * amp * 0.55;
    const d = bow + tremor;
    out.push({ x: work[i].x + nrm[i].x * d, y: work[i].y + nrm[i].y * d });
  }
  return out;
}

/* ------------------------------------------------------------ the sheet --- */

/**
 * Two sticks, the way a trois-crayons drawing is made: charcoal for everything
 * that is form, and a red chalk kept for the few marks that are an annotation
 * rather than a drawing — an underline, a box round a word, the press where a
 * sole meets the ground. Used on more than that it stops being an accent.
 *
 * Neither is black. True black is the fastest way to make a drawing look
 * printed; on cream paper there is contrast to spend, so the charcoal is darker
 * than it was on kraft but still warm.
 */
const PIGMENTS = {
  charcoal: [38, 34, 31],
  sanguine: [150, 72, 58],

  /*
   * Coloured chalk, and it obeys two rules without exception.
   *
   * It only ever goes INSIDE a shape, as tone rubbed into it. Every contour on
   * this page stays charcoal, because the moment an outline takes a colour the
   * drawing stops being a charcoal drawing and starts being a cartoon fill with
   * a black keyline round it.
   *
   * And it is laid pale. Chalk on paper is a stain that lets the grain and the
   * hatching underneath come through; anything approaching an opaque fill reads
   * as paint, or worse, as a vector.
   *
   * There is deliberately no white here. White is not a pigment you add, it is
   * the paper you left alone — a white hard hat is drawn by keeping it bare and
   * putting the tone on everything around and under it.
   */
  hiviz: [206, 158, 30],
  denim: [72, 96, 134],
  slate: [58, 64, 74],
  rust: [146, 84, 48],
  olive: [98, 112, 66],
  brick: [158, 96, 74],
};

function pigment(name, alpha, tint = 0) {
  const p = PIGMENTS[name] || PIGMENTS.charcoal;
  return `rgba(${p[0] + tint}, ${p[1] + tint}, ${p[2] + tint}, ${alpha})`;
}

/**
 * How dark a mass is asked to be — the one idea worth taking from the reference
 * generator's material step: a part says how dark, and the engine owns how the
 * dark is made.
 *
 * These are NOT the reference's numbers (`black: 1 … light: .34`). Those are
 * multipliers in an engine that builds density a different way; here a tone is a
 * translucent charcoal drag laid with `multiply`, so the dial IS the alpha, and
 * it lives in a narrow band — past about 0.22 a single pass stops reading as a
 * turned form and starts reading as a smear. So the ladder is built from the
 * values the drawing already reached for, gathered into four rungs it can share:
 *
 *   ghost  a whisper that turns a form without reading as dirt — a skull, the
 *          lit face of a box, the far side of a limb
 *   soft   a soft mass — cloth folds, the shading down a leg
 *   mid    structure — the side of a crate, a hood, a hatched plane that turns
 *   firm   a mark you are meant to see — a shoe, a bag, a clipboard
 *
 * The point is shared vocabulary: the whisper on his head and the whisper on a
 * distant roof are now literally the same value, so the whole page holds one
 * tonal key instead of forty hand-picked alphas drifting apart. Colour is a
 * separate axis (see `wash`) and does not come through here.
 */
export const DENSITY = {
  ghost: 0.06,
  soft: 0.1,
  mid: 0.16,
  firm: 0.21,
};

const DEFAULTS = {
  width: 2.1,
  alpha: 0.88,
  wobble: 1.35, // how far the line wanders off its ideal path
  overshoot: 1.45, // how far it runs past its endpoints
  search: 0.55, // strength of the faint "looking for the line" pass
  grain: 1,
  taper: 1, // 0 = flat width, 1 = full pressure curve
  tint: 0,
  pigment: "charcoal",
};

/**
 * A display list of charcoal marks. Build once, render many times, reveal
 * progressively.
 *
 * Two seeds, and the difference between them is the whole reason the drawing can
 * boil without falling apart:
 *
 *   seed   what the drawing IS. Which way a coat folds, where a prop sits, where
 *          the pencil started going round a circle. Fixed for a given subject.
 *   boil   how the hand made it THIS time. The wander of the spine, the pressure
 *          along it, how the edges are gnawed, where the grain catches.
 *
 * Draw the same subject three times with a different `boil` and you get three
 * drawings of one thing rather than three different things — which, flipped, is
 * the illusion of life. Get the split wrong and the coat changes shape between
 * frames, which is the classic way this effect fails.
 */
export class Sheet {
  constructor(seed = 1, boil = 0) {
    this.seed = seed;
    this.boil = boil;
    this.items = [];
    this.total = 0;
    this._n = 0;
  }

  /** Auto-incrementing seed, so callers never have to invent magic numbers. */
  next() {
    this._n += 1;
    return this.seed * 131.7 + this._n * 17.13;
  }

  /**
   * The seed the mark-making rides on. Everything the engine adds on top of the
   * geometry it was handed goes through here; the geometry itself never does.
   */
  _hand(seed) {
    return seed + this.boil * 613.7;
  }

  _push(item) {
    this.items.push(item);
    this.total += item.len;
    return this;
  }

  /* --- primitives --- */

  stroke(points, opts = {}) {
    if (!points || points.length < 2) return this;
    const o = { ...DEFAULTS, ...opts };
    const seed = o.seed ?? this.next();
    const raw = o.smooth ? spline(points, o.smooth === true ? 8 : o.smooth) : points;
    // sample close together: the edge noise works at grain scale, so it needs
    // samples about a pixel apart to have anything to chew on
    const spacing = Math.max(1.0, o.width * 0.45);
    const base = resample(raw, spacing);
    const hand = this._hand(seed);
    const pts = humanize(base, hand, 1.35 * o.wobble, 3.2 * o.overshoot);
    return this._push({
      kind: "stroke",
      pts,
      len: polylineLength(pts),
      o,
      seed: hand,
    });
  }

  line(x1, y1, x2, y2, opts) {
    return this.stroke([{ x: x1, y: y1 }, { x: x2, y: y2 }], opts);
  }

  /** Open curve through control points. */
  curve(points, opts = {}) {
    return this.stroke(points, { smooth: 8, ...opts });
  }

  /**
   * Closed shape, one stroke per edge so the corners stay corners and run past
   * each other. Splining a rectangle turns it into an oval, so smoothing is
   * opt-in and belongs to `curve`, not here.
   */
  poly(points, opts = {}) {
    // Every corner is misjudged before a single edge is drawn.
    //
    // This is the one line that does the most work in the whole project. A
    // person ruling a crate does not put the corners where they belong and then
    // shake along the edges — they put each corner slightly wrong, by eye, and
    // then draw to it with a steady hand. Exact corners with wobbly edges
    // between them is precisely what a machine imitating a person looks like,
    // and it was what every box, panel, pier and hem here was doing.
    //
    // Pass `exact: true` for the rare thing that really is machined.
    const seed = opts.seed ?? this.next();

    // How wrong the corner goes, and how far the stroke runs past it, both scale
    // with the object. Two pixels is nothing on a building and is the whole hat
    // on a hat — at a fixed size the small props all came out as scaffolding,
    // four lines crossing past each other at every corner.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const span = Math.hypot(maxX - minX, maxY - minY) || 1;
    const jitter = opts.exact ? 0 : opts.jitter ?? Math.min(2.4, Math.max(0.3, span * 0.022));
    const over = Math.min(1.15, Math.max(0.22, span * 0.011));
    const pts = jitter > 0 ? nudgeAll(points, seed, jitter) : points;

    if (opts.smooth) {
      const wrapped = pts.concat([pts[0], pts[1]]);
      return this.stroke(spline(wrapped, 6), { ...opts, seed, smooth: false, overshoot: 0.6 });
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      this.stroke([a, b], { overshoot: over, ...opts, seed: seed + i * 5.9, smooth: false });
    }
    return this;
  }

  /**
   * A closed hand-drawn shape: one stroke carried round the ring and a little
   * past where it started. The ring is expected to carry its own error already
   * (see `ring`), so the stroke over it stays calm.
   */
  blob(points, opts = {}) {
    if (!points || points.length < 3) return this;
    const wrapped = points.concat(points.slice(0, 3));
    return this.stroke(wrapped, { wobble: 0.7, overshoot: 0, ...opts, smooth: false });
  }

  /**
   * A limb CHAIN drawn as one form: two contours running the whole length of the
   * limb — hip to knee to ankle — in one stroke each.
   *
   * Drawn a bone at a time, the two outlines arrive at the knee at different
   * angles and cross, and the leg turns into a bundle of sticks. A person draws
   * the whole leg with two strokes and turns the corner at the joint, so the
   * normal at each joint is mitred between the bone coming in and the bone going
   * out.
   *
   * `joints` is the chain of points, `widths` the girth at each of them.
   * Returns the enclosed polygon so the caller can lay tone inside it.
   */
  chainForm(joints, widths, opts = {}) {
    const n = joints.length;
    if (n < 2) return [];
    const seed = opts.seed ?? this.next();
    const dirs = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = joints[i + 1].x - joints[i].x;
      const dy = joints[i + 1].y - joints[i].y;
      const l = Math.hypot(dx, dy) || 1;
      dirs.push({ x: dx / l, y: dy / l });
    }
    const nrm = [];
    for (let i = 0; i < n; i++) {
      const a = dirs[Math.max(0, i - 1)];
      const b = dirs[Math.min(dirs.length - 1, i)];
      let mx = -(a.y + b.y) / 2;
      let my = (a.x + b.x) / 2;
      const l = Math.hypot(mx, my) || 1;
      // A mitre blows up on a hairpin — and a hard-bent knee IS a hairpin. Let
      // the outside of the bend swell a little and no more: past about 1.3 the
      // inner rail crosses the centreline and the leg ties itself in a knot.
      // A real knee does not bulge on the inside of the bend either, it tucks.
      const scale = Math.min(1.3, 1 / Math.max(0.62, l));
      nrm.push({ x: (mx / l) * scale, y: (my / l) * scale });
    }
    const rail = (side, k) =>
      joints.map((p, i) =>
        nudge(
          {
            x: p.x + nrm[i].x * (widths[i] / 2) * side,
            y: p.y + nrm[i].y * (widths[i] / 2) * side,
          },
          seed + k + i * 4.7,
          0.7
        )
      );
    const L = rail(1, 11.3);
    const R = rail(-1, 31.7);
    const o = { width: 1.5, alpha: 0.86, wobble: 0.72, overshoot: 0.75, ...opts };
    this.stroke(L, { ...o, smooth: 7, seed: seed + 3.3 });
    this.stroke(R, { ...o, smooth: 7, seed: seed + 9.7 });
    return L.concat(R.slice().reverse());
  }

  /**
   * A limb drawn as a form: two contours bounding a mass, wider at the joint it
   * hangs from and narrower at the far end.
   *
   * One line down the middle is a diagram of an arm. Two lines round it is a
   * drawing of one, and it is most of what separates this figure from a
   * schematic. The two rails are nudged apart independently so they are not
   * parallel — a person draws the second line by eye against the first, and
   * misses.
   *
   * Returns the enclosed polygon so the caller can lay tone inside it.
   */
  form(a, b, wA, wB, opts = {}) {
    const seed = opts.seed ?? this.next();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // limbs are not straight: one slow bend along the whole length
    const bow = (hash(seed * 2.7) - 0.5) * Math.min(2.6, len * 0.055);
    const rail = (side, k) => {
      const ha = (wA / 2) * side;
      const hb = (wB / 2) * side;
      const hm = (ha + hb) / 2 + bow;
      return [
        nudge({ x: a.x + nx * ha, y: a.y + ny * ha }, seed + k, 0.85),
        { x: (a.x + b.x) / 2 + nx * hm, y: (a.y + b.y) / 2 + ny * hm },
        nudge({ x: b.x + nx * hb, y: b.y + ny * hb }, seed + k + 5.1, 0.85),
      ];
    };
    const L = rail(1, 11.3);
    const R = rail(-1, 31.7);
    const o = { width: 1.5, alpha: 0.86, wobble: 0.7, overshoot: 1.1, ...opts };
    this.stroke(L, { ...o, smooth: 6, seed: seed + 3.3 });
    this.stroke(R, { ...o, smooth: 6, seed: seed + 9.7 });
    return L.concat(R.slice().reverse());
  }

  circle(x, y, r, opts = {}) {
    return this.ellipse(x, y, r, r, 0, opts);
  }

  /**
   * A hand-drawn round shape: the pencil starts somewhere on the rim, goes
   * round a bit past where it began, and the radius breathes on the way.
   */
  ellipse(x, y, rx, ry, rot = 0, opts = {}) {
    const seed = opts.seed ?? this.next();
    const start = hash(seed * 2.3) * TAU;
    const sweep = TAU + 0.12 + hash(seed * 4.1) * 0.34;
    const n = Math.max(20, Math.round((rx + ry) * 0.7));
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = start + t * sweep;
      const k = 1 + swing(t * 3.4 + seed, seed + 5) * 0.035;
      const px = Math.cos(a) * rx * k;
      const py = Math.sin(a) * ry * k;
      pts.push({ x: x + px * cos - py * sin, y: y + px * sin + py * cos });
    }
    this.stroke(pts, { overshoot: 0, ...opts, seed, smooth: false });

    // the ghost rim: the first attempt, never erased
    if ((opts.ghost ?? 1) > 0) {
      const g = [];
      const gs = seed + 41;
      const gstart = start + 1.1;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = gstart + t * (TAU * 0.72);
        const k = 0.985 + swing(t * 2.7 + gs, gs) * 0.05;
        const px = Math.cos(a) * rx * k;
        const py = Math.sin(a) * ry * k;
        g.push({ x: x + 0.8 + px * cos - py * sin, y: y + 0.6 + px * sin + py * cos });
      }
      this.stroke(g, {
        ...opts,
        seed: gs,
        smooth: false,
        overshoot: 0,
        width: (opts.width ?? DEFAULTS.width) * 0.55,
        alpha: (opts.alpha ?? DEFAULTS.alpha) * 0.26 * (opts.ghost ?? 1),
        search: 0,
        grain: 0,
      });
    }
    return this;
  }

  /** Four separate strokes that run past each other. Never a rect(). */
  box(x, y, w, h, opts = {}) {
    this.line(x, y, x + w, y, opts);
    this.line(x + w, y, x + w, y + h, opts);
    this.line(x + w, y + h, x, y + h, opts);
    this.line(x, y + h, x, y, opts);
    return this;
  }

  /** A filled dot: charcoal pressed down and rubbed. */
  dot(x, y, r, opts = {}) {
    const seed = opts.seed ?? this.next();
    return this._push({
      kind: "dot",
      x,
      y,
      r,
      len: r * 3,
      o: { ...DEFAULTS, ...opts },
      seed: this._hand(seed),
    });
  }

  /** Soft rubbed shadow. No blur filter: a radial gradient is faster and works everywhere. */
  smudge(x, y, rx, ry, rot = 0, opts = {}) {
    const seed = opts.seed ?? this.next();
    return this._push({
      kind: "smudge",
      x,
      y,
      rx,
      ry,
      rot,
      len: (rx + ry) * 0.5,
      o: { alpha: 0.16, ...opts },
      seed: this._hand(seed),
    });
  }

  /**
   * Walk scanlines across a polygon at `angle`, handing each span to `emit`.
   * Shared by hatching (separated lines) and tone (overlapping broad drags).
   */
  _scan(polygon, angle, gapOf, seed, emit) {
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rot = polygon.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of rot) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const back = Math.cos(angle);
    const backSin = Math.sin(angle);
    let k = 0;
    const span = maxY - minY || 1;
    for (let yy = minY; yy < maxY; ) {
      const xs = [];
      for (let i = 0; i < rot.length; i++) {
        const p1 = rot[i];
        const p2 = rot[(i + 1) % rot.length];
        if (p1.y === p2.y) continue;
        if (yy >= Math.min(p1.y, p2.y) && yy < Math.max(p1.y, p2.y)) {
          xs.push(p1.x + ((yy - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x));
        }
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const pad = 1.2 + hash(seed + k * 3.7) * 2.4;
        const x1 = xs[i] - pad;
        const x2 = xs[i + 1] + pad;
        if (x2 - x1 < 2) continue;
        const wob = (hash(seed + k * 5.1) - 0.5) * 1.1;
        const a1 = { x: x1 * back - (yy + wob) * backSin, y: x1 * backSin + (yy + wob) * back };
        const b1 = { x: x2 * back - (yy - wob) * backSin, y: x2 * backSin + (yy - wob) * back };
        emit(a1, b1, k, (yy - minY) / span);
        k++;
      }
      yy += gapOf(k);
    }
  }

  /**
   * Hatch fill: separated strokes that read as individual marks. For structure
   * and material, where you want to see the drawing happen.
   */
  hatch(polygon, opts = {}) {
    const {
      angle = -1.05,
      gap = 5.2,
      width = 0.85,
      alpha = 0.3,
      cross = 0,
      seed = this.next(),
      pigment = "charcoal",
    } = opts;

    const run = (ang, s, a) =>
      this._scan(
        polygon,
        ang,
        (k) => gap * (0.74 + hash(s + k * 7.7) * 0.55),
        s,
        (a1, b1, k) => {
          this.stroke([a1, b1], {
            width: width * (0.7 + hash(s + k * 9.3) * 0.65),
            alpha: a * (0.55 + hash(s + k * 2.9) * 0.7),
            wobble: 0.75,
            overshoot: 0.5,
            search: 0,
            grain: 0.4,
            taper: 0.7,
            pigment,
            seed: s + k * 13.1,
          });
        }
      );

    run(angle, seed, alpha);
    if (cross > 0) run(angle + 1.15, seed + 500, alpha * cross);
    return this;
  }

  /**
   * Tone laid with the side of the stick: broad drags packed close enough to
   * merge into a mass rather than read as separate lines. This is what gives a
   * charcoal drawing weight — outline and hatching alone always look like
   * diagramming, however well the lines are made.
   *
   * `falloff` fades the tone out across the region so a form turns rather than
   * sitting flat.
   */
  tone(polygon, opts = {}) {
    const {
      angle = -0.9,
      alpha = 0.16,
      width = 9,
      seed = this.next(),
      falloff = 0.55,
      from = 0,
      pigment = "charcoal",
    } = opts;
    // gap under the width is what makes the drags overlap and fuse
    const gapOf = (k) => width * (0.42 + hash(seed + k * 4.3) * 0.22);
    this._scan(polygon, angle, gapOf, seed, (a1, b1, k, t) => {
      const ramp = from === 0 ? 1 - t : t;
      const fade = 1 - falloff + falloff * ramp;
      this.stroke([a1, b1], {
        width: width * (0.8 + hash(seed + k * 6.1) * 0.5),
        alpha: alpha * fade * (0.6 + hash(seed + k * 2.3) * 0.75),
        wobble: 0.5,
        overshoot: 0.3,
        search: 0,
        grain: 0.9,
        taper: 0.5,
        pigment,
        seed: seed + k * 17.7,
      });
    });
    return this;
  }

  /**
   * Colour rubbed into a shape.
   *
   * One lay of broad drags reads as stripes at this size — laid that way the
   * hi-vis vest came out tartan. Chalk is not hatched on, it is rubbed in, so it
   * goes down in two crossing passes at roughly half strength each and the paper
   * grain does the rest. Flat across the shape rather than falling off, because
   * this is the colour of the thing, not the light on it: the charcoal tone laid
   * over the top afterwards is what turns the form.
   */
  wash(polygon, opts = {}) {
    const { pigment = "charcoal", alpha = 0.24, width = 7, angle = -0.9 } = opts;
    const seed = opts.seed ?? this.next();
    this.tone(polygon, { angle, width, alpha: alpha * 0.62, falloff: 0.22, seed, pigment });
    this.tone(polygon, {
      angle: angle + 1.28,
      width: width * 0.86,
      alpha: alpha * 0.55,
      falloff: 0.18,
      seed: seed + 313.7,
      pigment,
    });
    return this;
  }

  /**
   * A short, heavy press — the accent an artist puts where forms meet, at a
   * corner, or under a contact point. Small marks, disproportionate effect.
   */
  accent(x, y, len, angle, opts = {}) {
    const dx = Math.cos(angle) * len * 0.5;
    const dy = Math.sin(angle) * len * 0.5;
    return this.stroke([{ x: x - dx, y: y - dy }, { x: x + dx, y: y + dy }], {
      width: opts.width ?? 3.2,
      alpha: opts.alpha ?? 0.85,
      wobble: 0.6,
      overshoot: 0.4,
      search: 0,
      taper: 1,
      ...opts,
    });
  }

  /** Faint construction geometry, left in on purpose. */
  guide(points, opts = {}) {
    return this.stroke(points, {
      width: 0.85,
      alpha: 0.15,
      wobble: 1.4,
      overshoot: 2.2,
      search: 0,
      grain: 0.3,
      ...opts,
    });
  }

  /** A half-hearted rub-out: pale strokes that lift the charcoal. */
  erase(x, y, rx, ry, opts = {}) {
    const seed = opts.seed ?? this.next();
    return this._push({
      kind: "erase",
      x,
      y,
      rx,
      ry,
      len: (rx + ry) * 0.4,
      o: { alpha: opts.alpha ?? 0.5 },
      seed: this._hand(seed),
    });
  }
}

/* ------------------------------------------------------------ rendering --- */

/**
 * How a charcoal mark is actually made
 * ------------------------------------
 * A stick of charcoal is soft and friable. Dragged over toothed paper it leaves
 * pigment on the raised grain and skips the pits, so:
 *
 *   - the body of the mark is a solid deposit whose darkness follows pressure;
 *   - the two edges are chewed independently at the scale of the paper grain,
 *     because the stick's contact facet is irregular;
 *   - the mark is eaten into by the tooth of the board underneath it;
 *   - and it does NOT throw isolated specks out into clean paper. There is a
 *     faint dusting hugging the edge and nothing beyond it.
 *
 * The earlier version scattered round dots around every line. That is what ink
 * splatter looks like, not charcoal, and it is the thing to never do here.
 */

/** Pressure along the stroke: light going in, bite, fading on the way out. */
function pressureAt(t, seed, taper) {
  const ends = Math.pow(Math.sin(Math.min(1, Math.max(0, t)) * Math.PI), 0.32);
  const body = 0.62 + fbm(t * 2.7 + seed * 0.7, seed + 9) * 0.78;
  const shaped = 1 - taper + taper * ends;
  return Math.max(0.1, shaped * body);
}

/**
 * Fill between two independently ragged edges.
 * `hl` and `hr` are per-point half-widths for the left and right sides — they
 * differ, which is what stops the mark reading as a vector outline.
 */
function ribbonLR(ctx, pts, nrm, hl, hr, from, to) {
  ctx.beginPath();
  for (let i = from; i <= to; i++) {
    const p = pts[i];
    const n = nrm[i];
    const x = p.x + n.x * hl[i];
    const y = p.y + n.y * hl[i];
    if (i === from) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = to; i >= from; i--) {
    const p = pts[i];
    const n = nrm[i];
    ctx.lineTo(p.x - n.x * hr[i], p.y - n.y * hr[i]);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStroke(ctx, item, cut) {
  const { o, seed } = item;
  let pts = item.pts;
  if (cut < 1) {
    // truncate by arc length so a stroke can be caught mid-draw
    const want = item.len * cut;
    let run = 0;
    let end = 1;
    for (let i = 1; i < pts.length; i++) {
      run += dist(pts[i - 1], pts[i]);
      end = i;
      if (run >= want) break;
    }
    pts = pts.slice(0, Math.max(2, end + 1));
  }
  if (pts.length < 2) return;

  const n = pts.length;
  const nrm = normals(pts);
  const base = new Array(n);
  const hl = new Array(n);
  const hr = new Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = pressureAt(t, seed, o.taper);
    const b = Math.max(0.26, (o.width * p) / 2);
    base[i] = b;
    // Each edge is gnawed on its own noise at roughly the scale of the paper
    // grain. The bite is proportional to the mark, so a hairline stays a
    // hairline and a heavy mark gets a properly torn edge.
    const bite = Math.min(b * 0.42, 0.45);
    // never let an edge collapse into the centreline: a thin charcoal line is
    // thin but continuous, and a vanishing width beads it into dashes
    hl[i] = Math.max(b * 0.62, b + (fbm(i * 0.42 + seed * 1.7, seed + 3) - 0.5) * 2 * bite);
    hr[i] = Math.max(b * 0.62, b + (fbm(i * 0.39 + seed * 2.9, seed + 71) - 0.5) * 2 * bite);
  }

  // 1. The dusting that hugs the mark. Tight to the edge — never a wide halo,
  //    and never free-floating specks.
  if (o.grain > 0) {
    const dl = hl.map((h, i) => h + 0.35 + base[i] * 0.34);
    const dr = hr.map((h, i) => h + 0.35 + base[i] * 0.34);
    ctx.fillStyle = pigment(o.pigment, Math.min(0.14, o.alpha * 0.16 * o.grain), 26);
    ribbonLR(ctx, pts, nrm, dl, dr, 0, n - 1);
  }

  // 2. The searching line — the first attempt, left underneath. It pulls away
  //    from the committed line in the middle and comes back at the ends, the
  //    way a second pass over a shape does, and it is the single clearest sign
  //    that a hand was hunting for the form rather than plotting it.
  if (o.search > 0 && item.len > 22) {
    const off = [];
    const oh = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const converge = Math.sin(t * Math.PI);
      const d = swing(i * 0.045 + seed * 3.7, seed + 17) * (o.width * 1.5 + 2.4) * converge;
      off.push({ x: pts[i].x + nrm[i].x * d, y: pts[i].y + nrm[i].y * d });
      oh.push(base[i] * 0.52);
    }
    ctx.fillStyle = pigment(o.pigment, o.alpha * 0.17 * o.search, 28);
    ribbonLR(ctx, off, normals(off), oh, oh, 0, n - 1);
  }

  // 3. The mark itself, laid down in runs so its darkness breathes along the
  //    length instead of sitting at one flat value.
  //    Runs abut on a shared sample rather than overlapping: two translucent
  //    fills laid over each other compound their alpha, which was printing a
  //    dark bead at every seam.
  const chunk = Math.max(5, Math.round(n / 6));
  let i = 0;
  let k = 0;
  while (i < n - 1) {
    const to = Math.min(n - 1, i + chunk);
    const mid = (i + to) / 2 / (n - 1);
    let dens = 0.72 + fbm(mid * 3.8 + seed * 1.9, seed + 31) * 0.48;
    // now and then the hand lightens right off, the way it does crossing a
    // rough patch of board or easing round a curve
    if (hash(seed * 5.3 + k * 12.7) > 0.87) dens *= 0.34;
    ctx.fillStyle = pigment(o.pigment, Math.min(0.96, o.alpha * dens), o.tint);
    ribbonLR(ctx, pts, nrm, hl, hr, i, to);
    i = to;
    k++;
  }

  // 4. Where the stick pressed hardest it crushes pigment into the pits and
  //    goes properly black. A thin core, well inside the edges.
  if (o.width > 1.4) {
    const cl = base.map((b) => b * 0.34);
    ctx.fillStyle = pigment(o.pigment, Math.min(0.9, o.alpha * 0.5), o.tint);
    ribbonLR(ctx, pts, nrm, cl, cl, 0, n - 1);
  }
}

function drawDot(ctx, item, cut) {
  const r = item.r * (0.65 + cut * 0.35);
  ctx.fillStyle = pigment(item.o.pigment, item.o.alpha * 0.95, item.o.tint);
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * TAU;
    const rr = r * (0.86 + hash(item.seed + i * 2.7) * 0.28);
    const x = item.x + Math.cos(a) * rr;
    const y = item.y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSmudge(ctx, item, cut) {
  const { x, y, rx, ry, rot, o, seed } = item;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const r = Math.max(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  const a = o.alpha * cut;
  g.addColorStop(0, pigment(o.pigment, a));
  g.addColorStop(0.45, pigment(o.pigment, a * 0.6));
  g.addColorStop(1, pigment(o.pigment, 0));
  ctx.fillStyle = g;
  ctx.scale(1, ry / r);
  // three offset blobs, not one clean oval
  for (let i = 0; i < 3; i++) {
    const ox = (hash(seed + i * 3.1) - 0.5) * rx * 0.5;
    const oy = (hash(seed + i * 6.7) - 0.5) * r * 0.3;
    ctx.beginPath();
    ctx.arc(ox, oy, r * (0.7 + hash(seed + i) * 0.42) * (rx / r), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawErase(ctx, item, cut) {
  const { x, y, rx, ry, o, seed } = item;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = `rgba(0,0,0,${o.alpha * cut})`;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    const yy = y - ry + t * ry * 2;
    ctx.lineWidth = ry * 0.4 * (0.7 + hash(seed + i) * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - rx + (hash(seed + i * 2.3) - 0.5) * 6, yy);
    ctx.lineTo(x + rx + (hash(seed + i * 4.1) - 0.5) * 6, yy + (hash(seed + i) - 0.5) * 4);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Paint a sheet. `reveal` in [0,1] draws only that fraction of the total arc
 * length, in the order the marks were recorded — which is how the lettering
 * writes itself on.
 */
export function renderSheet(ctx, sheet, opts = {}) {
  const { reveal = 1, alpha = 1, x = 0, y = 0, scale = 1 } = opts;
  if (alpha <= 0.004 || reveal <= 0) return;
  ctx.save();
  if (x || y) ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  if (alpha < 1) ctx.globalAlpha = alpha;

  let budget = reveal >= 1 ? Infinity : sheet.total * reveal;
  for (const item of sheet.items) {
    if (budget <= 0) break;
    const cut = budget >= item.len ? 1 : budget / item.len;
    if (item.kind === "stroke") drawStroke(ctx, item, cut);
    else if (item.kind === "dot") drawDot(ctx, item, cut);
    else if (item.kind === "smudge") drawSmudge(ctx, item, cut);
    else if (item.kind === "erase") drawErase(ctx, item, cut);
    budget -= item.len;
  }
  ctx.restore();
}

/* --------------------------------------------------------------- paper --- */

function offscreen(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.floor(w));
  c.height = Math.max(2, Math.floor(h));
  return c;
}

/**
 * Cream laid paper. Base wash, fibre, blotching, wear along the edges, and a
 * couple of creases.
 *
 * This used to be kraft board, which was the wrong surface for the job: the
 * writing is the CV, and brown card costs about a third of the contrast a
 * charcoal line has to work with. Cream is what the drawing was always for.
 */
export function makePaper(w, h, seed = 7) {
  const c = offscreen(w, h);
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;

  const grd = g.createLinearGradient(0, 0, W * 0.6, H);
  grd.addColorStop(0, "#f4ecdb");
  grd.addColorStop(0.42, "#efe5d0");
  grd.addColorStop(0.78, "#e9dcc4");
  grd.addColorStop(1, "#e4d6ba");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  // broad blotching: the board did not dry evenly
  for (let i = 0; i < 26; i++) {
    const bx = hash(seed + i * 3.1) * W;
    const by = hash(seed + i * 7.7) * H;
    const br = (0.1 + hash(seed + i * 2.3) * 0.28) * Math.max(W, H);
    const dark = hash(seed + i * 5.9) > 0.45;
    const rg = g.createRadialGradient(bx, by, 0, bx, by, br);
    const a = 0.02 + hash(seed + i * 9.1) * 0.035;
    rg.addColorStop(0, dark ? `rgba(150,132,104,${a})` : `rgba(255,250,240,${a})`);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg;
    g.fillRect(bx - br, by - br, br * 2, br * 2);
  }

  // per-pixel tooth
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i >> 2) % W;
    const py = (i >> 2) / W | 0;
    // Fine grain is white noise, which is both correct at this scale and cheap.
    // The mid-scale mottling that used to be a per-pixel noise call — and the
    // source of the plaid — is handled by the blotches and streaks below.
    const n = (hash(px * 0.37 + py * 1.13 + seed) - 0.5) * 26;
    const speck = hash(px * 2.1 + py * 3.7 + seed) > 0.9985 ? -70 : 0;
    d[i] += n + speck;
    d[i + 1] += n * 0.85 + speck;
    d[i + 2] += n * 0.55 + speck;
  }
  g.putImageData(img, 0, 0);

  // fibre streaks
  g.save();
  g.globalAlpha = 0.022;
  g.lineCap = "round";
  for (let i = 0; i < 220; i++) {
    const x = hash(seed + i * 3.13) * W;
    const y = hash(seed + i * 7.71) * H;
    const len = 20 + hash(seed + i * 1.9) * 150;
    g.strokeStyle = hash(seed + i * 4.4) > 0.5 ? "#a2917a" : "#fbf5e6";
    g.lineWidth = 0.5 + hash(seed + i * 2.7) * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y + (hash(seed + i * 5.5) - 0.5) * 14, x + len, y + (hash(seed + i) - 0.5) * 9);
    g.stroke();
  }
  g.restore();

  // creases
  g.save();
  for (let i = 0; i < 3; i++) {
    const y0 = (0.2 + hash(seed + i * 12.3) * 0.6) * H;
    const drift = (hash(seed + i * 4.9) - 0.5) * H * 0.25;
    g.globalAlpha = 0.05;
    g.strokeStyle = "#c0ac89";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-10, y0);
    g.bezierCurveTo(W * 0.3, y0 + drift, W * 0.7, y0 - drift, W + 10, y0 + drift * 0.4);
    g.stroke();
    g.globalAlpha = 0.04;
    g.strokeStyle = "#fffaf0";
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(-10, y0 - 1.8);
    g.bezierCurveTo(W * 0.3, y0 + drift - 1.8, W * 0.7, y0 - drift - 1.8, W + 10, y0 + drift * 0.4 - 1.8);
    g.stroke();
  }
  g.restore();

  // wear at the edges
  const vg = g.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.28, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(126,106,74,0.15)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);

  return c;
}

let toothPattern = null;

/**
 * Punch the paper's tooth out of whatever has just been drawn, so the charcoal
 * breaks up on the grain instead of sitting flat on top of it.
 *
 * The grain is a repeating tile used as a pattern: baked into each cached tile
 * once, rather than stamped across the whole screen every frame.
 */
export function punchTooth(g, w, h, strength = 0.3) {
  if (!toothPattern) {
    const tile = makeTooth(256, 256, 3);
    toothPattern = g.createPattern(tile, "repeat");
  }
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.globalAlpha = strength;
  g.fillStyle = toothPattern;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/**
 * The tooth mask itself. Exported for the pattern above and for anything that
 * wants to sample the grain directly.
 */
export function makeTooth(w, h, seed = 3) {
  const c = offscreen(w, h);
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;
  const img = g.createImageData(W, H);
  const d = img.data;
  // Paper tooth is a cellular surface with pits a few pixels across — not
  // per-pixel static. Built from smooth noise at two scales and thresholded so
  // only the pits punch through; white noise here reads as TV snow, not board.
  for (let i = 0; i < d.length; i += 4) {
    const px = (i >> 2) % W;
    const py = (i >> 2) / W | 0;
    const cell = noise2(px * 0.36, py * 0.36, seed + 5);
    const fine = noise2(px * 1.05, py * 1.05, seed + 9);
    const v = cell * 0.62 + fine * 0.38;
    d[i] = 0;
    d[i + 1] = 0;
    d[i + 2] = 0;
    // a high threshold means only the deepest pits punch through, so a hairline
    // is nibbled rather than chopped into dashes
    d[i + 3] = v > 0.62 ? Math.min(255, (v - 0.62) * 500) : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}
