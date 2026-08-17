/**
 * Composition and the frame loop.
 *
 * Three surfaces, composited every frame:
 *
 *   paper   kraft board, rebuilt only on resize
 *   ink     everything drawn, in near-black on transparent
 *   tooth   grain punched out of the ink so strokes break up on the surface
 *
 * The ink goes down with `multiply`, which is what makes charcoal darken the
 * board the way it physically would, instead of painting grey on top of it.
 *
 * Nothing heavy is redrawn per frame. Each stage's scenery, ground and writing
 * bake into tiles the first time they are needed; the walker is cached per
 * costume and per twelfth of his stride. What is left per frame is a handful of
 * drawImage calls.
 */

import { STAGES } from "./stages.js";
import { Sheet, renderSheet, makePaper, punchTooth } from "./charcoal.js";
import { writeText, underline, tag, wrapLines, textWidth } from "./lettering.js";
import { figureSheet, cycleLength, quantizePhase, PHASE_STEPS } from "./character.js";
import { sceneSheets } from "./scenery.js";
import {
  journeyAt,
  sceneAlpha,
  smoothstep,
  spanFor,
  TRACK_SCREENS,
  SLOT_PROGRESS,
  STAGE_COUNT,
  progressForStage,
} from "./journey.js";

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

/**
 * How long a block of writing takes to write itself on, in seconds, once he has
 * arrived. The scroll gates it too, but the scroll can arrive all at once — a
 * flicked wheel, a snap, a keyboard jump — and text that appears all at once has
 * not been read. Whichever of the two is further behind wins, so scrubbing back
 * up still rewinds the hand.
 */
const WRITE_SECONDS = 1.7;

/** Seconds for the drawing to settle onto the scroll position at the end of a move. */
const FOLLOW_TAU = 0.18;

/**
 * The slowest the drawing is allowed to be dragged along: one stage's slot per
 * this many seconds, whatever the scroll does.
 *
 * This is what stops a snap from turning into a sprint. The browser moves the
 * scrollbar a whole stage in a few hundred milliseconds; without a cap the
 * walker has to cross the same ground in that time, which is the lurch the walk
 * was supposed to replace. Capped, a flicked wheel means: he sets off, walks the
 * leg at his own pace, arrives, and then stands there while the writing catches
 * up. About 2.5s of that slot is the leg itself, the rest is standing.
 */
const SLOT_SECONDS = 4.6;

const state = {
  progress: 0,
  target: 0,
  writeStage: -1,
  writeClock: 0,
  w: 0,
  h: 0,
  dpr: 1,
  span: 600,
  groundY: 0,
  charScale: 1,
  paper: null,
  tooth: null,
  ink: null,
  inkCtx: null,
  reduced: false,
};

/**
 * Where the walker stands on screen, where the ground line sits, and how much
 * board the writing gets.
 *
 * The writing is the point of each stop, so it is laid out first and the walker
 * is placed clear of it — he used to stand at a third of the width and the
 * paragraphs ran straight through his head. On a phone there is no room for two
 * columns, so the text takes the full width above him instead.
 */
function layout() {
  state.groundY = Math.round(state.h * 0.76);
  state.charScale = Math.max(0.95, Math.min(state.w, state.h) / 520);

  // Type is sized off the smaller dimension too: a wide, short window has no
  // room for the big setting a wide, tall one can carry.
  state.typeUnit = Math.min(state.w, state.h * 1.5);
  state.narrow = state.w < 760;
  if (state.narrow) {
    state.textX = Math.round(state.w * 0.06);
    state.textW = Math.round(state.w - state.textX * 2);
    state.screenX = Math.round(state.w * 0.5);
  } else {
    state.textX = Math.round(Math.max(24, state.w * 0.035));
    state.textW = Math.round(Math.min(560, state.w * 0.4));
    state.screenX = Math.round(
      Math.min(state.w * 0.56, Math.max(state.w * 0.34, state.textX + state.textW + state.w * 0.05)),
    );
  }
  // Props were drawn against a 1.45 figure, but at that ratio they huddle by
  // his feet and leave half the sheet blank. Pushing them up spreads the
  // vignette across the frame and lets the big things read as big.
  state.sceneScale = state.charScale / 0.95;
  state.span = spanFor(state.w);
}

/* ----------------------------------------------------------- tile cache --- */

function makeTile(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.ceil(w));
  c.height = Math.max(2, Math.ceil(h));
  return c;
}

/** Small LRU so only the stages in view hold pixels. */
class TileCache {
  constructor(limit) {
    this.limit = limit;
    this.map = new Map();
  }
  get(key, build) {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const made = build();
    this.map.set(key, made);
    while (this.map.size > this.limit) {
      this.map.delete(this.map.keys().next().value);
    }
    return made;
  }
  clear() {
    this.map.clear();
  }
}

const sceneCache = new TileCache(4);
const groundCache = new TileCache(5);
const textCache = new TileCache(4);
const washCache = new TileCache(3);
// 18 stride poses plus idle poses, with room for the costume he is leaving
const figureCache = new TileCache(52);

function sizeKey() {
  return `${state.w}x${state.h}`;
}

/* --------------------------------------------------------------- scenes --- */

function sceneTile(i) {
  return sceneCache.get(`scene:${i}:${sizeKey()}`, () => {
    // Wide enough for the scene's own hills and scrub whatever the span is,
    // otherwise a short span clips them off mid-screen while they are still
    // visible on the way past.
    const half = Math.max(state.span * 1.15, state.w * 0.72);
    const c = makeTile(half * 2, state.h);
    const g = c.getContext("2d");
    const { back, front } = sceneSheets(STAGES[i].id, i + 1);
    g.save();
    g.translate(half, state.groundY);
    g.scale(state.sceneScale, state.sceneScale);
    // the background layer is thinner and paler, and drawn first
    renderSheet(g, back, { alpha: 0.62 });
    renderSheet(g, front, { alpha: 1 });
    g.restore();
    punchTooth(g, c.width, c.height);
    return { canvas: c, offset: half };
  });
}

/**
 * The ground line. Each stage owns exactly one span of it, so the tiles abut
 * and the line runs unbroken from the first stage to the last.
 */
function groundTile(i) {
  return groundCache.get(`ground:${i}:${sizeKey()}`, () => {
    const half = state.span / 2;
    const pad = 30;
    // The two ends run a screen further than their span, so the horizon leaves
    // the frame instead of stopping in the middle of it.
    const runOut = state.w;
    const extL = i === 0 ? runOut : 0;
    const extR = i === STAGE_COUNT - 1 ? runOut : 0;
    const left = -half - extL;
    const length = state.span + extL + extR;
    const bandTop = state.groundY - 26;
    const c = makeTile(length + pad * 2, 70);
    const g = c.getContext("2d");
    const sheet = new Sheet(700 + i);
    const baseY = state.groundY - bandTop;
    const pts = [];
    const n = Math.max(10, Math.round(length / 22));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      // a drawn horizon is never level: it drifts a couple of pixels
      const drift = Math.sin((i * 2.3 + t) * 1.9) * 2.2 + Math.sin((i + t) * 7.3) * 0.9;
      pts.push({ x: left + length * t, y: baseY + drift });
    }
    // the smear of graphite the side of the hand leaves along a long line
    sheet.smudge(0, baseY + 3, state.span * 0.52, 5, 0, { alpha: 0.1 });
    sheet.stroke(pts, { width: 2.6, alpha: 0.88, wobble: 2.1, overshoot: 0, smooth: false });
    // gone over a second time, not quite on the same path
    sheet.stroke(pts.map((p) => ({ x: p.x + 3, y: p.y + 1.8 })), {
      width: 1.2,
      alpha: 0.34,
      wobble: 2.6,
      overshoot: 0,
      search: 0,
      smooth: false,
    });
    g.save();
    g.translate(half + extL + pad, 0);
    renderSheet(g, sheet);
    g.restore();
    punchTooth(g, c.width, c.height);
    return { canvas: c, offset: half + extL + pad, top: bandTop };
  });
}

/* ---------------------------------------------------------------- texts --- */

function buildTextSheet(i) {
  const s = STAGES[i];
  const sheet = new Sheet(900 + i * 7);
  // Bigger than a caption, and wider, because this is the only place the words
  // exist for a sighted reader. The hand wanders, so the lines are set further
  // apart than a font would need: ascenders and descenders have to pass each
  // other without touching.
  const maxW = state.textW;
  const big = Math.min(54, Math.max(28, state.typeUnit * 0.037));
  const body = Math.min(30, Math.max(19, state.typeUnit * 0.021));
  const gap = body * 0.34;
  // the whole block leans a little, the way a page of notes does
  const tilt = ((i % 3) - 1) * 0.012;
  let y = 0;

  // How wide the block actually ends up, so the wash under it fits the words
  // rather than the column they were wrapped in. Nominal advances measure a
  // little short of what the hand draws, hence the margin.
  let widest = 0;
  const measure = (text, size, hand) => {
    for (const line of wrapLines(text, { size, hand, maxWidth: maxW })) {
      widest = Math.max(widest, textWidth(line, { size, hand }) * 1.08);
    }
  };
  measure(s.place, body * 0.82, "small");
  measure(s.title, big, "display");
  measure(s.body, body, "note");
  if (s.email) measure(s.email, big * 0.7, "display");

  y += writeText(sheet, s.place, 0, y, {
    size: body * 0.82,
    hand: "small",
    seed: 10 + i,
    tilt,
    maxWidth: maxW,
    lineGap: gap * 0.5,
  });
  y += body * 0.62;
  y += writeText(sheet, s.title, 0, y, {
    size: big,
    hand: "display",
    seed: 40 + i,
    tilt,
    maxWidth: maxW,
    lineGap: gap,
  });
  // under the last line of the title, and only as far as that line runs
  const titleLines = wrapLines(s.title, { size: big, hand: "display", maxWidth: maxW });
  const lastLine = titleLines[titleLines.length - 1];
  underline(
    sheet,
    0,
    y - big * 0.16 - gap,
    Math.min(maxW, textWidth(lastLine, { size: big, hand: "display" }) * 1.04),
    { seed: 60 + i, alpha: 0.34 },
  );
  y += body * 0.85;
  y += writeText(sheet, s.body, 0, y, {
    size: body,
    hand: "note",
    seed: 80 + i,
    tilt,
    maxWidth: maxW,
    lineGap: gap,
  });

  if (s.chips) {
    y += body * 0.8;
    let tx = 0;
    for (const c of s.chips) {
      const w = tag(sheet, c, tx, y, { size: body * 0.74, seed: 120 + i + tx, alpha: 0.66 });
      tx += w;
      widest = Math.max(widest, tx);
      if (tx > maxW - 60) {
        tx = 0;
        y += body * 1.5;
      }
    }
    y += body * 1.2;
  }

  if (s.email) {
    y += body * 0.6;
    writeText(sheet, s.email, 0, y, { size: big * 0.7, hand: "display", seed: 160 + i, tilt });
  }

  return { sheet, height: y, width: Math.min(maxW, Math.max(widest, maxW * 0.4)) };
}

function textBundle(i) {
  return textCache.get(`text:${i}:${sizeKey()}`, () => {
    const built = buildTextSheet(i);
    return { ...built, baked: null };
  });
}

/**
 * A patch of light rubbed into the board under the writing.
 *
 * The words are charcoal on kraft, and so is everything behind them; where a
 * scene's lines run through a paragraph the paragraph stops being readable.
 * Lifting the board a little under the block pulls the contrast back without
 * putting a card on the page — the edges are soft and the grain is punched back
 * through it, so it reads as paper, not as UI.
 */
function washTile(w, h) {
  return washCache.get(`wash:${Math.round(w)}x${Math.round(h)}`, () => {
    const c = makeTile(w, h);
    const g = c.getContext("2d");
    const feather = Math.max(26, Math.min(w, h) * 0.16);
    const r = feather * 1.4;
    const x0 = feather;
    const y0 = feather;
    const bw = c.width - feather * 2;
    const bh = c.height - feather * 2;
    // A blurred shape rather than a gradient: the edge has to die out on all
    // four sides at once, and an ellipse leaves the corners of a paragraph out
    // in the scenery.
    g.filter = `blur(${feather * 0.52}px)`;
    g.fillStyle = "rgba(239,224,194,0.95)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x0, y0, bw, bh, r);
    else g.rect(x0, y0, bw, bh);
    g.fill();
    g.filter = "none";
    punchTooth(g, c.width, c.height, 0.22);
    return c;
  });
}

/* -------------------------------------------------------------- walker --- */

function figureTile(costume, phase, walking, idleBucket) {
  const key = `fig:${costume}:${phase.toFixed(3)}:${walking}:${idleBucket}:${state.charScale.toFixed(2)}`;
  return figureCache.get(key, () => {
    // headroom for the tallest hat (the chef's) plus a thrown graduation cap
    const pad = 155 * state.charScale;
    const top = 235 * state.charScale;
    const c = makeTile(pad * 2, top + 40 * state.charScale);
    const g = c.getContext("2d");
    const sheet = figureSheet({
      phase,
      walking,
      dir: 1,
      costume,
      scale: state.charScale,
      idleT: idleBucket * 0.5,
      seed: 7,
    });
    g.save();
    g.translate(pad, top);
    renderSheet(g, sheet);
    g.restore();
    punchTooth(g, c.width, c.height);
    return { canvas: c, ox: pad, oy: top };
  });
}

/**
 * Build one not-yet-cached stride pose per frame, at most. Called only while he
 * is standing still, so the work lands in frames with nothing else to do.
 */
let warmAt = 0;

function warmPoses(costume) {
  for (let n = 0; n < PHASE_STEPS; n++) {
    const k = (warmAt + n) % PHASE_STEPS;
    const phase = (k / PHASE_STEPS) * Math.PI * 2;
    const key = `fig:${costume}:${phase.toFixed(3)}:true:0:${state.charScale.toFixed(2)}`;
    if (figureCache.map.has(key)) continue;
    figureTile(costume, phase, true, 0);
    warmAt = k + 1;
    return;
  }
}

/* --------------------------------------------------------------- cover --- */

/**
 * The cover has about two seconds to answer "what is this person" and "why
 * should I believe them". A poetic title answers neither, so it leads with the
 * role, then the proof, then the way in — eyebrow, headline, evidence, prompt.
 */
function coverSheet() {
  return textCache.get(`cover:${sizeKey()}`, () => {
    const sheet = new Sheet(3);
    const cx = state.w * 0.5;
    const big = Math.min(58, Math.max(21, state.w * 0.042));
    const maxW = Math.min(state.w * 0.88, 880);
    let y = state.h * 0.13;

    y += writeText(sheet, "Computer engineer", cx, y, {
      size: Math.max(14, big * 0.38),
      hand: "small",
      align: "center",
      seed: 2,
      tilt: -0.01,
    });
    y += Math.max(20, big * 0.7);

    const headTop = y;
    y += writeText(sheet, "Linux systems and network administrator", cx, y, {
      size: big,
      hand: "display",
      align: "center",
      maxWidth: maxW,
      seed: 5,
      tilt: -0.008,
    });
    underline(sheet, cx - Math.min(maxW, big * 9) / 2, y - big * 0.2, Math.min(maxW, big * 9), {
      seed: 8,
      alpha: 0.4,
    });
    void headTop;
    y += big * 0.62;

    writeText(sheet, "Six years keeping critical infrastructure online.", cx, y, {
      size: Math.max(15, big * 0.42),
      hand: "note",
      align: "center",
      maxWidth: maxW,
      seed: 11,
      tilt: 0.007,
    });

    writeText(sheet, "scroll to walk the line", cx, state.h * 0.88, {
      size: Math.max(18, big * 0.34),
      hand: "small",
      align: "center",
      seed: 9,
      tilt: -0.02,
    });
    return { sheet };
  });
}

/* ---------------------------------------------------------------- frame --- */

function frame() {
  const { w, h } = state;
  const span = state.span;
  const j = journeyAt(state.progress, span);
  const camX = j.worldX - state.screenX;

  // The board goes down, then every mark is multiplied onto it. Compositing
  // straight onto the visible canvas rather than through an intermediate ink
  // buffer saves two full-screen operations a frame, which is most of the cost.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(state.paper, 0, 0, w, h);
  ctx.globalCompositeOperation = "multiply";
  const ig = ctx;

  // ground: only the stages whose span is on screen
  for (let i = 0; i < STAGE_COUNT; i++) {
    const sx = i * span - camX;
    // the end tiles carry a screen of run-out, so they stay on screen longer
    const reach = span * 1.2 + (i === 0 || i === STAGE_COUNT - 1 ? w : 0);
    if (sx < -reach || sx > w + reach) continue;
    const t = groundTile(i);
    ig.drawImage(t.canvas, Math.round(sx - t.offset), t.top);
  }

  // scenery
  for (let i = 0; i < STAGE_COUNT; i++) {
    const a = sceneAlpha(j.worldX, i, span);
    if (a <= 0.005) continue;
    const sx = i * span - camX;
    const tile = sceneTile(i);
    ig.globalAlpha = a;
    ig.drawImage(tile.canvas, Math.round(sx - tile.offset), 0);
    ig.globalAlpha = 1;
  }

  // The writing: only ever the stop he is standing at, on top of every scene.
  // Two blocks on the board at once is the thing that made this hard to read.
  const reveal = Math.min(j.writeT, state.writeClock / WRITE_SECONDS);
  if (j.textA > 0.004 && reveal > 0.002) {
    const bundle = textBundle(j.stage);
    const tx = state.textX;
    // High enough to clear the ground line even when the block runs long. On a
    // phone the block sits over him, so it starts at the top of the sheet.
    const ty = state.narrow
      ? Math.round(h * 0.06)
      : Math.round(Math.max(h * 0.06, Math.min(h * 0.15, state.groundY - 46 - bundle.height)));

    const padX = Math.max(52, bundle.width * 0.1);
    const padY = Math.max(58, bundle.height * 0.08);
    const wash = washTile(bundle.width + padX * 2, bundle.height + padY * 2);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.66 * j.textA * smoothstep(Math.min(1, reveal * 2.4));
    // the block's first baseline is at ty, so its ink starts a line above that
    ctx.drawImage(wash, tx - padX, ty - padY - Math.round(bundle.height * 0.04) - 30);
    ctx.globalCompositeOperation = "multiply";

    ig.globalAlpha = j.textA;
    if (reveal >= 1) {
      if (!bundle.baked) {
        // the first baseline sits at sheet y=0, so ascenders live at negative
        // y — the tile needs real headroom or the top line loses its heads
        const pad = 70;
        const c = makeTile(bundle.width + pad * 2, bundle.height + pad * 2);
        const g = c.getContext("2d");
        renderSheet(g, bundle.sheet, { x: pad, y: pad });
        bundle.baked = c;
        bundle.pad = pad;
      }
      ig.drawImage(bundle.baked, tx - bundle.pad, ty - bundle.pad);
    } else {
      renderSheet(ig, bundle.sheet, { x: tx, y: ty, reveal });
    }
    ig.globalAlpha = 1;
  }

  // the walker
  const phase = quantizePhase((j.worldX / cycleLength(state.charScale)) * Math.PI * 2);
  const idleBucket = j.walking ? 0 : Math.floor(j.dwellT * 6);
  const costume = STAGES[j.stage].costume;
  const fig = figureTile(costume, phase, j.walking, idleBucket);
  ig.drawImage(fig.canvas, Math.round(state.screenX - fig.ox), Math.round(state.groundY - fig.oy));

  // While he stands there, quietly draw the poses he is about to need. Building
  // one costs about as long as a frame, so meeting them for the first time
  // mid-stride is exactly where the animation would hitch.
  if (!j.walking) warmPoses(costume);

  // the cover, gone before the first stage starts writing itself
  const coverEnd = progressForStage(0) * 0.55;
  if (state.progress < coverEnd) {
    const a = 1 - smoothstep(state.progress / coverEnd);
    ig.globalAlpha = a;
    renderSheet(ig, coverSheet().sheet);
    ig.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/* --------------------------------------------------------------- setup --- */

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.dpr = dpr;
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.floor(state.w * dpr);
  canvas.height = Math.floor(state.h * dpr);
  canvas.style.width = state.w + "px";
  canvas.style.height = state.h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  layout();

  // half resolution: it is a paper texture, nobody counts its pixels, and it
  // is the single most expensive thing built on load
  state.paper = makePaper(Math.max(2, state.w / 2), Math.max(2, state.h / 2), 7);

  sceneCache.clear();
  groundCache.clear();
  textCache.clear();
  washCache.clear();
  figureCache.clear();

  sizeTrack();
}

/**
 * The scroll track, and one snap point per stop.
 *
 * The snap points are what make a scroll gesture mean a stage: the scroll comes
 * to rest at a stop's reading position — walker parked, text finished — and
 * never halfway through a stride. A wheel notch moves to the neighbouring point,
 * so you cannot skip a stage without meaning to, and you cannot stall between
 * two of them.
 *
 * The top of the page is a snap point too, otherwise a mandatory snap would
 * drag the reader off the cover the moment they touched the wheel.
 */
function sizeTrack() {
  const track = document.querySelector(".track");
  if (!track) return;
  const vh = window.innerHeight;
  track.style.height = `${Math.round(vh * TRACK_SCREENS)}px`;

  const scroll = maxScroll();
  let html = '<div class="stop" style="top:0"></div>';
  for (let i = 0; i < STAGE_COUNT; i++) {
    const top = Math.round(progressForStage(i) * scroll);
    html += `<div class="stop" style="top:${top}px"></div>`;
  }
  track.innerHTML = html;
}

/**
 * The scroll the trip is mapped onto. Taken from the track rather than from the
 * document, so it agrees with the snap points to the pixel even if something
 * else on the page (the readable CV, when a keyboard reaches it) makes the
 * document taller.
 */
function maxScroll() {
  return Math.max(1, Math.round(window.innerHeight * (TRACK_SCREENS - 1)));
}

function queryProgress() {
  const raw = new URLSearchParams(location.search).get("p");
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

/**
 * Keys move by stops, not by pixels. "The next one" is the next stop the reader
 * has not reached yet, which is not `current + 1` when he is mid-stride between
 * two of them.
 */
function stopAfter(p, dir) {
  const eps = 0.004;
  if (dir > 0) {
    for (let i = 0; i < STAGE_COUNT; i++) {
      if (progressForStage(i) > p + eps) return i;
    }
    return STAGE_COUNT - 1;
  }
  for (let i = STAGE_COUNT - 1; i >= 0; i--) {
    if (progressForStage(i) < p - eps) return i;
  }
  return 0;
}

function setupKeys() {
  window.addEventListener("keydown", (e) => {
    // Once a keyboard has reached the readable CV, the arrows belong to it.
    if (state.reduced || document.querySelector(".readable:focus-within")) return;
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ")
      next = stopAfter(state.target, 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp")
      next = stopAfter(state.target, -1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = STAGE_COUNT - 1;
    if (next === null) return;
    e.preventDefault();
    const p = progressForStage(Math.max(0, Math.min(STAGE_COUNT - 1, next)));
    window.scrollTo({ top: p * maxScroll(), behavior: "smooth" });
  });
}

function start() {
  const debug = queryProgress();
  state.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (debug !== null) {
    state.progress = debug;
    state.target = debug;
    state.writeStage = -1;
    state.writeClock = WRITE_SECONDS;
    frame();
    return;
  }

  state.progress = Math.min(1, Math.max(0, window.scrollY / maxScroll()));
  state.target = state.progress;

  let last = performance.now();
  const loop = (now) => {
    // Frame-rate independent, so the walk has the same weight on a 60Hz laptop
    // and a 144Hz monitor. Clamped because a backgrounded tab hands back one
    // enormous dt, and that lands as a lurch.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    state.target = Math.min(1, Math.max(0, window.scrollY / maxScroll()));
    if (state.reduced) {
      state.progress = state.target;
    } else {
      const gap = state.target - state.progress;
      const behind = Math.abs(gap) / SLOT_PROGRESS;
      if (behind > 3.5) {
        // A scrollbar drag can move the target by half the trip. There is no
        // pace at which walking that reads as walking, so cut, and let him
        // arrive already on his feet.
        state.progress = state.target;
      } else {
        // Constant pace across the leg, exponential for the last few percent so
        // he settles onto the mark instead of stopping dead on it. Falling
        // further behind speeds him up in proportion, so a reader spinning the
        // wheel gets a fast-forward rather than a queue.
        const ease = gap * (1 - Math.exp(-dt / FOLLOW_TAU));
        const cap = (SLOT_PROGRESS / SLOT_SECONDS) * Math.max(1, behind) * dt;
        state.progress += Math.max(-cap, Math.min(cap, ease));
      }
    }

    // The writing clock: reset on arrival at a new stop, then run only while
    // the scroll has asked for writing at all — so it does not quietly expire
    // behind the cover.
    const j = journeyAt(state.progress, state.span);
    if (j.stage !== state.writeStage) {
      state.writeStage = j.stage;
      state.writeClock = 0;
    } else if (j.writeT > 0) {
      state.writeClock = Math.min(WRITE_SECONDS * 1.5, state.writeClock + dt);
    }

    frame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Rebuilding the paper and every tile costs a few hundred milliseconds, so a
// drag-resize must not trigger it on every pixel.
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resize();
    frame();
  }, 160);
});
resize();
setupKeys();
start();
