/**
 * How scroll turns into a walk.
 *
 * The old mapping was worldX = progress * WORLD: one long continuous strip.
 * That forces a trade nobody wins — cut the scroll and the walk speeds up,
 * because the same ground has to be covered in fewer pixels.
 *
 * So the trip is broken into stops. Each stage gets a slot of scroll: first he
 * stands still while the scene and the writing appear, then he walks on to the
 * next one. The pauses cost scroll but no ground, which is what buys a slower
 * walk and a shorter page at the same time.
 *
 *   scroll ────────────────────────────────────────────►
 *          ‾‾‾‾‾╲___╱‾‾‾‾‾╲___╱‾‾‾‾‾╲___
 *          pausa camina pausa camina pausa
 *
 * SPAN is in world units and derived from the viewport, so the scenes close up
 * on their own on a phone instead of leaving a desert between them.
 */

import { STAGES } from "./stages.js";

export const STAGE_COUNT = STAGES.length;

/** Share of a stage's slot spent standing still. The rest is walking. */
export const DWELL = 0.20;
export const TRAVEL = 1 - DWELL;
export const BLEND_OF_TRAVEL = 0.12;
export const COSTUME_MIX_OF_TRAVEL = 0.15;
export const ARRIVE = 0.04;
export const WRITE_MS = 1600;

const LEGACY_DWELL = 0.4;

/** Scroll-mapped write-on, only used when opts.legacy is set. */
const WRITE_OF_DWELL = 0.62;

/**
 * Scroll height, in viewports. 13 stages × 0.78 ≈ 10.14.
 *
 * The walk covers a fixed distance between stops, so the only way to slow it
 * down is to spend more scroll crossing that distance. Going from 0.65 to 0.78
 * a stage, and handing a larger share of it to walking rather than standing,
 * stretches each leg by about a third. Still well under the 16 screens this
 * started at.
 */
export const TRACK_SCREENS = STAGE_COUNT * 0.78;

/** Distance between two stops, in world units. Keyed to the viewport. */
export function spanFor(visibleWorldWidth) {
  return visibleWorldWidth * 0.62;
}

export function worldLength(span) {
  return (STAGE_COUNT - 1) * span;
}

/**
 * Trapezoidal velocity: lean into the step, hold a comfortable pace, ease off
 * arriving. A sine ease peaks at 1.57x the average speed and that spike in the
 * middle is what read as hurrying; holding a cruise caps it at 1.39x and looks
 * like someone walking rather than lunging.
 */
const RAMP = 0.28;

function easeWalk(t) {
  const x = Math.min(1, Math.max(0, t));
  const norm = 1 - RAMP;
  if (x < RAMP) return (x * x) / (2 * RAMP) / norm;
  if (x <= 1 - RAMP) return (RAMP / 2 + (x - RAMP)) / norm;
  const u = 1 - x;
  return (norm - (u * u) / (2 * RAMP)) / norm;
}

/** Normalised speed at t, for leaning the gait into acceleration. */
function walkSpeed(t) {
  const x = Math.min(1, Math.max(0, t));
  const norm = 1 - RAMP;
  if (x < RAMP) return x / RAMP / norm;
  if (x <= 1 - RAMP) return 1 / norm;
  return (1 - x) / RAMP / norm;
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function gaitAmountOf(walkT, inTravel) {
  if (!inTravel) return 0;
  const b = BLEND_OF_TRAVEL;
  const up = smoothstep(walkT / b);
  const down = 1 - smoothstep((walkT - (1 - b)) / b);
  return up * down;
}

function costumeMixOf(walkT, i) {
  const from = STAGES[i].costume;
  const to = STAGES[i + 1].costume;
  if (from === to) return 0;
  const u = (walkT - (1 - COSTUME_MIX_OF_TRAVEL)) / COSTUME_MIX_OF_TRAVEL;
  return Math.min(1, Math.max(0, u));
}

/**
 * progress in [0,1] -> where he is and what the page should be doing.
 *
 *   stage       slot index: HOLD of i = standing at i; TRAVEL of i = leaving i
 *   nextStage   min(stage+1, N-1)
 *   gaitAmount  0 idle .. 1 stride
 *   walking     gaitAmount > ARRIVE
 *   writeArmed  true iff local < DWELL, or the entire last slot
 *   walkT       0..1 through TRAVEL, 0 in HOLD
 *   dwellT      0..1 through HOLD, 1 in TRAVEL
 *   costumeFrom / costumeTo / costumeMix
 *
 * opts.legacy (from main.js, not from the DOM here) restores DWELL=0.40 and
 * the old scroll-mapped writeT.
 */
export function journeyAt(progress, span, opts = {}) {
  const p = Math.min(1, Math.max(0, progress));
  const u = p * STAGE_COUNT;
  let i = Math.floor(u);
  if (i >= STAGE_COUNT) i = STAGE_COUNT - 1;
  const local = u - i;

  const dwell = opts.legacy ? LEGACY_DWELL : DWELL;
  const travel = 1 - dwell;
  const last = i === STAGE_COUNT - 1;
  const nextStage = Math.min(STAGE_COUNT - 1, i + 1);
  const costumeFrom = STAGES[i].costume;
  const costumeTo = STAGES[nextStage].costume;

  // Last slot is HOLD only — any local — so he never walks past the last stop.
  if (last || local < dwell) {
    const sample = {
      worldX: i * span,
      stage: i,
      nextStage,
      walking: false,
      walkT: 0,
      dwellT: last ? local : local / dwell,
      gaitAmount: 0,
      writeArmed: true,
      costumeFrom,
      costumeTo,
      costumeMix: 0,
      speed: 0,
    };
    if (opts.legacy) sample.writeT = Math.min(1, local / (dwell * WRITE_OF_DWELL));
    return sample;
  }

  const walkT = (local - dwell) / travel;
  const gaitAmount = gaitAmountOf(walkT, true);
  const sample = {
    worldX: (i + easeWalk(walkT)) * span,
    stage: i,
    nextStage,
    walking: opts.legacy ? true : gaitAmount > ARRIVE,
    walkT,
    dwellT: 1,
    gaitAmount,
    writeArmed: false,
    costumeFrom,
    costumeTo,
    costumeMix: costumeMixOf(walkT, i),
    speed: walkSpeed(walkT),
  };
  if (opts.legacy) sample.writeT = 1;
  return sample;
}

/** Alpha for stage `index`'s vignette given where the camera is. */
export function sceneAlpha(worldX, index, span) {
  const d = Math.abs(worldX - index * span);
  const hold = span * 0.34;
  const fade = span * 0.46;
  if (d <= hold) return 1;
  return Math.max(0, 1 - (d - hold) / fade);
}

/** Scroll progress that parks him at stage `i`, for keyboard jumps. */
export function progressForStage(i) {
  const clamped = Math.min(STAGE_COUNT - 1, Math.max(0, i));
  return (clamped + DWELL * 0.72) / STAGE_COUNT;
}

/** Which stage a progress value belongs to. */
export function stageOf(progress) {
  return Math.min(STAGE_COUNT - 1, Math.floor(Math.min(1, Math.max(0, progress)) * STAGE_COUNT));
}
