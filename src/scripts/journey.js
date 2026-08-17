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
const DWELL = 0.4;
const TRAVEL = 1 - DWELL;

/** Text finishes writing well before the pause ends, so it can be read. */
const WRITE_OF_DWELL = 0.62;

/**
 * Scroll height, in viewports. 14 stages x 0.78 ≈ 10.9.
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

/**
 * progress in [0,1] -> where he is and what the page should be doing.
 *
 *   worldX   camera/character position in world units
 *   stage    index of the stage he is at or heading toward
 *   walking  whether the legs should move
 *   walkT    0..1 through the current travel leg
 *   writeT   0..1 of the current stage's text that has been written
 *   speed    world units per unit of progress, for foot-planting checks
 */
export function journeyAt(progress, span) {
  const p = Math.min(1, Math.max(0, progress));
  const u = p * STAGE_COUNT;
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
      speed: 0,
    };
  }

  const t = (local - DWELL) / TRAVEL;
  const next = Math.min(STAGE_COUNT - 1, i + 1);
  const eased = easeWalk(t);
  const speed = walkSpeed(t);

  return {
    worldX: (i + (next - i) * eased) * span,
    stage: i,
    nextStage: next,
    walking: next !== i,
    walkT: t,
    dwellT: 1,
    writeT: 1,
    speed,
  };
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
  return (clamped + DWELL * 0.55) / STAGE_COUNT;
}

/** Which stage a progress value belongs to. */
export function stageOf(progress) {
  return Math.min(STAGE_COUNT - 1, Math.floor(Math.min(1, Math.max(0, progress)) * STAGE_COUNT));
}
