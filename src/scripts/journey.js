/**
 * How scroll turns into a walk.
 *
 * The trip is broken into stops. Each stage owns a slot of scroll: he stands
 * still while the scene and the writing appear, then he walks on to the next
 * one. The pauses cost scroll but no ground, which is what buys a slow walk and
 * a page that still ends.
 *
 *   scroll ────────────────────────────────────────────►
 *          ‾‾‾‾‾╲___╱‾‾‾‾‾╲___╱‾‾‾‾‾╲___
 *          pausa camina pausa camina pausa
 *
 * The two phases are declared in viewports of scroll rather than as shares of a
 * slot, because that is the number that decides how the thing actually feels:
 * how far you push the wheel to cross a leg, and how long the page sits still
 * with a block of text on it. Everything else is derived from them.
 *
 * The page puts a scroll-snap point at every `progressForStage`, so the scroll
 * settles with the walker parked and his text finished rather than mid-stride.
 * The snap is `proximity`, not `mandatory`: it catches a gesture that has ended
 * near a stop and leaves every other gesture alone.
 *
 * This file does not decide how fast any of it plays. The scroll only says where
 * he should be; main.js walks him there at a pace the legs can sell.
 */

import { STAGES } from "./stages.js";

export const STAGE_COUNT = STAGES.length;

/**
 * Scroll spent standing at a stop, and scroll spent walking to the next.
 *
 * These used to be 0.5 and 0.6, which put the page at nearly sixteen screens.
 * That was a habit from when the scrollbar drove the walk and the only way to
 * slow him down was to make the reader scroll further. He has his own clock now
 * (SLOT_SECONDS in main.js), so buying pace with page length buys nothing — it
 * only makes the trip longer to get through. The ratio between the two is what
 * still matters, and that is unchanged.
 */
const DWELL_SCREENS = 0.34;
const TRAVEL_SCREENS = 0.4;
const SLOT_SCREENS = DWELL_SCREENS + TRAVEL_SCREENS;

/** Share of a stage's slot spent standing still. The rest is walking. */
const DWELL = DWELL_SCREENS / SLOT_SCREENS;
const TRAVEL = 1 - DWELL;

/**
 * How far into the pause the writing is allowed to run. This is only a gate:
 * the text also has a clock of its own (see WRITE_SECONDS in main.js) so it
 * writes at a readable speed even when the scroll arrives all at once. Whichever
 * of the two is further behind wins, which means scrubbing back up still rewinds
 * the writing.
 */
const WRITE_OF_DWELL = 0.42;

/**
 * The rest point inside a slot: text finished, walker parked, a margin of pause
 * still in hand on either side. The scroll-snap points sit exactly here.
 */
const READ_OF_DWELL = 0.72;

/**
 * Length of the trip in slots. The last stop gets its pause but no leg after
 * it — walking into nothing at the bottom of the page is just dead scroll.
 */
const U_MAX = STAGE_COUNT - 1 + DWELL;

/** Scroll height, in viewports: the trip, plus the one screen you are looking through. */
export const TRACK_SCREENS = U_MAX * SLOT_SCREENS + 1;

/** How much of [0,1] one stage's slot is worth. */
export const SLOT_PROGRESS = 1 / U_MAX;

/** Where stop `i` comes to rest, as a fraction of the whole scroll. */
export function progressForStage(i) {
  const clamped = Math.min(STAGE_COUNT - 1, Math.max(0, i));
  return Math.min(1, (clamped + DWELL * READ_OF_DWELL) / U_MAX);
}

/**
 * Distance between two stops, in world units. Keyed to the viewport.
 *
 * This is the one number that decides whether the gait looks like walking. The
 * leg is crossed in a fixed time (SLOT_SECONDS in main.js), his stride length is
 * fixed by his height, so the further apart the stops are the more steps a
 * second he has to take. Half a screen puts him at about two and a half steps a
 * second at cruise, which is a person walking; two thirds of a screen put him at
 * a jog.
 */
export function spanFor(visibleWorldWidth) {
  return visibleWorldWidth * 0.52;
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
const RAMP = 0.3;

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

/** 0 at 0, 1 at 1, flat at both ends — every fade on the page goes through it. */
export function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * progress in [0,1] -> where he is and what the page should be doing.
 *
 *   worldX   camera/character position in world units
 *   stage    index of the stage he is at or heading toward
 *   walking  whether the legs should move
 *   walkT    0..1 through the current travel leg
 *   writeT   0..1 of the current stage's text the scroll has paid for
 *   textA    how visible the current stage's writing should be
 *   speed    world units per unit of progress, for foot-planting checks
 */
export function journeyAt(progress, span) {
  const p = Math.min(1, Math.max(0, progress));
  const u = p * U_MAX;
  let i = Math.floor(u);
  if (i >= STAGE_COUNT) i = STAGE_COUNT - 1;
  const local = u - i;

  if (local < DWELL) {
    // standing at stop i
    return {
      worldX: i * span,
      stage: i,
      walking: false,
      walkT: 0,
      dwellT: local / DWELL,
      writeT: Math.min(1, local / (DWELL * WRITE_OF_DWELL)),
      textA: 1,
      speed: 0,
    };
  }

  const t = (local - DWELL) / TRAVEL;
  const next = Math.min(STAGE_COUNT - 1, i + 1);

  return {
    worldX: (i + (next - i) * easeWalk(t)) * span,
    stage: i,
    nextStage: next,
    walking: next !== i,
    walkT: t,
    dwellT: 1,
    writeT: 1,
    // The writing leaves with the first strides, well before its scene does —
    // it belongs to a stop, and he is no longer standing at it. Fading it on the
    // leg rather than on distance keeps that exit at one steady rate whatever
    // the walk is doing.
    textA: 1 - smoothstep(Math.min(1, t / 0.26)),
    speed: walkSpeed(t),
  };
}

/** Alpha for stage `index`'s vignette given where the camera is. */
export function sceneAlpha(worldX, index, span) {
  const d = Math.abs(worldX - index * span);
  const hold = span * 0.34;
  const fade = span * 0.5;
  if (d <= hold) return 1;
  return 1 - smoothstep((d - hold) / fade);
}

/** Which stage a progress value belongs to. */
export function stageOf(progress) {
  return Math.min(STAGE_COUNT - 1, Math.floor(Math.min(1, Math.max(0, progress)) * U_MAX));
}
