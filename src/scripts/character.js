/**
 * The walker.
 *
 * The kinematics from the first version were already right — two-bone IK for
 * the knees, a stance/swing foot target — so they are kept. What changed:
 *
 *   - the stride is set so a stage takes nine or ten unhurried steps. Pushing it
 *     wider to cut cadence made him do the splits: at these proportions the feet
 *     must not open past about one leg length. The pauses between stops are what
 *     actually slow the journey down, not the stride.
 *   - the torso rises and falls with the gait, the shoulders counter-rotate,
 *     and the standing foot rolls heel to toe.
 *   - he breathes and shifts his weight when he stops, instead of freezing.
 */

import { Sheet } from "./charcoal.js";
import { drawGarment, drawHat, drawProps } from "./costumes.js";

const TWO_PI = Math.PI * 2;

export function pt(x, y) {
  return { x, y };
}

function down(from, len, angle) {
  return pt(from.x + Math.sin(angle) * len, from.y + Math.cos(angle) * len);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Half-stride at scale 1. A full cycle (two steps) is 4 x STEP world units.
 * This is the number that sets walking cadence.
 */
export const STEP = 32;

// Session override so cycleLength and footTarget stay on the same stride.
// ?step= is parsed in main.js; this module does not read the DOM.
let stepLen = STEP;

export function setStep(n) {
  if (Number.isFinite(n) && n > 0) stepLen = n;
}

export function cycleLength(scale, step = stepLen) {
  return step * Math.max(0.9, scale) * 4;
}

/**
 * Legs animate on a fixed number of poses per stride, the way drawn animation
 * does — never a smooth 60fps interpolation. Now that the walk is slower each
 * pose is held longer, so the count goes up to stop it reading as choppy.
 */
export const PHASE_STEPS = 18;

export function quantizePhase(phase) {
  const t = ((phase % TWO_PI) + TWO_PI) % TWO_PI;
  return (Math.round((t / TWO_PI) * PHASE_STEPS) % PHASE_STEPS) * (TWO_PI / PHASE_STEPS);
}

function wrap01(phase, offset) {
  const p = (((phase + offset) % TWO_PI) + TWO_PI) % TWO_PI;
  return p / TWO_PI;
}

function footTarget(t, step, lift, dir) {
  const stance = 0.58;
  if (t < stance) {
    const u = t / stance;
    // a hair below the line so the plant reads, then flush
    const y = u < 0.08 ? 1.2 : 0;
    return { x: lerp(step, -step, u) * dir, y, planted: true, roll: u };
  }
  const u = (t - stance) / (1 - stance);
  const e = smooth(u);
  return {
    x: lerp(-step, step, e) * dir,
    y: -Math.pow(Math.sin(u * Math.PI), 0.62) * lift,
    planted: false,
    roll: 0,
  };
}

function ikKnee(hip, foot, thigh, shin, dir) {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  let d = Math.hypot(dx, dy);
  if (d < 0.001) return pt(hip.x, hip.y + thigh);
  const max = thigh + shin - 0.6;
  if (d >= max) {
    const k = thigh / (thigh + shin);
    return pt(hip.x + dx * k, hip.y + dy * k);
  }
  const min = Math.abs(thigh - shin) + 0.6;
  if (d < min) d = min;
  const a = (thigh * thigh - shin * shin + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, thigh * thigh - a * a));
  const nx = dx / d;
  const ny = dy / d;
  let px = ny;
  let py = -nx;
  if (dir < 0) {
    px = -px;
    py = -py;
  }
  return pt(hip.x + nx * a + px * h, hip.y + ny * a + py * h);
}

/**
 * Build the pose. `idleT` drives the standing-still behaviour: a slow breath
 * and a shift of weight from one leg to the other.
 */
export function skeleton(ground, phase, walking, dir, scale, idleT = 0, extras = {}) {
  const loadLean = extras.loadLean ?? 0;
  const armCarry = extras.armCarry ?? false;
  const stepScale = extras.stepScale ?? 1;

  const thigh = 35 * scale;
  const shin = 32 * scale;
  const torso = 50 * scale;
  const neckLen = 11 * scale;
  const headR = 17.5 * scale;
  const arm = 27 * scale;
  const forearm = 25 * scale;
  const step = stepLen * scale * stepScale;
  const lift = 21 * scale;

  const ph = walking ? phase : 0.12;

  // standing: breathe, and lean on one leg then the other
  const breath = walking ? 0 : Math.sin(idleT * 1.7) * 1.1 * scale;
  const shift = walking ? 0 : Math.sin(idleT * 0.62) * 2.6 * scale;

  // the body rises twice per cycle, lowest at contact
  const bob = walking ? -Math.abs(Math.cos(ph)) * 3.1 * scale : 0;
  // loadLean pulls toward the carrying hand (left / −dir)
  const lean = (0.09 * (walking ? 1 : 0.45) - loadLean) * dir;

  const hip = pt(
    ground.x + Math.sin(ph) * 2.0 * dir + shift,
    ground.y - (thigh + shin) * 0.95 + bob
  );
  const chest = pt(hip.x + lean * 14, hip.y - torso - breath);
  const neck = pt(chest.x + lean * 5, chest.y - neckLen);
  // the head lags the chest a beat, which is most of what makes a walk read
  const headLag = walking ? Math.sin(ph - 0.7) * 1.8 * scale * dir : 0;
  const look = walking ? 2.2 * dir * scale : 0;
  const head = pt(neck.x + lean * 3 + headLag + look, neck.y - headR);
  const counter = walking ? -Math.sin(ph) * 2.4 * scale * dir : 0;
  const shoulder = pt(chest.x + counter, chest.y + 5 * scale);

  // Standing is its own pose, not a walk frame held still. Borrowing a stride
  // frame left him frozen mid-step with his arms swinging — and since he comes
  // to a halt at every stage, this is the pose that gets looked at longest.
  const fR = walking
    ? footTarget(wrap01(ph, 0), step, lift, dir)
    : { x: step * 0.44 * dir, y: 0, planted: true, roll: 0.5 };
  const fL = walking
    ? footTarget(wrap01(ph, Math.PI), step, lift, dir)
    : { x: -step * 0.34 * dir, y: 0, planted: true, roll: 0.5 };
  const footR = pt(ground.x + fR.x, ground.y + fR.y);
  const footL = pt(ground.x + fL.x, ground.y + fL.y);
  const kneeR = ikKnee(hip, footR, thigh, shin, dir);
  const kneeL = ikKnee(hip, footL, thigh, shin, dir);

  // arms hang when he is not walking, with a slow drift so he is never a statue
  const swing = walking ? Math.cos(ph) : Math.sin(idleT * 0.8) * 0.09;
  // Standing arms need to hang clear of the body. Left exactly vertical they
  // land on top of the spine and the figure loses both of them.
  const rest = walking ? 0 : 0.27;
  const ampR = walking ? (armCarry ? 0.35 : 0.72) : 0.5;
  const ampL = walking ? 0.72 : 0.5;
  const restR = walking && armCarry ? 0.42 : rest;
  const aR = (-swing * ampR + restR) * dir;
  const aL = (swing * ampL - rest * 0.72) * dir;
  const eR = 0.2 + Math.max(0, -swing) * 0.28;
  const eL = 0.2 + Math.max(0, swing) * 0.28;
  const elbowR = down(shoulder, arm, aR);
  const handR = down(elbowR, forearm, aR + eR * dir);
  const elbowL = down(shoulder, arm, aL);
  const handL = down(elbowL, forearm, aL + eL * dir);

  return {
    hip,
    chest,
    neck,
    head,
    shoulder,
    kneeL,
    footL,
    kneeR,
    footR,
    rollL: fL.roll,
    rollR: fR.roll,
    plantedL: fL.planted,
    plantedR: fR.planted,
    elbowL,
    handL,
    elbowR,
    handR,
    r: headR,
    scale,
    dir,
    ground,
    phase: ph,
    walking,
    idleT,
  };
}

/* ------------------------------------------------------------- drawing --- */

/** A circle as a polygon, for toning. */
function disc(cx, cy, r, n = 16) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TWO_PI;
    out.push(pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return out;
}

function limb(sheet, a, b, w) {
  sheet.line(a.x, a.y, b.x, b.y, { width: w, alpha: 0.88, wobble: 1.15, overshoot: 0.9 });
}

/**
 * The press an artist leaves at a joint. Tiny marks, but they are most of what
 * separates a drawn figure from a wireframe: the eye reads them as weight
 * gathering where the bones meet.
 */
function joint(sheet, p, angle, s) {
  sheet.accent(p.x, p.y, 4.2 * s, angle, { width: 1.9 * s, alpha: 0.34 });
}

/** Shoes are wedges, hatched, and they roll off the heel. */
function shoe(sheet, foot, roll, planted, dir, s) {
  const tilt = planted ? (0.5 - roll) * 0.34 * dir : -0.16 * dir;
  const cx = foot.x + 5.4 * dir * s;
  const cy = foot.y + 1.4;
  const rx = 9.4 * s;
  const ry = 4.2 * s;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const shape = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TWO_PI;
    const px = Math.cos(a) * rx * (a > Math.PI ? 0.94 : 1);
    const py = Math.sin(a) * ry;
    shape.push(pt(cx + px * cos - py * sin, cy + px * sin + py * cos));
  }
  sheet.poly(shape, { width: 1.7 * s, alpha: 0.86 });
  sheet.tone(shape, { angle: tilt + 0.2, width: 3.4 * s, alpha: 0.2, falloff: 0.7 });
  sheet.hatch(shape, { angle: tilt - 0.9, gap: 3.4 * s, alpha: 0.2, width: 0.8 });
  // the sole presses into the ground
  sheet.accent(cx, cy + ry * 0.75, rx * 1.1, tilt, { width: 1.9 * s, alpha: 0.45 });
}

function mitten(sheet, x, y, dir, s) {
  sheet.ellipse(x, y, 4.7 * s, 3.9 * s, 0.25 * dir, { width: 1.4 * s, alpha: 0.82, ghost: 0.5 });
  sheet.ellipse(x + 3.2 * dir * s, y - 1.5 * s, 2.1 * s, 1.8 * s, 0.6 * dir, {
    width: 1.2 * s,
    alpha: 0.72,
    ghost: 0,
  });
}

function head(sheet, p) {
  const w = 2.5 * Math.max(0.88, p.scale);
  const s = p.scale;
  // the construction circle stays visible, the way it does in a real sketch
  sheet.guide(
    [
      pt(p.head.x - p.r * 1.1, p.head.y),
      pt(p.head.x, p.head.y - p.r * 1.12),
      pt(p.head.x + p.r * 1.1, p.head.y),
    ],
    { smooth: 6, alpha: 0.1 }
  );
  // A whisper of tone turning the skull. At this size anything heavier stops
  // reading as form and starts reading as scribble across his face, so the
  // drags are packed tight and kept very pale.
  // wide drags, few of them: at 2px spacing this one detail cost more to build
  // than the rest of the figure put together
  sheet.tone(disc(p.head.x, p.head.y, p.r * 0.92), {
    angle: 1.35,
    width: 5.4 * s,
    alpha: 0.05,
    falloff: 0.95,
    from: p.dir > 0 ? 1 : 0,
  });
  sheet.circle(p.head.x, p.head.y, p.r, { width: w, alpha: 0.9 });
  sheet.dot(p.head.x + p.r * 0.4 * p.dir, p.head.y - p.r * 0.02, 2.4 * s, { alpha: 0.9 });
}

/**
 * Draw the figure into `sheet`. The far arm and leg go down first so the near
 * ones overlap them — the cheapest possible read of depth.
 */
export function drawFigure(sheet, p, costume) {
  const s = p.scale;
  // Weight hierarchy: the near side of the body carries the heaviest line, the
  // far side sits back a little lighter. Flat, uniform line weight everywhere
  // is what makes a drawing look plotted rather than drawn.
  const wNear = (p.walking ? 2.8 : 2.6) * Math.max(0.88, s);
  const wFar = 2.0 * Math.max(0.88, s);
  const far = p.dir > 0 ? "L" : "R";
  const near = far === "L" ? "R" : "L";

  const leg = (side, w, strong) => {
    const knee = side === "L" ? p.kneeL : p.kneeR;
    const foot = side === "L" ? p.footL : p.footR;
    const roll = side === "L" ? p.rollL : p.rollR;
    const planted = side === "L" ? p.plantedL : p.plantedR;
    limb(sheet, p.hip, knee, w);
    limb(sheet, knee, foot, w);
    if (strong) joint(sheet, knee, Math.PI * 0.5, s);
    shoe(sheet, foot, roll, planted, p.dir, s);
  };
  const arm = (side, w, strong) => {
    const elbow = side === "L" ? p.elbowL : p.elbowR;
    const hand = side === "L" ? p.handL : p.handR;
    limb(sheet, p.shoulder, elbow, w * 0.92);
    limb(sheet, elbow, hand, w * 0.92);
    if (strong) joint(sheet, elbow, 0.3, s);
    mitten(sheet, hand.x, hand.y, p.dir, s);
  };

  // The shadow he stands in: a rubbed pool plus a hard accent right where the
  // planted foot meets the ground, which is what pins a figure to the floor.
  const planted = p.plantedR ? p.footR : p.footL;
  sheet.smudge(planted.x, p.ground.y + 2, 30 * s, 3.8 * s, 0, { alpha: 0.17 });
  sheet.smudge(planted.x + 6 * s * p.dir, p.ground.y + 1, 14 * s, 2.4 * s, 0, { alpha: 0.13 });

  leg(far, wFar, false);
  arm(far, wFar, false);
  limb(sheet, p.neck, p.hip, wNear);
  joint(sheet, p.hip, 0.1, s);
  joint(sheet, p.shoulder, 0.1, s);
  drawGarment(sheet, p, costume);
  head(sheet, p);
  drawHat(sheet, p, costume);
  leg(near, wNear, true);
  arm(near, wNear, true);
  drawProps(sheet, p, costume);
}

function extrasFor(costume) {
  if (costume === "suitcase") return { loadLean: 0.03, armCarry: false, stepScale: 1 };
  if (costume === "linux" || costume === "badge") return { loadLean: 0, armCarry: true, stepScale: 1 };
  return { loadLean: 0, armCarry: false, stepScale: 1 };
}

/**
 * Build a Sheet for one pose. Callers cache these by (costume, phase bucket).
 * Coordinates are relative to the feet at (0,0).
 */
export function figureSheet({ phase, walking, dir, costume, scale, idleT = 0, seed = 1 }) {
  const sheet = new Sheet(seed);
  const extras = extrasFor(costume);
  const parts = skeleton(pt(0, 0), phase, walking, dir, scale, idleT, extras);

  if (costume === "dad") {
    // the child takes shorter, quicker steps to keep up
    const child = skeleton(pt(44 * dir, 0), phase * 1.35 + 0.35, walking, dir, scale * 0.55, idleT);
    drawFigure(sheet, parts, null);
    drawFigure(sheet, child, "child");
    sheet.line(parts.handR.x, parts.handR.y, child.handL.x, child.handL.y, {
      width: 1.5,
      alpha: 0.7,
      wobble: 1.6,
    });
    return sheet;
  }

  drawFigure(sheet, parts, costume);
  return sheet;
}
