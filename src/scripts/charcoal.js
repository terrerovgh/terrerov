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

// Warm, not black. Charcoal on kraft reads brown-grey, and true black is the
// fastest way to make a drawing look printed.
const INK = [44, 36, 29];

function inkColor(alpha, tint = 0) {
  return `rgba(${INK[0] + tint}, ${INK[1] + tint}, ${INK[2] + tint}, ${alpha})`;
}

const DEFAULTS = {
  width: 2.1,
  alpha: 0.88,
  wobble: 1.35, // how far the line wanders off its ideal path
  overshoot: 1.45, // how far it runs past its endpoints
  search: 0.55, // strength of the faint "looking for the line" pass
  grain: 1,
  taper: 1, // 0 = flat width, 1 = full pressure curve
  tint: 0,
};

/**
 * A display list of charcoal marks. Build once, render many times, reveal
 * progressively.
 */
export class Sheet {
  constructor(seed = 1) {
    this.seed = seed;
    this.items = [];
    this.total = 0;
    this._n = 0;
  }

  /** Auto-incrementing seed, so callers never have to invent magic numbers. */
  next() {
    this._n += 1;
    return this.seed * 131.7 + this._n * 17.13;
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
    const pts = humanize(base, seed, 1.35 * o.wobble, 3.2 * o.overshoot);
    return this._push({
      kind: "stroke",
      pts,
      len: polylineLength(pts),
      o,
      seed,
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
    if (opts.smooth) {
      const wrapped = points.concat([points[0], points[1]]);
      return this.stroke(spline(wrapped, 6), { ...opts, smooth: false, overshoot: 0.6 });
    }
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.stroke([a, b], { overshoot: 1.15, ...opts, smooth: false });
    }
    return this;
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
      seed,
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
      seed,
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
        seed: seed + k * 17.7,
      });
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
      seed,
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
    ctx.fillStyle = inkColor(Math.min(0.14, o.alpha * 0.16 * o.grain), 26);
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
    ctx.fillStyle = inkColor(o.alpha * 0.17 * o.search, 28);
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
    ctx.fillStyle = inkColor(Math.min(0.96, o.alpha * dens), o.tint);
    ribbonLR(ctx, pts, nrm, hl, hr, i, to);
    i = to;
    k++;
  }

  // 4. Where the stick pressed hardest it crushes pigment into the pits and
  //    goes properly black. A thin core, well inside the edges.
  if (o.width > 1.4) {
    const cl = base.map((b) => b * 0.34);
    ctx.fillStyle = inkColor(Math.min(0.9, o.alpha * 0.5), o.tint);
    ribbonLR(ctx, pts, nrm, cl, cl, 0, n - 1);
  }
}

function drawDot(ctx, item, cut) {
  const r = item.r * (0.65 + cut * 0.35);
  ctx.fillStyle = inkColor(item.o.alpha * 0.95, item.o.tint);
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
  g.addColorStop(0, inkColor(a));
  g.addColorStop(0.45, inkColor(a * 0.6));
  g.addColorStop(1, inkColor(0));
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
 * Kraft board. Base wash, fibre, blotching, a ghost of the corrugation, wear
 * along the edges, and a couple of creases.
 */
export function makePaper(w, h, seed = 7) {
  const c = offscreen(w, h);
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;

  const grd = g.createLinearGradient(0, 0, W * 0.6, H);
  grd.addColorStop(0, "#cdad7c");
  grd.addColorStop(0.42, "#c6a370");
  grd.addColorStop(0.78, "#bd9964");
  grd.addColorStop(1, "#b28d5a");
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
    rg.addColorStop(0, dark ? `rgba(120,92,54,${a})` : `rgba(226,201,158,${a})`);
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
  g.globalAlpha = 0.03;
  g.lineCap = "round";
  for (let i = 0; i < 220; i++) {
    const x = hash(seed + i * 3.13) * W;
    const y = hash(seed + i * 7.71) * H;
    const len = 20 + hash(seed + i * 1.9) * 150;
    g.strokeStyle = hash(seed + i * 4.4) > 0.5 ? "#6b4c2e" : "#e6cfa6";
    g.lineWidth = 0.5 + hash(seed + i * 2.7) * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y + (hash(seed + i * 5.5) - 0.5) * 14, x + len, y + (hash(seed + i) - 0.5) * 9);
    g.stroke();
  }
  g.restore();

  // ghost of the corrugation, very faint
  g.save();
  g.globalAlpha = 0.016;
  g.strokeStyle = "#7a5834";
  g.lineWidth = 3;
  for (let x = -20; x < W + 20; x += 13) {
    g.beginPath();
    g.moveTo(x + noise(x * 0.02, seed) * 6, 0);
    g.lineTo(x + noise(x * 0.02, seed + 1) * 6, H);
    g.stroke();
  }
  g.restore();

  // creases
  g.save();
  for (let i = 0; i < 3; i++) {
    const y0 = (0.2 + hash(seed + i * 12.3) * 0.6) * H;
    const drift = (hash(seed + i * 4.9) - 0.5) * H * 0.25;
    g.globalAlpha = 0.05;
    g.strokeStyle = "#8a6538";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-10, y0);
    g.bezierCurveTo(W * 0.3, y0 + drift, W * 0.7, y0 - drift, W + 10, y0 + drift * 0.4);
    g.stroke();
    g.globalAlpha = 0.035;
    g.strokeStyle = "#f0dcb4";
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
  vg.addColorStop(1, "rgba(58,40,22,0.2)");
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
