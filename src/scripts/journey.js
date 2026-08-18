/**
 * How scroll turns into a walk.
 *
 * He never stops. The trip is one unbroken walk from the first stop to the last,
 * at a steady pace, and the writing for a stop rides along with him while he
 * crosses that stop's stretch of ground. There is no standing still: the words
 * are not something he pauses to hold up, they are what is on the page while he
 * is passing through.
 *
 *   scroll ────────────────────────────────────────────►
 *          ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
 *          he walks the whole way, text fading in and out under his feet
 *
 * Each stop owns one slot of scroll — one span of ground. Entering the slot he
 * is standing on the stop's scene and its writing begins; crossing it the words
 * hold, readable, screen-anchored so they stay put while the scenery slides
 * past behind him; leaving it the writing fades just as the next stop's begins.
 *
 * The page puts a rest point in the middle of every slot — text written out, the
 * walker in the thick of that scene — so a scroll that goes quiet settles on a
 * readable frame rather than mid-word. The snap is `proximity`, not `mandatory`:
 * it catches a gesture that has ended near a stop and leaves every other gesture
 * alone.
 *
 * This file does not decide how fast any of it plays. The scroll only says where
 * he should be; main.js walks him there at a pace the legs can sell.
 */

import { STAGES } from "./stages.js";

export const STAGE_COUNT = STAGES.length;

/**
 * Scroll spent crossing one stop's slot, in viewports. One slot is one span of
 * ground — the distance between two scenes — walked at a steady pace. This is
 * the wheel-distance it takes to cross a stage; the seconds it takes are capped
 * separately (SLOT_SECONDS in main.js) so a flicked wheel still walks.
 */
const SLOT_SCREENS = 0.7;

/**
 * Where in a slot the writing has finished and the walker is deepest in the
 * scene — the reading rest point, and where the scroll-snap sits. A little past
 * the scene rather than on it, so a few steps have landed and the drawing is
 * unmistakably a walk caught mid-stride, not a pose.
 */
const READ_CENTER = 0.4;

/**
 * How far into a slot the writing takes to appear. Only a gate: the text also
 * has a clock of its own (WRITE_SECONDS in main.js) so it writes at a readable
 * speed even when the scroll arrives all at once. Whichever of the two is
 * further behind wins, so scrubbing back up still rewinds the hand.
 */
const WRITE_OF_SLOT = 0.28;

/** When the writing starts leaving, on its way to gone by the end of the slot. */
const FADE_START = 0.78;

/**
 * Length of the trip in slots. It ends on the last stop's reading rest point:
 * the page bottom lands with him a few steps into the final scene and its
 * writing full on, never walking past it into blank ground.
 */
const U_MAX = STAGE_COUNT - 1 + READ_CENTER;

/** Scroll height, in viewports: the trip, plus the one screen you are looking through. */
export const TRACK_SCREENS = U_MAX * SLOT_SCREENS + 1;

/** How much of [0,1] one stage's slot is worth. */
export const SLOT_PROGRESS = 1 / U_MAX;

/** Where stop `i` comes to rest, as a fraction of the whole scroll. */
export function progressForStage(i) {
  const clamped = Math.min(STAGE_COUNT - 1, Math.max(0, i));
  return Math.min(1, (clamped + READ_CENTER) / U_MAX);
}

/**
 * Distance between two stops, in world units. Keyed to the viewport.
 *
 * This is the one number that decides whether the gait looks like walking. The
 * legs are driven off distance walked, not off a clock, so this plus the pace
 * set in main.js is what fixes the cadence: about half a screen per stop puts
 * him near ten unhurried steps to cross it, which is a person walking.
 */
export function spanFor(visibleWorldWidth) {
  return visibleWorldWidth * 0.52;
}

export function worldLength(span) {
  return (STAGE_COUNT - 1) * span;
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
 *   stage    index of the stop whose stretch of ground he is on
 *   walking  always true — he never stops
 *   walkT    0..1 across the current slot
 *   writeT   0..1 of the current stage's text the scroll has paid for
 *   textA    how visible the current stage's writing should be
 *   speed    world units per unit of progress, for foot-planting checks
 */
export function journeyAt(progress, span) {
  const p = Math.min(1, Math.max(0, progress));
  const u = p * U_MAX;
  let i = Math.floor(u);
  if (i >= STAGE_COUNT) i = STAGE_COUNT - 1;
  const local = u - i; // 0..1 across stop i's slot

  // A steady, unbroken pace: worldX runs straight through every slot boundary,
  // so there is no ease-down to a halt at a stop and no lurch away from one. He
  // walks the whole line at one speed and the cadence never breaks.
  return {
    worldX: (i + local) * span,
    stage: i,
    nextStage: Math.min(STAGE_COUNT - 1, i + 1),
    walking: true,
    walkT: local,
    dwellT: 1,
    writeT: Math.min(1, local / WRITE_OF_SLOT),
    // Full on across the middle of the slot, then fading out just as the next
    // stop's writing begins. The last stop never reaches its fade — the page
    // ends before it, on the reading rest point — so contact stays on the board.
    textA: local < FADE_START ? 1 : 1 - smoothstep((local - FADE_START) / (1 - FADE_START)),
    speed: 1,
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
  const u = Math.min(1, Math.max(0, progress)) * U_MAX;
  return Math.min(STAGE_COUNT - 1, Math.floor(u));
}
