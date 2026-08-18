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

import { Sheet, ring, nudge, nudgeAll, chaikin, hash, DENSITY } from "./charcoal.js";
import { drawGarment, drawHat, drawProps, LEGWEAR } from "./costumes.js";

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

export function cycleLength(scale) {
  return STEP * Math.max(0.9, scale) * 4;
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
  const stance = 0.56;
  if (t < stance) {
    const u = t / stance;
    return { x: lerp(step, -step, u) * dir, y: 0, planted: true, roll: u };
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
export function skeleton(ground, phase, walking, dir, scale, idleT = 0) {
  const thigh = 35 * scale;
  const shin = 32 * scale;
  const torso = 50 * scale;
  const neckLen = 11 * scale;
  const headR = 17.5 * scale;
  const arm = 27 * scale;
  const forearm = 25 * scale;
  const step = STEP * scale;
  const lift = 18 * scale;

  const ph = walking ? phase : 0.12;

  // standing: breathe, and lean on one leg then the other
  const breath = walking ? 0 : Math.sin(idleT * 1.7) * 1.1 * scale;
  const shift = walking ? 0 : Math.sin(idleT * 0.62) * 2.6 * scale;

  // the body rises twice per cycle, highest at mid-stance
  const bob = walking ? -Math.abs(Math.cos(ph)) * 2.6 * scale : 0;
  const lean = 0.055 * dir * (walking ? 1 : 0.45);

  const hip = pt(
    ground.x + Math.sin(ph) * 1.4 * dir + shift,
    ground.y - (thigh + shin) * 0.95 + bob
  );
  const chest = pt(hip.x + lean * 14, hip.y - torso - breath);
  const neck = pt(chest.x + lean * 5, chest.y - neckLen);
  // the head lags the chest a beat, which is most of what makes a walk read
  const headLag = walking ? Math.sin(ph - 0.7) * 1.3 * scale * dir : 0;
  const head = pt(neck.x + lean * 3 + headLag, neck.y - headR);
  const shoulder = pt(chest.x, chest.y + 5 * scale);

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
  const aR = (-swing * 0.5 + rest) * dir;
  const aL = (swing * 0.5 - rest * 0.72) * dir;
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

/**
 * How thick each part of him is, at scale 1, at the joint it hangs from and at
 * the far end. Taken off the head radius the way a figure is blocked in on
 * paper, not invented: a thigh is a bit over half a head across, a forearm a
 * quarter of one.
 */
const GIRTH = {
  torso: [17.5, 19, 15],
  leg: [9.6, 6.2, 4.6],
  arm: [6.8, 5.1, 3.8],
};

/**
 * A whole limb, drawn as one mass: two contours running its full length and a
 * breath of tone inside. `joints` is the chain, `girths` the width at each.
 */
function limb(sheet, joints, girths, s, w, light = false, seed) {
  const poly = sheet.chainForm(joints, girths.map((g) => g * s), {
    width: w,
    alpha: 0.88,
    seed,
  });
  if (!light) {
    // the side turning away from the light, kept very pale — at this size
    // anything heavier stops reading as a round form and starts reading as dirt
    sheet.tone(poly, { angle: -1.2, width: 4.4 * s, alpha: DENSITY.ghost, falloff: 0.9 });
  }
  return poly;
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
  const seed = 311.7 + (planted ? 3 : 0) + dir;
  const shape = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TWO_PI;
    // the toe runs longer than the heel — a shoe is not symmetrical, and the
    // old version was an ellipse with one side pinched, which read as a pebble
    const stretch = Math.cos(a) > 0 ? 1.12 : 0.86;
    const px = Math.cos(a) * rx * stretch;
    const py = Math.sin(a) * ry * (Math.sin(a) < 0 ? 0.78 : 1);
    shape.push(pt(cx + px * cos - py * sin, cy + px * sin + py * cos));
  }
  const drawn = chaikin(nudgeAll(shape, seed, 0.9 * s), true, 1);
  sheet.blob(drawn, { width: 1.7 * s, alpha: 0.86, seed });
  sheet.tone(drawn, { angle: tilt + 0.2, width: 3.4 * s, alpha: DENSITY.firm, falloff: 0.7 });
  sheet.hatch(drawn, { angle: tilt - 0.9, gap: 3.4 * s, alpha: DENSITY.firm, width: 0.8 });
  // The sole presses into the ground. This is charcoal and stays charcoal: it
  // is drawing, not annotation, and in the red chalk it read as if the shoe
  // were bleeding — which is the whole reason the accent is kept rare.
  sheet.accent(cx, cy + ry * 0.75, rx * 1.1, tilt, { width: 1.9 * s, alpha: 0.45 });
}

/**
 * The hand: one closed mass with a thumb pushed out of it, rather than two
 * ellipses sitting next to each other. At this size that is all a hand can be,
 * but it has to be ONE shape or it reads as a mitten someone dropped.
 */
function mitten(sheet, x, y, dir, s, seed) {
  const palm = ring(x, y, 4.6 * s, 4 * s, 0.25 * dir, 0.6, seed, 12);
  // push the two points nearest the thumb out into a lobe
  const i0 = dir > 0 ? 2 : 8;
  for (let k = 0; k < 3; k++) {
    const i = (i0 + k) % palm.length;
    palm[i] = pt(palm[i].x + 2.4 * dir * s, palm[i].y - 1.3 * s);
  }
  const drawn = chaikin(palm, true, 1);
  sheet.blob(drawn, { width: 1.4 * s, alpha: 0.82, seed });
  sheet.tone(drawn, { angle: -0.9, width: 3 * s, alpha: DENSITY.ghost, falloff: 0.9 });
}

/**
 * The head.
 *
 * It used to be `circle()`, and one perfect circle was doing more to make this
 * figure look machine-drawn than everything else put together — the eye finds a
 * true circle instantly. It is a ring now: a skull slightly taller than it is
 * wide, sat at a degree or two off vertical, with the radius misjudged on the
 * way round. `hand` is low because a head is the one thing on a figure that
 * gets drawn slowly.
 */
function head(sheet, p) {
  const w = 2.5 * Math.max(0.88, p.scale);
  const s = p.scale;
  const seed = 51.3 + p.dir * 7;
  const skull = ring(
    p.head.x,
    p.head.y,
    p.r * 0.95,
    p.r * 1.05,
    (hash(seed) - 0.5) * 0.16,
    0.4,
    seed,
    14
  );
  // the construction arc stays visible, the way it does in a real sketch
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
  sheet.tone(skull, {
    angle: 1.35,
    width: 5.4 * s,
    alpha: DENSITY.ghost,
    falloff: 0.95,
    from: p.dir > 0 ? 1 : 0,
  });
  sheet.blob(skull, { width: w, alpha: 0.9, seed });
  // gone round a second time on the far side, the way you close a head you are
  // not quite happy with
  sheet.stroke(skull.slice(Math.round(skull.length * 0.55)), {
    width: w * 0.6,
    alpha: 0.3,
    wobble: 0.9,
    overshoot: 1.4,
    search: 0,
    seed: seed + 19,
  });
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
  const wNear = 2.6 * Math.max(0.88, s);
  const wFar = 2.0 * Math.max(0.88, s);
  const far = p.dir > 0 ? "L" : "R";
  const near = far === "L" ? "R" : "L";

  // The far side of the body is not just lighter, it is thinner: a limb behind
  // the trunk is further away, and drawing it at the same girth flattens him.
  const leg = (side, w, strong) => {
    const knee = side === "L" ? p.kneeL : p.kneeR;
    const foot = side === "L" ? p.footL : p.footR;
    const roll = side === "L" ? p.rollL : p.rollR;
    const planted = side === "L" ? p.plantedL : p.plantedR;
    const k = strong ? 1 : 0.88;
    // Both legs hang off one pelvis, but rooting them at the same point makes
    // two full-width masses start on top of each other. A hair apart is enough.
    const root = pt(p.hip.x - (strong ? 1 : -1) * p.dir * 1.6 * s, p.hip.y);
    const shank = limb(sheet, [root, knee, foot], GIRTH.leg.map((g) => g * k), s, w, !strong,
      (side === "L" ? 41.7 : 63.1) + p.dir);
    // Trousers are not a garment with a silhouette of their own at this size —
    // they are the leg with denim rubbed into it. The far leg takes less, the
    // way everything on that side does.
    const cloth = LEGWEAR[costume];
    if (cloth) {
      sheet.wash(shank, {
        angle: -1.15,
        width: 4 * s,
        alpha: strong ? 0.28 : 0.2,
        pigment: cloth,
        seed: (side === "L" ? 41.7 : 63.1) + 7,
      });
    }
    if (strong) joint(sheet, knee, Math.PI * 0.5, s);
    shoe(sheet, foot, roll, planted, p.dir, s);
  };
  const arm = (side, w, strong) => {
    const elbow = side === "L" ? p.elbowL : p.elbowR;
    const hand = side === "L" ? p.handL : p.handR;
    const seed = (side === "L" ? 71.3 : 97.1) + p.dir;
    // The near arm hangs off the EDGE of the trunk, not off its centreline —
    // rooted at the spine it came out through the middle of his chest.
    //
    // The far arm is not drawn from the shoulder at all. Seen from the side its
    // upper half is behind the body, and drawing it anyway put two lines
    // straight across his chest, because a trunk made of two contours does not
    // hide anything the way a single thick stroke used to. So only the part that
    // actually clears the body is drawn: elbow, forearm, hand.
    if (!strong) {
      limb(sheet, [elbow, hand], [GIRTH.arm[1] * 0.88, GIRTH.arm[2] * 0.88], s, w * 0.92, true, seed);
      mitten(sheet, hand.x, hand.y, p.dir, s, seed);
      return;
    }
    const root = pt(p.shoulder.x + p.dir * GIRTH.torso[0] * 0.34 * s, p.shoulder.y);
    limb(sheet, [root, elbow, hand], GIRTH.arm, s, w * 0.92, false, seed);
    joint(sheet, elbow, 0.3, s);
    mitten(sheet, hand.x, hand.y, p.dir, s, seed);
  };

  // The shadow he stands in: a rubbed pool plus a hard accent right where the
  // feet meet the ground, which is what pins a figure to the floor.
  sheet.smudge(p.ground.x, p.ground.y + 2, 30 * s, 3.8 * s, 0, { alpha: 0.17 });
  sheet.smudge(p.ground.x + 6 * s * p.dir, p.ground.y + 1, 14 * s, 2.4 * s, 0, { alpha: 0.13 });

  leg(far, wFar, false);
  arm(far, wFar, false);
  // The trunk: neck, chest, hip in one chain, so the neck runs into the
  // shoulders instead of being a separate pair of lines stuck on top.
  limb(sheet, [p.neck, p.chest, p.hip], [7.6, GIRTH.torso[1], GIRTH.torso[2]], s, wNear, false, 23.9);
  joint(sheet, p.hip, 0.1, s);
  joint(sheet, p.shoulder, 0.1, s);
  drawGarment(sheet, p, costume);
  head(sheet, p);
  drawHat(sheet, p, costume);
  leg(near, wNear, true);
  arm(near, wNear, true);
  drawProps(sheet, p, costume);
}

/**
 * Build a Sheet for one pose. Callers cache these by (costume, phase bucket).
 * Coordinates are relative to the feet at (0,0).
 *
 * `boil` redraws the same pose in a different hand — same skeleton, same
 * costume, different charcoal. Flipping between a few of them is what stops him
 * looking like a photograph of a drawing while he stands still.
 */
export function figureSheet({ phase, walking, dir, costume, scale, idleT = 0, seed = 1, boil = 0 }) {
  const sheet = new Sheet(seed, boil);
  const parts = skeleton(pt(0, 0), phase, walking, dir, scale, idleT);

  if (costume === "dad") {
    // the child takes shorter, quicker steps to keep up
    const child = skeleton(pt(44 * dir, 0), phase * 1.6 + 0.35, walking, dir, scale * 0.55, idleT);
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
